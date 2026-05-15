from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.opening import Opening, OpeningLine, OpeningPracticeAttempt
from app.schemas.opening import (
    OpeningCreate,
    OpeningResponse,
    OpeningLineCreate,
    OpeningLineResponse,
    OpeningPracticeAttemptCreate,
    OpeningPracticeAttemptResponse
)


router = APIRouter(
    prefix="/openings",
    tags=["Openings"]
)


@router.post("/", response_model=OpeningResponse)
def create_opening(
    payload: OpeningCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    opening = Opening(
        user_id=current_user.id,
        name=payload.name,
        color=payload.color.lower(),
        starting_moves=payload.starting_moves,
        notes=payload.notes
    )

    db.add(opening)
    db.commit()
    db.refresh(opening)

    return opening


@router.get("/", response_model=List[OpeningResponse])
def get_my_openings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Opening)
        .filter(Opening.user_id == current_user.id)
        .order_by(Opening.created_at.desc())
        .all()
    )


@router.get("/{opening_id}", response_model=OpeningResponse)
def get_opening(
    opening_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    opening = (
        db.query(Opening)
        .filter(
            Opening.id == opening_id,
            Opening.user_id == current_user.id
        )
        .first()
    )

    if not opening:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opening not found"
        )

    return opening


@router.post("/{opening_id}/lines", response_model=OpeningLineResponse)
def add_opening_line(
    opening_id: int,
    payload: OpeningLineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    opening = (
        db.query(Opening)
        .filter(
            Opening.id == opening_id,
            Opening.user_id == current_user.id
        )
        .first()
    )

    if not opening:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opening not found"
        )

    line = OpeningLine(
        opening_id=opening.id,
        move_order=payload.move_order,
        fen=payload.fen,
        best_move=payload.best_move,
        explanation=payload.explanation
    )

    db.add(line)
    db.commit()
    db.refresh(line)

    return line


@router.get("/{opening_id}/lines", response_model=List[OpeningLineResponse])
def get_opening_lines(
    opening_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    opening = (
        db.query(Opening)
        .filter(
            Opening.id == opening_id,
            Opening.user_id == current_user.id
        )
        .first()
    )

    if not opening:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opening not found"
        )

    return (
        db.query(OpeningLine)
        .filter(OpeningLine.opening_id == opening.id)
        .order_by(OpeningLine.move_order.asc())
        .all()
    )


@router.get("/{opening_id}/practice/next", response_model=OpeningLineResponse)
def get_next_opening_practice_line(
    opening_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    opening = (
        db.query(Opening)
        .filter(
            Opening.id == opening_id,
            Opening.user_id == current_user.id
        )
        .first()
    )

    if not opening:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opening not found"
        )

    lines = (
        db.query(OpeningLine)
        .filter(OpeningLine.opening_id == opening.id)
        .order_by(OpeningLine.move_order.asc())
        .all()
    )

    if not lines:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No opening lines found"
        )

    for line in lines:
        last_attempt = (
            db.query(OpeningPracticeAttempt)
            .filter(
                OpeningPracticeAttempt.user_id == current_user.id,
                OpeningPracticeAttempt.opening_line_id == line.id
            )
            .order_by(OpeningPracticeAttempt.created_at.desc())
            .first()
        )

        if not last_attempt or not last_attempt.is_correct:
            return line

    return lines[0]


@router.post(
    "/{opening_id}/lines/{line_id}/attempt",
    response_model=OpeningPracticeAttemptResponse
)
def attempt_opening_line(
    opening_id: int,
    line_id: int,
    payload: OpeningPracticeAttemptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    opening = (
        db.query(Opening)
        .filter(
            Opening.id == opening_id,
            Opening.user_id == current_user.id
        )
        .first()
    )

    if not opening:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opening not found"
        )

    line = (
        db.query(OpeningLine)
        .filter(
            OpeningLine.id == line_id,
            OpeningLine.opening_id == opening.id
        )
        .first()
    )

    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opening line not found"
        )

    is_correct = payload.user_move.strip().lower() == line.best_move.strip().lower()

    attempt = OpeningPracticeAttempt(
        user_id=current_user.id,
        opening_id=opening.id,
        opening_line_id=line.id,
        user_move=payload.user_move,
        is_correct=is_correct,
        time_taken_seconds=payload.time_taken_seconds
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return attempt