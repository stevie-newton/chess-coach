from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.mistake_replay import MistakeReviewState


def get_or_create_review_state(
    db: Session,
    user_id: int,
    move_analysis_id: int
):
    state = (
        db.query(MistakeReviewState)
        .filter(
            MistakeReviewState.user_id == user_id,
            MistakeReviewState.move_analysis_id == move_analysis_id
        )
        .first()
    )

    if state:
        return state

    state = MistakeReviewState(
        user_id=user_id,
        move_analysis_id=move_analysis_id,
        ease_factor=250,
        interval_days=1,
        repetitions=0,
        due_at=datetime.now(timezone.utc)
    )

    db.add(state)
    db.commit()
    db.refresh(state)

    return state


def update_review_state(
    db: Session,
    user_id: int,
    move_analysis_id: int,
    is_correct: bool
):
    state = get_or_create_review_state(
        db=db,
        user_id=user_id,
        move_analysis_id=move_analysis_id
    )

    if not is_correct:
        state.repetitions = 0
        state.interval_days = 1
        state.ease_factor = max(130, state.ease_factor - 20)
    else:
        state.repetitions += 1

        if state.repetitions == 1:
            state.interval_days = 1
        elif state.repetitions == 2:
            state.interval_days = 3
        else:
            state.interval_days = round(state.interval_days * (state.ease_factor / 100))

        state.ease_factor = min(300, state.ease_factor + 10)

    state.due_at = datetime.now(timezone.utc) + timedelta(days=state.interval_days)

    db.commit()
    db.refresh(state)

    return state