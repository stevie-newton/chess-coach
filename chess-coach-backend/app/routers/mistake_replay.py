from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.game import Game
from app.services.hint_service import generate_hint
from app.models.analysis import MoveAnalysis
from app.models.mistake_replay import MistakeReplayAttempt
from app.schemas.mistake_replay import (
    MistakeReplayAttemptCreate,
    MistakeReplayAttemptResponse
)
from app.utils.chess_move_utils import parse_uci_move
from datetime import datetime, timezone
from app.models.mistake_replay import MistakeReplayAttempt, MistakeReviewState
from app.services.spaced_repetition_service import update_review_state


router = APIRouter(
    prefix="/mistake-replay",
    tags=["Mistake Replay"]
)


@router.get("/next")
def get_next_mistake_replay(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)

    due_mistake = (
        db.query(MoveAnalysis)
        .join(Game, Game.id == MoveAnalysis.game_id)
        .outerjoin(
            MistakeReviewState,
            MistakeReviewState.move_analysis_id == MoveAnalysis.id
        )
        .filter(
            Game.user_id == current_user.id,
            MoveAnalysis.mistake_type.in_(["inaccuracy", "mistake", "blunder"]),
            MoveAnalysis.best_move.isnot(None),
            (
                (MistakeReviewState.id == None) |
                (MistakeReviewState.due_at <= now)
            )
        )
        .order_by(MoveAnalysis.id.asc())
        .first()
    )

    if not due_mistake:
        return {
            "message": "No mistakes are due right now. Great work — you are caught up."
        }

    return {
        "move_analysis_id": due_mistake.id,
        "game_id": due_mistake.game_id,
        "move_number": due_mistake.move_number,
        "color": due_mistake.color,
        "fen_before": due_mistake.fen_before,
        "played_move": due_mistake.played_move,
        "played_move_uci": due_mistake.played_move_uci,
        "played_move_preview": parse_uci_move(due_mistake.played_move_uci),
        "best_move": due_mistake.best_move,
        "best_move_preview": parse_uci_move(due_mistake.best_move),
        "mistake_type": due_mistake.mistake_type,
        "evaluation_before": due_mistake.evaluation_before,
        "evaluation_after": due_mistake.evaluation_after,
        "instruction": "Find the best move in this position."
    }

    return {
        "message": "Excellent. You have correctly replayed all current mistakes."
    }


def build_attempt_explanation(mistake: MoveAnalysis, is_correct: bool):
    best_move = mistake.best_move or "the engine move"
    source_explanation = mistake.explanation or "This move keeps the position closer to the engine's preferred plan."

    if is_correct:
        return f"Correct. {best_move} is the engine recommendation. {source_explanation}"

    return f"The best move was {best_move}. {source_explanation}"


@router.post(
    "/{move_analysis_id}/attempt",
    response_model=MistakeReplayAttemptResponse
)
def attempt_mistake_replay(
    move_analysis_id: int,
    payload: MistakeReplayAttemptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    mistake = (
        db.query(MoveAnalysis)
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(
            MoveAnalysis.id == move_analysis_id,
            Game.user_id == current_user.id
        )
        .first()
    )

    if not mistake:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mistake position not found"
        )

    if not mistake.best_move:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No best move available for this position"
        )

    is_correct = payload.user_move.strip().lower() == mistake.best_move.strip().lower()

    attempt = MistakeReplayAttempt(
        user_id=current_user.id,
        move_analysis_id=mistake.id,
        user_move=payload.user_move,
        is_correct=is_correct,
        time_taken_seconds=payload.time_taken_seconds
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    update_review_state(
    db=db,
    user_id=current_user.id,
    move_analysis_id=mistake.id,
    is_correct=is_correct
)

    return {
        "id": attempt.id,
        "move_analysis_id": attempt.move_analysis_id,
        "user_move": attempt.user_move,
        "is_correct": attempt.is_correct,
        "best_move": mistake.best_move,
        "explanation": build_attempt_explanation(mistake, is_correct),
        "time_taken_seconds": attempt.time_taken_seconds,
        "created_at": attempt.created_at,
    }


@router.get("/stats")
def get_mistake_replay_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_attempts = (
        db.query(MistakeReplayAttempt)
        .filter(MistakeReplayAttempt.user_id == current_user.id)
        .count()
    )

    correct_attempts = (
        db.query(MistakeReplayAttempt)
        .filter(
            MistakeReplayAttempt.user_id == current_user.id,
            MistakeReplayAttempt.is_correct == True
        )
        .count()
    )

    success_rate = (
        0 if total_attempts == 0
        else round((correct_attempts / total_attempts) * 100, 2)
    )

    return {
        "total_attempts": total_attempts,
        "correct_attempts": correct_attempts,
        "success_rate": success_rate
    }


@router.get("/{move_analysis_id}/hint/{hint_level}")
def get_mistake_replay_hint(
    move_analysis_id: int,
    hint_level: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if hint_level < 1 or hint_level > 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hint level must be between 1 and 4"
        )

    mistake = (
        db.query(MoveAnalysis)
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(
            MoveAnalysis.id == move_analysis_id,
            Game.user_id == current_user.id
        )
        .first()
    )

    if not mistake:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mistake position not found"
        )

    return generate_hint(
        move=mistake,
        hint_level=hint_level
    )


@router.get("/review-queue")
def get_review_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)

    due_count = (
        db.query(MistakeReviewState)
        .filter(
            MistakeReviewState.user_id == current_user.id,
            MistakeReviewState.due_at <= now
        )
        .count()
    )

    future_count = (
        db.query(MistakeReviewState)
        .filter(
            MistakeReviewState.user_id == current_user.id,
            MistakeReviewState.due_at > now
        )
        .count()
    )

    return {
        "due_now": due_count,
        "scheduled_later": future_count
    }
