from sqlalchemy.orm import Session

from app.models.weakness import Weakness
from app.models.training import TrainingSession


def activity_for_weakness(category: str):
    category = category.lower()

    if "opening" in category:
        return "Review your opening moves and replay the first 10 moves from your last games."

    if "middlegame" in category or "tactical" in category:
        return "Solve tactical puzzles focused on forks, pins, skewers, and hanging pieces."

    if "endgame" in category:
        return "Practice king and pawn endgames, rook endgames, and basic checkmate patterns."

    if "king safety" in category:
        return "Review positions where your king became exposed and practice defensive moves."

    if "pawn" in category:
        return "Study pawn structure, weak pawns, isolated pawns, and pawn breaks."

    if "mate" in category:
        return "Solve checkmate patterns and mating threat puzzles."

    return "Review your recent mistakes and replay better candidate moves."


def duration_for_severity(severity: int):
    if severity >= 6:
        return 30
    if severity >= 3:
        return 20
    return 15


def generate_training_plan(db: Session, user_id: int):
    weaknesses = (
        db.query(Weakness)
        .filter(Weakness.user_id == user_id)
        .order_by(Weakness.severity.desc(), Weakness.frequency.desc())
        .limit(3)
        .all()
    )

    sessions = []

    if not weaknesses:
        return sessions

    for weakness in weaknesses:
        session = TrainingSession(
            user_id=user_id,
            focus_area=weakness.category,
            activity=activity_for_weakness(weakness.category),
            duration_minutes=duration_for_severity(weakness.severity)
        )

        db.add(session)
        sessions.append(session)

    db.commit()

    for session in sessions:
        db.refresh(session)

    return sessions
