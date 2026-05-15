from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.game import Game
from app.models.analysis import MoveAnalysis
from app.models.puzzle import Puzzle, PuzzleAttempt
from app.schemas.puzzle import PuzzleResponse, PuzzleAttemptCreate, PuzzleAttemptResponse
from app.services.puzzle_service import generate_puzzles_from_game
from app.services.spaced_repetition_service import update_review_state


router = APIRouter(
    prefix="/puzzles",
    tags=["Puzzles"]
)


@router.post("/from-game/{game_id}", response_model=List[PuzzleResponse])
def create_puzzles_from_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    game = (
        db.query(Game)
        .filter(Game.id == game_id, Game.user_id == current_user.id)
        .first()
    )

    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )

    puzzles = generate_puzzles_from_game(
        db=db,
        user_id=current_user.id,
        game=game
    )

    return puzzles


@router.get("/", response_model=List[PuzzleResponse])
def get_my_puzzles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Puzzle)
        .filter(Puzzle.user_id == current_user.id)
        .order_by(Puzzle.created_at.desc())
        .all()
    )


@router.get("/{puzzle_id}", response_model=PuzzleResponse)
def get_puzzle(
    puzzle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    puzzle = (
        db.query(Puzzle)
        .filter(Puzzle.id == puzzle_id, Puzzle.user_id == current_user.id)
        .first()
    )

    if not puzzle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Puzzle not found"
        )

    return puzzle


@router.post("/{puzzle_id}/attempt", response_model=PuzzleAttemptResponse)
def attempt_puzzle(
    puzzle_id: int,
    payload: PuzzleAttemptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    puzzle = (
        db.query(Puzzle)
        .filter(Puzzle.id == puzzle_id, Puzzle.user_id == current_user.id)
        .first()
    )

    if not puzzle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Puzzle not found"
        )

    is_correct = payload.user_move.strip().lower() == puzzle.solution.strip().lower()
    move_analysis = None
    review_state = None

    if puzzle.move_analysis_id:
        move_analysis = (
            db.query(MoveAnalysis)
            .filter(MoveAnalysis.id == puzzle.move_analysis_id)
            .first()
        )
        review_state = update_review_state(
            db=db,
            user_id=current_user.id,
            move_analysis_id=puzzle.move_analysis_id,
            is_correct=is_correct
        )

    if is_correct:
        current_user.puzzle_streak = (current_user.puzzle_streak or 0) + 1
        current_user.puzzle_rating = (current_user.puzzle_rating or 1200) + 10
    else:
        current_user.puzzle_streak = 0
        current_user.puzzle_rating = max(100, (current_user.puzzle_rating or 1200) - 6)

    attempt = PuzzleAttempt(
        puzzle_id=puzzle.id,
        user_id=current_user.id,
        user_move=payload.user_move,
        is_correct=is_correct,
        time_taken_seconds=payload.time_taken_seconds
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    db.refresh(current_user)

    spaced_repetition = None
    if review_state:
        spaced_repetition = {
            "ease_factor": review_state.ease_factor,
            "interval_days": review_state.interval_days,
            "repetitions": review_state.repetitions,
            "due_at": review_state.due_at,
        }

    return {
        "id": attempt.id,
        "puzzle_id": attempt.puzzle_id,
        "user_move": attempt.user_move,
        "is_correct": attempt.is_correct,
        "time_taken_seconds": attempt.time_taken_seconds,
        "message": "Correct!" if is_correct else "Incorrect",
        "feedback": (
            "Excellent tactical vision."
            if is_correct
            else "That move misses a tactical opportunity."
        ),
        "explanation": move_analysis.explanation if move_analysis else None,
        "puzzle_rating": current_user.puzzle_rating,
        "puzzle_streak": current_user.puzzle_streak,
        "spaced_repetition": spaced_repetition,
        "created_at": attempt.created_at,
    }
