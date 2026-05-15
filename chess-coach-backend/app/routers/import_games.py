from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.schemas.import_games import ImportGamesRequest
from app.services.import_service import import_chesscom_games, import_lichess_games

router = APIRouter(prefix="/import", tags=["import"])


@router.post("/games")
async def import_games(
    request: ImportGamesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import games from Chess.com or Lichess
    """
    try:
        if request.platform.lower() == "chesscom":
            games = import_chesscom_games(
                db=db,
                user_id=current_user.id,
                username=request.username,
                max_games=request.max_games
            )
        elif request.platform.lower() == "lichess":
            games = import_lichess_games(
                db=db,
                user_id=current_user.id,
                username=request.username,
                max_games=request.max_games
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Platform must be 'chesscom' or 'lichess'"
            )

        return {
            "message": f"Successfully imported {len(games)} games",
            "games": [
                {
                    "id": game.id,
                    "source": game.source,
                    "opponent": game.opponent,
                    "color_played": game.color_played,
                    "result": game.result,
                    "time_control": game.time_control
                }
                for game in games
            ]
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import games: {str(e)}"
        )