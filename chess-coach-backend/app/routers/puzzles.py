from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.game import Game
from app.models.puzzle import Puzzle, PuzzleAttempt
from app.schemas.puzzle import PuzzleResponse, PuzzleAttemptCreate, PuzzleAttemptResponse
from app.services.puzzle_service import generate_puzzles_from_game


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

    return attempt