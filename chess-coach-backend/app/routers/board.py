from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.game import Game
from app.models.analysis import MoveAnalysis
from app.utils.chess_move_utils import parse_uci_move


router = APIRouter(
    prefix="/board",
    tags=["Chessboard"]
)


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

    return {
        "game_id": game.id,
        "source": game.source,
        "opponent": game.opponent,
        "color_played": game.color_played,
        "result": game.result,
        "positions": [
            {
                "move_id": move.id,
                "move_number": move.move_number,
                "color": move.color,
                "fen_before": move.fen_before,
                "played_move": move.played_move,
                "played_move_uci": move.played_move_uci,
                "best_move": move.best_move,
                "evaluation_before": move.evaluation_before,
                "evaluation_after": move.evaluation_after,
                "mistake_type": move.mistake_type,
                "explanation": move.explanation
            }
            for move in moves
        ]
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

    return {
        "game_id": game.id,
        "mistakes": [
            {
                "move_id": move.id,
                "move_number": move.move_number,
                "color": move.color,
                "fen_before": move.fen_before,
                "played_move": move.played_move,
                "played_move_uci": move.played_move_uci,
                "best_move": move.best_move,
                "evaluation_before": move.evaluation_before,
                "evaluation_after": move.evaluation_after,
                "mistake_type": move.mistake_type,
                "explanation": move.explanation
            }
            for move in mistakes
        ]
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
        "best_move_preview": parse_uci_move(move.best_move),
        "mistake_type": move.mistake_type,
        "evaluation_before": move.evaluation_before,
        "evaluation_after": move.evaluation_after,
        "explanation": move.explanation
    }
