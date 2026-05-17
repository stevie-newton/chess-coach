from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import chess

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
    OpeningPracticeSessionResponse,
    OpeningProgressResponse
)


router = APIRouter(
    prefix="/openings",
    tags=["Openings"]
)


def line_payload(line: OpeningLine | None):
    if not line:
        return None

    return {
        "id": line.id,
        "opening_id": line.opening_id,
        "move_order": line.move_order,
        "fen": line.fen,
        "best_move": line.best_move,
        "explanation": line.explanation,
        "variation_name": line.variation_name,
        "difficulty": line.difficulty,
        "created_at": line.created_at,
    }


def parse_opening_move(fen: str, move_text: str):
    try:
        board = chess.Board(fen)
    except ValueError:
        return None, None

    normalized = (move_text or "").strip()

    try:
        move = chess.Move.from_uci(normalized.lower())
        if move in board.legal_moves:
            return board, move
    except ValueError:
        pass

    try:
        return board, board.parse_san(normalized)
    except ValueError:
        return board, None


def side_to_move(fen: str):
    try:
        board = chess.Board(fen)
    except ValueError:
        return None

    return "white" if board.turn == chess.WHITE else "black"


def validate_opening_move(fen: str, user_move: str, expected_move: str):
    board, parsed_user_move = parse_opening_move(fen, user_move)
    expected_board, parsed_expected_move = parse_opening_move(fen, expected_move)

    if not board or not expected_board:
        return {
            "is_legal": False,
            "is_correct": False,
            "normalized_user_move": user_move,
            "normalized_expected_move": expected_move,
            "message": "Invalid opening position",
            "feedback": "This saved opening position has an invalid FEN.",
        }

    if not parsed_user_move:
        return {
            "is_legal": False,
            "is_correct": False,
            "normalized_user_move": user_move,
            "normalized_expected_move": parsed_expected_move.uci() if parsed_expected_move else expected_move,
            "message": "Illegal move",
            "feedback": "That move is not legal in this opening position.",
        }

    is_correct = parsed_expected_move is not None and parsed_user_move == parsed_expected_move
    expected_san = expected_board.san(parsed_expected_move) if parsed_expected_move else expected_move
    user_san = board.san(parsed_user_move)

    return {
        "is_legal": True,
        "is_correct": is_correct,
        "normalized_user_move": parsed_user_move.uci(),
        "normalized_expected_move": parsed_expected_move.uci() if parsed_expected_move else expected_move,
        "message": "Correct opening move" if is_correct else "Different from repertoire",
        "feedback": (
            f"{user_san} matches your repertoire move."
            if is_correct
            else f"{user_san} is legal, but this line expects {expected_san}."
        ),
    }


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


@router.get("/{opening_id}/practice/session", response_model=OpeningPracticeSessionResponse)
def get_opening_practice_session(
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

    return {
        "opening": opening,
        "lines": lines,
        "progress": get_opening_progress(
            opening_id=opening.id,
            db=db,
            current_user=current_user,
        ),
    }


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

    validation = validate_opening_move(
        fen=line.fen,
        user_move=payload.user_move,
        expected_move=line.best_move,
    )
    is_correct = validation["is_correct"]
    next_line = (
        db.query(OpeningLine)
        .filter(
            OpeningLine.opening_id == opening.id,
            OpeningLine.move_order > line.move_order,
        )
        .order_by(OpeningLine.move_order.asc())
        .first()
    )
    theory_response = None

    if is_correct and next_line:
        user_color = opening.color.lower()
        next_side = side_to_move(next_line.fen)
        if next_side and next_side != user_color:
            theory_response = line_payload(next_line)

    attempt = OpeningPracticeAttempt(
        user_id=current_user.id,
        opening_id=opening.id,
        opening_line_id=line.id,
        user_move=validation["normalized_user_move"],
        is_correct=is_correct,
        time_taken_seconds=payload.time_taken_seconds
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return {
        "id": attempt.id,
        "opening_id": attempt.opening_id,
        "opening_line_id": attempt.opening_line_id,
        "user_move": attempt.user_move,
        "is_correct": attempt.is_correct,
        "is_legal": validation["is_legal"],
        "expected_move": validation["normalized_expected_move"],
        "message": validation["message"],
        "feedback": validation["feedback"],
        "theory_response": theory_response,
        "next_line": line_payload(next_line),
        "time_taken_seconds": attempt.time_taken_seconds,
        "created_at": attempt.created_at,
    }
