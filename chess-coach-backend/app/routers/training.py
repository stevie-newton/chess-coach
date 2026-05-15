from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.training import TrainingSession
from app.schemas.training import TrainingSessionResponse, CompleteTrainingRequest
from app.services.training_service import generate_training_plan


router = APIRouter(
    prefix="/training",
    tags=["Training"]
)


@router.post("/generate", response_model=List[TrainingSessionResponse])
def create_training_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return generate_training_plan(db=db, user_id=current_user.id)


@router.get("/", response_model=List[TrainingSessionResponse])
def get_training_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(TrainingSession)
        .filter(TrainingSession.user_id == current_user.id)
        .order_by(TrainingSession.created_at.desc())
        .all()
    )


@router.patch("/{session_id}/complete", response_model=TrainingSessionResponse)
def complete_training_session(
    session_id: int,
    payload: CompleteTrainingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = (
        db.query(TrainingSession)
        .filter(
            TrainingSession.id == session_id,
            TrainingSession.user_id == current_user.id
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training session not found"
        )

    session.completed = True
    session.score = payload.score

    db.commit()
    db.refresh(session)

    return session