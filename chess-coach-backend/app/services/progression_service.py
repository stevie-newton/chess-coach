from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.puzzle import PuzzleAttempt
from app.models.user import User


LEVEL_XP = 250


def level_for_xp(xp_points: int) -> int:
    return max(1, (xp_points // LEVEL_XP) + 1)


def xp_to_next_level(xp_points: int) -> int:
    return LEVEL_XP - (xp_points % LEVEL_XP)


def award_xp(db: Session, user: User, amount: int) -> dict:
    old_level = user.training_level or level_for_xp(user.xp_points or 0)
    user.xp_points = (user.xp_points or 0) + max(0, amount)
    user.training_level = level_for_xp(user.xp_points)
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "xp_awarded": amount,
        "leveled_up": user.training_level > old_level,
        "level": user.training_level,
        "xp_points": user.xp_points,
        "xp_to_next_level": xp_to_next_level(user.xp_points),
    }


def update_training_streak(user: User) -> None:
    now = datetime.now(timezone.utc)
    last_completed = user.last_training_completed_at

    if last_completed and last_completed.tzinfo is None:
        last_completed = last_completed.replace(tzinfo=timezone.utc)

    if not last_completed:
        user.training_streak = 1
    elif now.date() == last_completed.date():
        user.training_streak = max(1, user.training_streak or 1)
    elif now.date() - last_completed.date() <= timedelta(days=1):
        user.training_streak = (user.training_streak or 0) + 1
    else:
        user.training_streak = 1

    user.last_training_completed_at = now


def complete_daily_progression(db: Session, user: User, accuracy: int) -> dict:
    update_training_streak(user)
    xp_amount = 40 + max(0, min(60, int(accuracy * 0.6)))
    return award_xp(db=db, user=user, amount=xp_amount)


def build_achievements(db: Session, user: User) -> list[dict]:
    puzzle_attempts = db.query(PuzzleAttempt).filter(PuzzleAttempt.user_id == user.id).count()
    puzzle_correct = (
        db.query(PuzzleAttempt)
        .filter(PuzzleAttempt.user_id == user.id, PuzzleAttempt.is_correct == True)
        .count()
    )

    achievements = [
        {
            "key": "seven_day_streak",
            "title": "7-Day Streak",
            "description": "Complete training on seven days in a row.",
            "badge": "flame",
            "unlocked": (user.training_streak or 0) >= 7,
            "progress": min(user.training_streak or 0, 7),
            "target": 7,
        },
        {
            "key": "puzzle_hunter",
            "title": "Puzzle Hunter",
            "description": "Solve 25 tactical puzzles correctly.",
            "badge": "puzzle-star",
            "unlocked": puzzle_correct >= 25,
            "progress": min(puzzle_correct, 25),
            "target": 25,
        },
        {
            "key": "endgame_master",
            "title": "Endgame Master",
            "description": "Complete 10 practical endgame lines.",
            "badge": "chess-king",
            "unlocked": (user.endgame_completions or 0) >= 10,
            "progress": min(user.endgame_completions or 0, 10),
            "target": 10,
        },
        {
            "key": "visualizer",
            "title": "Visualizer",
            "description": "Complete 10 calculation drills.",
            "badge": "brain",
            "unlocked": (user.calculation_completions or 0) >= 10,
            "progress": min(user.calculation_completions or 0, 10),
            "target": 10,
        },
        {
            "key": "level_five",
            "title": "Club Grinder",
            "description": "Reach training level 5.",
            "badge": "medal",
            "unlocked": (user.training_level or 1) >= 5,
            "progress": min(user.training_level or 1, 5),
            "target": 5,
        },
    ]

    return achievements


def build_progression_profile(db: Session, user: User) -> dict:
    xp_points = user.xp_points or 0
    level = user.training_level or level_for_xp(xp_points)

    return {
        "xp_points": xp_points,
        "level": level,
        "xp_to_next_level": xp_to_next_level(xp_points),
        "level_progress": round(((xp_points % LEVEL_XP) / LEVEL_XP) * 100, 2),
        "training_streak": user.training_streak or 0,
        "endgame_completions": user.endgame_completions or 0,
        "calculation_completions": user.calculation_completions or 0,
        "achievements": build_achievements(db=db, user=user),
    }
