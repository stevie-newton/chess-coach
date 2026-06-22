from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.game import Game
from app.models.analysis import GameAnalysis, MoveAnalysis
from app.models.weakness import Weakness
from app.models.training import TrainingSession
from app.models.puzzle import PuzzleAttempt
from app.models.tournament import TournamentSimulation
from app.models.opening import Opening, OpeningLine, OpeningPracticeAttempt
from app.services.progression_service import build_progression_profile
from app.services.skill_profile_service import detect_skill_profile
from app.utils.player_move_scope import player_move_scope_filter


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


def progress_label(score: float, weak: bool = False) -> str:
    if weak or score < 45:
        return "Weak"
    if score < 70:
        return "Improving"
    return "Strong"


def weakness_score(weaknesses: list[Weakness], keyword: str) -> int:
    return sum(
        (weakness.severity or 0) + (weakness.frequency or 0)
        for weakness in weaknesses
        if keyword in (weakness.category or "").lower()
    )


def build_today_mission(
    *,
    total_games: int,
    analyzed_games: int,
    total_mistakes: int,
    total_blunders: int,
    puzzle_success_rate: float,
    training_completion_rate: float,
    opening_lines: int,
    opening_success_rate: float,
    top_weaknesses: list[Weakness],
) -> dict:
    weakness = top_weaknesses[0] if top_weaknesses else None
    focus = weakness.category if weakness else "tactics and consistency"
    tasks = []

    if total_games == 0:
        tasks.append({
            "title": "Import or record one game",
            "detail": "The coach needs one real game before it can personalize your training.",
            "icon": "download",
            "href": "/import-games",
            "minutes": 5,
        })
    elif analyzed_games < total_games:
        tasks.append({
            "title": "Analyze your newest game",
            "detail": "Turn the fresh PGN into mistakes, blunders, and coach takeaways.",
            "icon": "chart-timeline-variant",
            "href": "/(tabs)/games",
            "minutes": 5,
        })
    else:
        tasks.append({
            "title": "Replay one mistake",
            "detail": f"Start with your highest-impact weakness: {focus}.",
            "icon": "clipboard-text-search",
            "href": "/mistake-replay",
            "minutes": 8,
        })

    puzzle_count = 8 if puzzle_success_rate >= 70 else 5
    tasks.append({
        "title": f"Solve {puzzle_count} focused puzzles",
        "detail": "Prioritize accuracy over speed and write down missed patterns.",
        "icon": "puzzle",
        "href": "/(tabs)/puzzles",
        "minutes": 10,
    })

    if opening_lines == 0:
        tasks.append({
            "title": "Add one opening line",
            "detail": "Save a line you actually play so the coach can quiz your memory.",
            "icon": "book-open-page-variant",
            "href": "/openings",
            "minutes": 7,
        })
    elif opening_success_rate < 75:
        tasks.append({
            "title": "Drill opening recall",
            "detail": "Review the line until the next move feels automatic.",
            "icon": "bookshelf",
            "href": "/opening-practice",
            "minutes": 7,
        })
    else:
        tasks.append({
            "title": "Play a practice game",
            "detail": "Use the coach game mode and bring today's focus into a real position.",
            "icon": "chess-board",
            "href": "/game-session",
            "minutes": 15,
        })

    if training_completion_rate < 50:
        title = "Build the habit"
        message = "Keep today's work short and finish every task. Consistency is the rating gain."
    elif total_blunders > total_mistakes:
        title = "Blunder control day"
        message = "Slow down before forcing moves. Checks, captures, threats, then safety."
    else:
        title = "Sharpen the main weakness"
        message = f"Today's focus is {focus}. Train it, then test it in one practical position."

    return {
        "title": title,
        "message": message,
        "focus": focus,
        "estimated_minutes": sum(task["minutes"] for task in tasks),
        "tasks": tasks,
    }


ROADMAP_LEVELS = [
    {
        "key": "beginner",
        "title": "Beginner",
        "description": "Build reliable habits and stop the biggest one-move losses.",
        "requirements": {
            "tactics": 35,
            "openings": 20,
            "endgames": 20,
            "calculation": 10,
            "time_management": 15,
        },
    },
    {
        "key": "club_player",
        "title": "Club Player",
        "description": "Play complete games with basic plans and fewer simple blunders.",
        "requirements": {
            "tactics": 55,
            "openings": 40,
            "endgames": 40,
            "calculation": 35,
            "time_management": 40,
        },
    },
    {
        "key": "intermediate",
        "title": "Intermediate",
        "description": "Convert advantages, calculate short lines, and follow a stable repertoire.",
        "requirements": {
            "tactics": 70,
            "openings": 60,
            "endgames": 60,
            "calculation": 60,
            "time_management": 60,
        },
    },
    {
        "key": "advanced",
        "title": "Advanced",
        "description": "Prepare deeply, calculate under pressure, and review games like a tournament player.",
        "requirements": {
            "tactics": 85,
            "openings": 78,
            "endgames": 78,
            "calculation": 80,
            "time_management": 80,
        },
    },
]


