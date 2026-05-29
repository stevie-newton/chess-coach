from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.game import Game
from app.models.analysis import MoveAnalysis
from app.services.focus_analysis_service import focus_from_game, focus_note_for_move, is_focus_move
from app.services.stockfish_service import best_move_for_fen
from app.utils.chess_move_utils import parse_uci_move
import chess


router = APIRouter(
    prefix="/board",
    tags=["Chessboard"]
)


class BestMoveRequest(BaseModel):
    fen: str
    level: str = Field(default="coach", pattern="^(calm|sharp|coach)$")


AI_DEPTHS = {
    "calm": 6,
    "sharp": 10,
    "coach": 14,
}


def best_move_san(fen: str | None, best_move: str | None):
    if not fen or not best_move:
        return None

    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(best_move)
        if move not in board.legal_moves:
            return None
        return board.san(move)
    except ValueError:
        return None


def tactical_miss_reason(mistake_type: str | None, best_move_san_value: str | None):
    if mistake_type not in ["inaccuracy", "mistake", "blunder"] or not best_move_san_value:
        return None

    if "#" in best_move_san_value:
        return f"Tactical miss: Stockfish found mate with {best_move_san_value}."

    if "+" in best_move_san_value:
        return f"Tactical miss: {best_move_san_value} was a forcing check."

    if "x" in best_move_san_value:
        return f"Tactical miss: {best_move_san_value} won material."

    return f"Tactical miss: {best_move_san_value} was the critical resource."


def serialize_move_analysis(move: MoveAnalysis, focus: str = "practice"):
    best_san = best_move_san(move.fen_before, move.best_move)
    tactical_reason = tactical_miss_reason(move.mistake_type, best_san)
    focus_note = focus_note_for_move(move, focus)

    return {
        "move_id": move.id,
        "move_number": move.move_number,
        "color": move.color,
        "fen_before": move.fen_before,
        "played_move": move.played_move,
        "played_move_uci": move.played_move_uci,
        "best_move": move.best_move,
        "best_move_san": best_san,
        "evaluation_before": move.evaluation_before,
        "evaluation_after": move.evaluation_after,
        "mistake_type": move.mistake_type,
        "tactical_miss": tactical_reason is not None,
        "tactical_miss_reason": tactical_reason,
        "focus_relevant": is_focus_move(move, focus),
        "focus_note": focus_note,
        "explanation": move.explanation
    }


@router.post("/best-move")
def get_best_move(
    payload: BestMoveRequest,
    current_user: User = Depends(get_current_user)
):
    depth = AI_DEPTHS.get(payload.level, AI_DEPTHS["coach"])
    return best_move_for_fen(payload.fen, depth=depth)


@router.get("/game/{game_id}/positions")
def get_game_positions(
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

    moves = (
        db.query(MoveAnalysis)
        .filter(MoveAnalysis.game_id == game.id)
        .order_by(MoveAnalysis.id.asc())
        .all()
    )

    if not moves:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analyzed positions found. Analyze this game first."
        )

    focus = focus_from_game(game)

    return {
        "game_id": game.id,
        "source": game.source,
        "opponent": game.opponent,
        "color_played": game.color_played,
        "result": game.result,
        "positions": [serialize_move_analysis(move, focus) for move in moves]
    }


@router.get("/game/{game_id}/mistakes")
def get_game_mistake_positions(
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

    mistakes = (
        db.query(MoveAnalysis)
        .filter(
            MoveAnalysis.game_id == game.id,
            MoveAnalysis.mistake_type.in_(["inaccuracy", "mistake", "blunder"])
        )
        .order_by(MoveAnalysis.id.asc())
        .all()
    )

    focus = focus_from_game(game)

    return {
        "game_id": game.id,
        "mistakes": [serialize_move_analysis(move, focus) for move in mistakes]
    }


@router.get("/move/{move_analysis_id}/preview")
def get_move_preview(
    move_analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    move = (
        db.query(MoveAnalysis)
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(
            MoveAnalysis.id == move_analysis_id,
            Game.user_id == current_user.id
        )
        .first()
    )

    if not move:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Move analysis not found"
        )

    focus = focus_from_game(move.game)
    best_san = best_move_san(move.fen_before, move.best_move)
    tactical_reason = tactical_miss_reason(move.mistake_type, best_san)

    return {
        "move_id": move.id,
        "game_id": move.game_id,
        "move_number": move.move_number,
        "color": move.color,
        "fen_before": move.fen_before,
        "played_move": move.played_move,
        "played_move_uci": move.played_move_uci,
        "played_move_preview": parse_uci_move(move.played_move_uci),
        "best_move": move.best_move,
        "best_move_san": best_san,
        "best_move_preview": parse_uci_move(move.best_move),
        "mistake_type": move.mistake_type,
        "tactical_miss": tactical_reason is not None,
        "tactical_miss_reason": tactical_reason,
        "focus_relevant": is_focus_move(move, focus),
        "focus_note": focus_note_for_move(move, focus),
        "evaluation_before": move.evaluation_before,
        "evaluation_after": move.evaluation_after,
        "explanation": move.explanation
    }
