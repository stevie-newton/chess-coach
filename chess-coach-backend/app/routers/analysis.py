from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.game import Game
from app.models.analysis import GameAnalysis, MoveAnalysis
from app.services.game_analysis_service import analyze_game_and_save


router = APIRouter(
    prefix="/analysis",
    tags=["Analysis"]
)


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

    return {
        "message": "Game analyzed successfully",
        "game_id": game.id,
        "accuracy": analysis.accuracy,
        "inaccuracies": analysis.inaccuracies,
        "mistakes": analysis.mistakes,
        "blunders": analysis.blunders,
        "best_moves_found": analysis.best_moves_found
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

    return {
        "id": analysis.id,
        "game_id": game.id,
        "accuracy": analysis.accuracy,
        "inaccuracies": analysis.inaccuracies,
        "mistakes": analysis.mistakes,
        "blunders": analysis.blunders,
        "best_moves_found": analysis.best_moves_found,
        "moves": moves
    }