def build_player_roadmap(
    *,
    tactics_score: float,
    opening_score: float,
    endgame_score: float,
    calculation_completions: int,
    training_streak: int,
    tournament_win_rate: float,
    training_completion_rate: float,
) -> dict:
    skill_scores = {
        "tactics": round(max(0, min(100, tactics_score)), 2),
        "openings": round(max(0, min(100, opening_score)), 2),
        "endgames": round(max(0, min(100, endgame_score)), 2),
        "calculation": round(max(0, min(100, min(calculation_completions, 20) * 5)), 2),
        "time_management": round(
            max(
                0,
                min(
                    100,
                    (min(training_streak, 14) * 3)
                    + (training_completion_rate * 0.35)
                    + (tournament_win_rate * 0.25),
                ),
            ),
            2,
        ),
    }
    levels = []
    current_level = ROADMAP_LEVELS[0]

    for level in ROADMAP_LEVELS:
        requirements = level["requirements"]
        skill_rows = []

        for key, target in requirements.items():
            score = skill_scores[key]
            skill_rows.append({
                "key": key,
                "label": key.replace("_", " ").title(),
                "score": score,
                "target": target,
                "complete": score >= target,
            })

        progress = round(
            sum(min(skill["score"], skill["target"]) / skill["target"] for skill in skill_rows)
            / len(skill_rows)
            * 100,
            2,
        )
        complete = all(skill["complete"] for skill in skill_rows)

        if complete:
            current_level = level

        levels.append({
            "key": level["key"],
            "title": level["title"],
            "description": level["description"],
            "progress": progress,
            "complete": complete,
            "skills": skill_rows,
        })

    next_level = next((level for level in levels if not level["complete"]), levels[-1])
    weakest_skill = min(next_level["skills"], key=lambda skill: skill["score"] / skill["target"])

    return {
        "current_level": current_level["title"],
        "next_level": next_level["title"],
        "next_focus": weakest_skill,
        "skills": skill_scores,
        "levels": levels,
    }


