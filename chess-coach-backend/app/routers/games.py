from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.game import Game
from app.schemas.game import GameCreate, GameResponse
from app.services.pgn_service import validate_pgn


router = APIRouter(
    prefix="/games",
    tags=["Games"]
)


@router.post("/upload-pgn", response_model=GameResponse)
def upload_pgn(
    payload: GameCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    validate_pgn(payload.pgn)

    game = Game(
        user_id=current_user.id,
        source=payload.source,
        opponent=payload.opponent,
        color_played=payload.color_played,
        result=payload.result,
        time_control=payload.time_control,
        pgn=payload.pgn
    )

    db.add(game)
    db.commit()
    db.refresh(game)

    return game


@router.get("/", response_model=List[GameResponse])
def get_my_games(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Game)
        .filter(Game.user_id == current_user.id)
        .order_by(Game.created_at.desc())
        .all()
    )


@router.get("/{game_id}", response_model=GameResponse)
def get_game(
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
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )

    return game