from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import chess

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.game import Game
from app.models.analysis import GameAnalysis, MoveAnalysis
from app.services.game_analysis_service import analyze_game_and_save
from app.services.focus_analysis_service import build_focused_review, focus_from_game, focus_note_for_move, is_focus_move
from app.services.puzzle_service import generate_puzzles_from_game, personalized_training_focus


router = APIRouter(
    prefix="/analysis",
    tags=["Analysis"]
)


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
        "id": move.id,
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
        "explanation": move.explanation,
    }


def player_color_for_game(game: Game) -> str | None:
    if not game.color_played:
        return None

    color = game.color_played.strip().lower()
    return color if color in {"white", "black"} else None


def moves_for_player(game: Game, moves: list[MoveAnalysis]) -> list[MoveAnalysis]:
    player_color = player_color_for_game(game)
    if not player_color:
        return moves

    return [move for move in moves if move.color == player_color]


@router.post("/{game_id}")
def analyze_game(
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

    analysis = analyze_game_and_save(
        db=db,
        user_id=current_user.id,
        game=game
    )
    moves = (
        db.query(MoveAnalysis)
        .filter(MoveAnalysis.game_id == game.id)
        .order_by(MoveAnalysis.id.asc())
        .all()
    )
    generated_puzzles = generate_puzzles_from_game(
        db=db,
        user_id=current_user.id,
        game=game
    )
    focus = personalized_training_focus(
        db=db,
        user_id=current_user.id
    )

    player_moves = moves_for_player(game, moves)

    return {
        "message": "Game analyzed successfully",
        "game_id": game.id,
        "accuracy": analysis.accuracy,
        "inaccuracies": analysis.inaccuracies,
        "mistakes": analysis.mistakes,
        "blunders": analysis.blunders,
        "best_moves_found": analysis.best_moves_found,
        "generated_puzzles": len(generated_puzzles),
        "personalized_training_focus": focus,
        "focused_review": build_focused_review(game, player_moves),
    }


@router.get("/{game_id}")
def get_analysis(
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

    analysis = (
        db.query(GameAnalysis)
        .filter(GameAnalysis.game_id == game.id)
        .first()
    )

    moves = (
        db.query(MoveAnalysis)
        .filter(MoveAnalysis.game_id == game.id)
        .order_by(MoveAnalysis.id.asc())
        .all()
    )

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found"
        )

    player_color = player_color_for_game(game)
    if player_color and any(move.color != player_color for move in moves):
        analysis = analyze_game_and_save(
            db=db,
            user_id=current_user.id,
            game=game
        )
        moves = (
            db.query(MoveAnalysis)
            .filter(MoveAnalysis.game_id == game.id)
            .order_by(MoveAnalysis.id.asc())
            .all()
        )

    focus = focus_from_game(game)
    player_moves = moves_for_player(game, moves)

    return {
        "id": analysis.id,
        "game_id": game.id,
        "accuracy": analysis.accuracy,
        "inaccuracies": analysis.inaccuracies,
        "mistakes": analysis.mistakes,
        "blunders": analysis.blunders,
        "best_moves_found": analysis.best_moves_found,
        "focused_review": build_focused_review(game, player_moves),
        "moves": [serialize_move_analysis(move, focus) for move in player_moves]
    }