@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_games = (
        db.query(Game)
        .filter(Game.user_id == current_user.id)
        .count()
    )

    analyzed_games = (
        db.query(GameAnalysis)
        .join(Game, Game.id == GameAnalysis.game_id)
        .filter(Game.user_id == current_user.id)
        .count()
    )

    avg_accuracy = (
        db.query(func.avg(GameAnalysis.accuracy))
        .join(Game, Game.id == GameAnalysis.game_id)
        .filter(Game.user_id == current_user.id)
        .scalar()
    )

    total_blunders = (
        db.query(func.count(MoveAnalysis.id))
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(
            Game.user_id == current_user.id,
            player_move_scope_filter(),
            MoveAnalysis.mistake_type == "blunder"
        )
        .scalar()
    )

    total_mistakes = (
        db.query(func.count(MoveAnalysis.id))
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(
            Game.user_id == current_user.id,
            player_move_scope_filter(),
            MoveAnalysis.mistake_type == "mistake"
        )
        .scalar()
    )

    top_weaknesses = (
        db.query(Weakness)
        .filter(Weakness.user_id == current_user.id)
        .order_by(Weakness.severity.desc(), Weakness.frequency.desc())
        .limit(3)
        .all()
    )

    all_weaknesses = (
        db.query(Weakness)
        .filter(Weakness.user_id == current_user.id)
        .all()
    )

    training_total = (
        db.query(TrainingSession)
        .filter(TrainingSession.user_id == current_user.id)
        .count()
    )

    training_completed = (
        db.query(TrainingSession)
        .filter(
            TrainingSession.user_id == current_user.id,
            TrainingSession.completed == True
        )
        .count()
    )

    puzzle_attempts = (
        db.query(PuzzleAttempt)
        .filter(PuzzleAttempt.user_id == current_user.id)
        .count()
    )

    puzzle_correct = (
        db.query(PuzzleAttempt)
        .filter(
            PuzzleAttempt.user_id == current_user.id,
            PuzzleAttempt.is_correct == True
        )
        .count()
    )

    tournament_games = (
        db.query(TournamentSimulation)
        .filter(TournamentSimulation.user_id == current_user.id)
        .count()
    )

    tournament_wins = (
        db.query(TournamentSimulation)
        .filter(
            TournamentSimulation.user_id == current_user.id,
            TournamentSimulation.result == "win"
        )
        .count()
    )

    training_completion_rate = (
        0 if training_total == 0
        else round((training_completed / training_total) * 100, 2)
    )

    puzzle_success_rate = (
        0 if puzzle_attempts == 0
        else round((puzzle_correct / puzzle_attempts) * 100, 2)
    )

    opening_lines = (
        db.query(OpeningLine)
        .join(Opening, Opening.id == OpeningLine.opening_id)
        .filter(Opening.user_id == current_user.id)
        .count()
    )

    opening_attempts = (
        db.query(OpeningPracticeAttempt)
        .filter(OpeningPracticeAttempt.user_id == current_user.id)
        .count()
    )

    opening_correct = (
        db.query(OpeningPracticeAttempt)
        .filter(
            OpeningPracticeAttempt.user_id == current_user.id,
            OpeningPracticeAttempt.is_correct == True
        )
        .count()
    )

    opening_success_rate = (
        0 if opening_attempts == 0
        else round((opening_correct / opening_attempts) * 100, 2)
    )

    opening_mastery = (
        min(100, opening_lines * 10)
        if opening_attempts == 0
        else round((opening_success_rate * 0.75) + (min(100, opening_lines * 8) * 0.25), 2)
    )

    tactics_weakness = sum(
        (weakness.severity or 0) + (weakness.frequency or 0)
        for weakness in all_weaknesses
        if any(
            token in (weakness.category or "").lower()
            for token in ["tactic", "fork", "pin", "skewer", "mate", "capture", "discovered"]
        )
    )
    endgame_weakness = weakness_score(all_weaknesses, "endgame")
    opening_weakness = weakness_score(all_weaknesses, "opening")

    tactics_score = round(
        min(100, (puzzle_success_rate * 0.65) + (min(current_user.puzzle_rating or 1200, 2200) - 1000) * 0.08 + min(current_user.puzzle_streak or 0, 10) * 2)
        if puzzle_attempts > 0
        else min(100, max(35, ((current_user.puzzle_rating or 1200) - 900) / 8)),
        2
    )
    endgame_score = round(max(20, min(100, 55 + (current_user.endgame_completions or 0) * 6 - endgame_weakness * 5)), 2)
    opening_score = round(max(20, min(100, opening_mastery - opening_weakness * 4)), 2)
    accuracy_score = round(avg_accuracy, 2) if avg_accuracy else 0

    tournament_win_rate = (
        0 if tournament_games == 0
        else round((tournament_wins / tournament_games) * 100, 2)
    )
    today_mission = build_today_mission(
        total_games=total_games,
        analyzed_games=analyzed_games,
        total_mistakes=total_mistakes,
        total_blunders=total_blunders,
        puzzle_success_rate=puzzle_success_rate,
        training_completion_rate=training_completion_rate,
        opening_lines=opening_lines,
        opening_success_rate=opening_success_rate,
        top_weaknesses=top_weaknesses,
    )
    player_roadmap = build_player_roadmap(
        tactics_score=tactics_score,
        opening_score=opening_score,
        endgame_score=endgame_score,
        calculation_completions=current_user.calculation_completions or 0,
        training_streak=current_user.training_streak or 0,
        tournament_win_rate=tournament_win_rate,
        training_completion_rate=training_completion_rate,
    )

    return {
        "user": {
            "username": current_user.username,
            "chess_level": current_user.chess_level,
            "target_rating": current_user.target_rating,
            "chesscom_username": current_user.chesscom_username,
            "lichess_username": current_user.lichess_username,
            "coach_personality": current_user.coach_personality,
            "xp_points": current_user.xp_points,
            "training_level": current_user.training_level,
            "training_streak": current_user.training_streak,
            "puzzle_rating": current_user.puzzle_rating,
            "puzzle_streak": current_user.puzzle_streak,
            "endgame_completions": current_user.endgame_completions,
        },
        "progression": build_progression_profile(db=db, user=current_user),
        "skill_profile": detect_skill_profile(db=db, user=current_user),
        "today_mission": today_mission,
        "player_roadmap": player_roadmap,
        "games": {
            "total": total_games,
            "analyzed": analyzed_games,
            "average_accuracy": round(avg_accuracy, 2) if avg_accuracy else 0,
            "total_mistakes": total_mistakes,
            "total_blunders": total_blunders
        },
        "weaknesses": [
            {
                "category": weakness.category,
                "frequency": weakness.frequency,
                "severity": weakness.severity
            }
            for weakness in top_weaknesses
        ],
        "training": {
            "total_sessions": training_total,
            "completed_sessions": training_completed,
            "completion_rate": training_completion_rate
        },
        "puzzles": {
            "attempts": puzzle_attempts,
            "correct": puzzle_correct,
            "success_rate": puzzle_success_rate,
            "rating": current_user.puzzle_rating,
            "streak": current_user.puzzle_streak
        },
        "openings": {
            "lines": opening_lines,
            "attempts": opening_attempts,
            "correct": opening_correct,
            "success_rate": opening_success_rate,
            "mastery": opening_mastery
        },
        "progress": {
            "title": "Your Progress",
            "tactics": {
                "label": progress_label(tactics_score, tactics_weakness >= 10),
                "score": tactics_score,
                "detail": f"Puzzle rating {current_user.puzzle_rating or 1200}, streak {current_user.puzzle_streak or 0}",
            },
            "endgames": {
                "label": progress_label(endgame_score, endgame_weakness >= 8),
                "score": endgame_score,
                "detail": f"{current_user.endgame_completions or 0} completions",
            },
            "openings": {
                "label": progress_label(opening_score, opening_weakness >= 8),
                "score": opening_score,
                "detail": f"{opening_mastery}% mastery from {opening_lines} lines",
            },
            "accuracy": {
                "label": progress_label(accuracy_score),
                "score": accuracy_score,
                "detail": f"{analyzed_games} analyzed games",
            },
            "streaks": {
                "training": current_user.training_streak or 0,
                "puzzles": current_user.puzzle_streak or 0,
            },
            "weaknesses": [
                {
                    "category": weakness.category,
                    "frequency": weakness.frequency,
                    "severity": weakness.severity
                }
                for weakness in top_weaknesses
            ],
        },
        "tournaments": {
            "simulations": tournament_games,
            "wins": tournament_wins,
            "win_rate": tournament_win_rate
        }
    }


