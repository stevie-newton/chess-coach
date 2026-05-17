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
from app.services.progression_service import build_progression_profile
from app.services.skill_profile_service import detect_skill_profile


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


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
            MoveAnalysis.mistake_type == "blunder"
        )
        .scalar()
    )

    total_mistakes = (
        db.query(func.count(MoveAnalysis.id))
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(
            Game.user_id == current_user.id,
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

    tournament_win_rate = (
        0 if tournament_games == 0
        else round((tournament_wins / tournament_games) * 100, 2)
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
        },
        "progression": build_progression_profile(db=db, user=current_user),
        "skill_profile": detect_skill_profile(db=db, user=current_user),
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
            "success_rate": puzzle_success_rate
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
