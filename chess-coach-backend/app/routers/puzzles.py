from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.game import Game
from app.models.analysis import MoveAnalysis
from app.models.puzzle import Puzzle, PuzzleAttempt
from app.schemas.puzzle import (
    PuzzleCoachAnswer,
    PuzzleCoachQuestion,
    PuzzleResponse,
    PuzzleAttemptCreate,
    PuzzleAttemptResponse,
    PuzzleLineResponse,
)
from app.services.explanation_engine_service import ask_puzzle_coach, explain_puzzle_attempt
from app.services.progression_service import award_xp
from app.services.puzzle_service import (
    build_puzzle_solution_line,
    generate_puzzles_from_game,
    get_personalized_puzzle_queue,
    validate_puzzle_attempt,
)
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


@router.get("/personalized-training")
def get_personalized_training(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    queue = get_personalized_puzzle_queue(
        db=db,
        user_id=current_user.id,
    )

    return queue


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


@router.post("/{puzzle_id}/ask", response_model=PuzzleCoachAnswer)
def ask_about_puzzle(
    puzzle_id: int,
    payload: PuzzleCoachQuestion,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not payload.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question is required"
        )

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

    move_analysis = None
    if puzzle.move_analysis_id:
        move_analysis = (
            db.query(MoveAnalysis)
            .filter(MoveAnalysis.id == puzzle.move_analysis_id)
            .first()
        )

    recent_attempts = (
        db.query(PuzzleAttempt)
        .filter(PuzzleAttempt.puzzle_id == puzzle.id, PuzzleAttempt.user_id == current_user.id)
        .order_by(PuzzleAttempt.created_at.desc())
        .limit(5)
        .all()
    )

    solution_line = build_puzzle_solution_line(
        fen=puzzle.fen,
        solution=puzzle.solution,
        max_plies=5,
    )

    answer = ask_puzzle_coach(
        puzzle=puzzle,
        question=payload.question.strip(),
        move_analysis=move_analysis,
        recent_attempts=recent_attempts,
        current_move=payload.current_move,
        solution_line=solution_line,
        coach_personality=current_user.coach_personality,
    )

    if not answer:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The puzzle coach is unavailable right now. Check the OpenAI configuration and try again."
        )

    return {
        "puzzle_id": puzzle.id,
        "answer": answer,
        "source": "openai",
    }


@router.get("/{puzzle_id}/line", response_model=PuzzleLineResponse)
def get_puzzle_solution_line(
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

    line = build_puzzle_solution_line(
        fen=puzzle.fen,
        solution=puzzle.solution,
    )

    if not line:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not generate a solution continuation for this puzzle"
        )

    return {
        "puzzle_id": puzzle.id,
        "line": line,
    }


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

    validation = validate_puzzle_attempt(
        fen=puzzle.fen,
        user_move=payload.user_move,
        best_move=puzzle.solution,
    )
    is_legal = validation["is_legal"]
    is_correct = validation["is_correct"]
    move_analysis = None
    review_state = None

    if is_legal and puzzle.move_analysis_id:
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

    explanation, explanation_source = explain_puzzle_attempt(
        puzzle=puzzle,
        validation=validation,
        move_analysis=move_analysis,
        coach_personality=current_user.coach_personality,
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
        user_move=validation["normalized_user_move"],
        is_correct=is_correct,
        time_taken_seconds=payload.time_taken_seconds
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    db.refresh(current_user)
    progression = award_xp(db=db, user=current_user, amount=15 if is_correct else 4)

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
        "message": validation["message"],
        "feedback": validation["feedback"],
        "is_legal": is_legal,
        "best_move": validation["normalized_best_move"],
        "explanation": explanation,
        "explanation_source": explanation_source,
        "puzzle_rating": current_user.puzzle_rating,
        "puzzle_streak": current_user.puzzle_streak,
        "spaced_repetition": spaced_repetition,
        "progression": progression,
        "created_at": attempt.created_at,
    }