@router.get("/progress-report")
def get_progress_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    summary = get_dashboard_summary(db=db, current_user=current_user)

    weakness_lines = [
        f"- {weakness['category']}: severity {weakness['severity']}, frequency {weakness['frequency']}"
        for weakness in summary["weaknesses"]
    ] or ["- No weaknesses detected yet."]

    report = "\n".join(
        [
            f"Chess Coach Progress Report for {summary['user']['username']}",
            "",
            "Games",
            f"- Total games: {summary['games']['total']}",
            f"- Analyzed games: {summary['games']['analyzed']}",
            f"- Average accuracy: {summary['games']['average_accuracy']}%",
            f"- Mistakes: {summary['games']['total_mistakes']}",
            f"- Blunders: {summary['games']['total_blunders']}",
            "",
            "Top Weaknesses",
            *weakness_lines,
            "",
            "Your Progress",
            f"- Tactics: {summary['progress']['tactics']['label']} ({summary['progress']['tactics']['score']}%)",
            f"- Endgames: {summary['progress']['endgames']['label']} ({summary['progress']['endgames']['score']}%)",
            f"- Openings: {summary['progress']['openings']['label']} ({summary['progress']['openings']['score']}%)",
            f"- Puzzle rating: {summary['puzzles']['rating']}",
            f"- Opening mastery: {summary['openings']['mastery']}%",
            f"- Training streak: {summary['progress']['streaks']['training']}",
            f"- Puzzle streak: {summary['progress']['streaks']['puzzles']}",
            "",
            "Training",
            f"- Completed sessions: {summary['training']['completed_sessions']} / {summary['training']['total_sessions']}",
            f"- Completion rate: {summary['training']['completion_rate']}%",
            "",
            "Puzzles",
            f"- Attempts: {summary['puzzles']['attempts']}",
            f"- Correct: {summary['puzzles']['correct']}",
            f"- Success rate: {summary['puzzles']['success_rate']}%",
            "",
            "Tournaments",
            f"- Simulations: {summary['tournaments']['simulations']}",
            f"- Wins: {summary['tournaments']['wins']}",
            f"- Win rate: {summary['tournaments']['win_rate']}%",
            "",
            "Skill Detection",
            f"- Detected level: {summary['skill_profile']['detected_level']}",
            f"- Confidence: {summary['skill_profile']['confidence']}",
            f"- Puzzle difficulty: {summary['skill_profile']['adaptation']['puzzle_difficulty']}",
            f"- Lesson complexity: {summary['skill_profile']['adaptation']['lesson_complexity']}",
            f"- Engine depth: {summary['skill_profile']['adaptation']['engine_depth']}",
            f"- Coaching language: {summary['skill_profile']['adaptation']['coaching_language']}",
        ]
    )

    return {
        "filename": "chess-coach-progress-report.txt",
        "report": report,
        "summary": summary,
    }
