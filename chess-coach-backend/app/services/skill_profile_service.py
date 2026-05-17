from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.analysis import GameAnalysis, MoveAnalysis
from app.models.game import Game
from app.models.opening import Opening, OpeningLine, OpeningPracticeAttempt
from app.models.puzzle import PuzzleAttempt
from app.models.user import User


def _score_bucket(value: float, beginner_limit: float, advanced_limit: float) -> int:
    if value >= advanced_limit:
        return 2
    if value >= beginner_limit:
        return 1
    return 0


def _level_from_score(score: float) -> str:
    if score >= 1.45:
        return "Advanced"
    if score >= 0.75:
        return "Intermediate"
    return "Beginner"


def _adaptation_for_level(level: str) -> dict:
    if level == "Advanced":
        return {
            "puzzle_difficulty": "Hard tactical and strategic puzzles",
            "lesson_complexity": "Candidate moves, plans, transitions, and calculation trees",
            "engine_depth": 16,
            "coaching_language": "Concise, technical, and variation-aware",
        }

    if level == "Intermediate":
        return {
            "puzzle_difficulty": "Medium puzzles with mixed tactics and positional decisions",
            "lesson_complexity": "Plans, common structures, forcing moves, and practical endgames",
            "engine_depth": 12,
            "coaching_language": "Balanced explanations with key chess terms defined in context",
        }

    return {
        "puzzle_difficulty": "Easy pattern recognition and blunder-prevention puzzles",
        "lesson_complexity": "One idea at a time with simple rules and visual examples",
        "engine_depth": 8,
        "coaching_language": "Plain language, short steps, and minimal engine jargon",
    }


def detect_skill_profile(db: Session, user: User) -> dict:
    analyzed_games = (
        db.query(GameAnalysis)
        .join(Game, Game.id == GameAnalysis.game_id)
        .filter(Game.user_id == user.id)
        .count()
    )

    avg_accuracy = (
        db.query(func.avg(GameAnalysis.accuracy))
        .join(Game, Game.id == GameAnalysis.game_id)
        .filter(Game.user_id == user.id)
        .scalar()
    ) or 0

    total_moves = (
        db.query(func.count(MoveAnalysis.id))
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(Game.user_id == user.id)
        .scalar()
    ) or 0

    total_blunders = (
        db.query(func.count(MoveAnalysis.id))
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(
            Game.user_id == user.id,
            MoveAnalysis.mistake_type == "blunder",
        )
        .scalar()
    ) or 0

    puzzle_attempts = db.query(PuzzleAttempt).filter(PuzzleAttempt.user_id == user.id).count()
    puzzle_correct = (
        db.query(PuzzleAttempt)
        .filter(PuzzleAttempt.user_id == user.id, PuzzleAttempt.is_correct == True)
        .count()
    )
    puzzle_success_rate = 0 if puzzle_attempts == 0 else round((puzzle_correct / puzzle_attempts) * 100, 2)

    opening_count = db.query(Opening).filter(Opening.user_id == user.id).count()
    opening_line_count = (
        db.query(OpeningLine)
        .join(Opening, Opening.id == OpeningLine.opening_id)
        .filter(Opening.user_id == user.id)
        .count()
    )
    opening_attempts = (
        db.query(OpeningPracticeAttempt)
        .filter(OpeningPracticeAttempt.user_id == user.id)
        .count()
    )
    opening_correct = (
        db.query(OpeningPracticeAttempt)
        .filter(OpeningPracticeAttempt.user_id == user.id, OpeningPracticeAttempt.is_correct == True)
        .count()
    )
    opening_success_rate = 0 if opening_attempts == 0 else round((opening_correct / opening_attempts) * 100, 2)

    rapid_or_classical_games = (
        db.query(Game)
        .filter(
            Game.user_id == user.id,
            Game.time_control.isnot(None),
            ~Game.time_control.ilike("%bullet%"),
            ~Game.time_control.ilike("%blitz%"),
        )
        .count()
    )
    time_usage_score = (
        0
        if analyzed_games == 0
        else round(min(100, (rapid_or_classical_games / max(analyzed_games, 1)) * 100), 2)
    )

    blunder_frequency = 0 if total_moves == 0 else round((total_blunders / total_moves) * 100, 2)
    opening_knowledge_score = min(100, (opening_count * 12) + (opening_line_count * 3) + (opening_success_rate * 0.35))

    metric_scores = [
        _score_bucket(user.puzzle_rating or 1200, 1000, 1600),
        _score_bucket(avg_accuracy, 55, 75),
        2 if blunder_frequency <= 3 and total_moves > 0 else 1 if blunder_frequency <= 8 and total_moves > 0 else 0,
        _score_bucket(time_usage_score, 30, 65),
        _score_bucket(opening_knowledge_score, 20, 55),
    ]
    detected_score = round(sum(metric_scores) / len(metric_scores), 2)
    detected_level = _level_from_score(detected_score)

    confidence_inputs = sum(
        [
            1 if analyzed_games >= 3 else 0,
            1 if puzzle_attempts >= 5 else 0,
            1 if opening_count > 0 or opening_attempts > 0 else 0,
        ]
    )
    confidence = ["Low", "Medium", "High"][min(confidence_inputs, 2)]

    signals = [
        f"Puzzle rating: {user.puzzle_rating or 1200}",
        f"Analyzed games: {analyzed_games}",
        f"Average accuracy: {round(avg_accuracy, 2)}%",
        f"Blunder frequency: {blunder_frequency}%",
        f"Time-control sample: {time_usage_score}%",
        f"Opening knowledge: {round(opening_knowledge_score, 2)}",
    ]

    return {
        "detected_level": detected_level,
        "declared_level": user.chess_level,
        "confidence": confidence,
        "score": detected_score,
        "signals": {
            "puzzle_rating": user.puzzle_rating or 1200,
            "puzzle_success_rate": puzzle_success_rate,
            "analyzed_games": analyzed_games,
            "average_accuracy": round(avg_accuracy, 2),
            "blunder_frequency": blunder_frequency,
            "time_usage_score": time_usage_score,
            "opening_count": opening_count,
            "opening_line_count": opening_line_count,
            "opening_success_rate": opening_success_rate,
            "opening_knowledge_score": round(opening_knowledge_score, 2),
        },
        "evidence": signals,
        "adaptation": _adaptation_for_level(detected_level),
    }
