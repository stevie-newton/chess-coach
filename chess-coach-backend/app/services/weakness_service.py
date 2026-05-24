from sqlalchemy.orm import Session

from app.models.weakness import Weakness


def detect_weakness_category(move_number: int, mistake_type: str, explanation: str | None = None):
    if mistake_type == 'good':
        return None

    if move_number <= 10:
        return 'opening mistake'

    if explanation:
        text = explanation.lower()

        if 'mate' in text:
            return 'missed mate or mating threat'

        if 'fork' in text:
            return 'missed forks'

        if 'pin' in text:
            return 'missed pins'

        if 'skewer' in text:
            return 'missed skewers'

        if 'discovered' in text:
            return 'missed discovered attacks'

        if 'capture' in text or 'wins material' in text:
            return 'missed captures'

        if 'king' in text:
            return 'king safety'

        if 'pawn' in text:
            return 'pawn structure'

        if 'endgame' in text:
            return 'endgame technique'

    if move_number >= 30:
        return 'endgame mistake'

    return 'middlegame tactical mistake'


def weakness_severity(mistake_type: str):
    if mistake_type == 'blunder':
        return 3
    if mistake_type == 'mistake':
        return 2
    if mistake_type == 'inaccuracy':
        return 1
    return 0


def update_user_weakness(
    db: Session,
    user_id: int,
    category: str,
    mistake_type: str
):
    severity_value = weakness_severity(mistake_type)

    weakness = (
        db.query(Weakness)
        .filter(
            Weakness.user_id == user_id,
            Weakness.category == category
        )
        .first()
    )

    if weakness:
        weakness.frequency += 1
        weakness.severity += severity_value
    else:
        weakness = Weakness(
            user_id=user_id,
            category=category,
            frequency=1,
            severity=severity_value
        )
        db.add(weakness)

    db.commit()
    db.refresh(weakness)

    return weakness
