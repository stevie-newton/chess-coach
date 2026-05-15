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
    OpeningPracticeAttemptResponse,
    OpeningProgressResponse
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
        explanation=payload.explanation,
        variation_name=payload.variation_name,
        difficulty=payload.difficulty.lower()
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


@router.get("/{opening_id}/progress", response_model=OpeningProgressResponse)
def get_opening_progress(
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

    total_lines = len(lines)
    mastered_lines = 0
    attempted_lines = 0
    total_attempts = 0
    correct_attempts = 0
    weak_lines = []

    for line in lines:
        attempts = (
            db.query(OpeningPracticeAttempt)
            .filter(
                OpeningPracticeAttempt.user_id == current_user.id,
                OpeningPracticeAttempt.opening_line_id == line.id
            )
            .order_by(OpeningPracticeAttempt.created_at.desc())
            .all()
        )

        if not attempts:
            continue

        attempted_lines += 1
        line_attempts = len(attempts)
        line_misses = len([attempt for attempt in attempts if not attempt.is_correct])
        total_attempts += line_attempts
        correct_attempts += len([attempt for attempt in attempts if attempt.is_correct])

        latest_attempt = attempts[0]
        if latest_attempt.is_correct:
            mastered_lines += 1
        else:
            weak_lines.append({
                "opening_line_id": line.id,
                "move_order": line.move_order,
                "variation_name": line.variation_name,
                "best_move": line.best_move,
                "difficulty": line.difficulty,
                "attempts": line_attempts,
                "misses": line_misses,
                "last_user_move": latest_attempt.user_move,
            })

    known_percent = (
        0
        if total_lines == 0
        else round((mastered_lines / total_lines) * 100, 2)
    )
    weak_lines = sorted(
        weak_lines,
        key=lambda item: (item["misses"], item["move_order"]),
        reverse=True
    )
    focus = None

    if weak_lines:
        weakest = weak_lines[0]
        variation = weakest["variation_name"] or "line"
        focus = f"You keep missing move {weakest['move_order']} in the {variation}."

    return {
        "opening_id": opening.id,
        "opening_name": opening.name,
        "known_percent": known_percent,
        "total_lines": total_lines,
        "mastered_lines": mastered_lines,
        "attempted_lines": attempted_lines,
        "total_attempts": total_attempts,
        "correct_attempts": correct_attempts,
        "weak_lines": weak_lines,
        "summary": f"You know {known_percent}% of this opening.",
        "focus": focus,
    }


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
