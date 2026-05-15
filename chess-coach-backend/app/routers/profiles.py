from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_dependency import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.import_games import ImportGamesRequest
from app.schemas.user import ConnectedProfilesUpdate, UserResponse
from app.services.import_service import import_chesscom_games, import_lichess_games


router = APIRouter(prefix="/profiles", tags=["profiles"])


def clean_username(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    return cleaned or None


@router.get("/connected", response_model=UserResponse)
def get_connected_profiles(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.put("/connected", response_model=UserResponse)
def update_connected_profiles(
    payload: ConnectedProfilesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.chesscom_username = clean_username(payload.chesscom_username)
    current_user.lichess_username = clean_username(payload.lichess_username)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/import")
def import_from_connected_profile(
    request: ImportGamesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    platform = request.platform.lower()

    if platform == "chesscom":
        username = clean_username(request.username) or current_user.chesscom_username
        importer = import_chesscom_games
    elif platform == "lichess":
        username = clean_username(request.username) or current_user.lichess_username
        importer = import_lichess_games
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Platform must be 'chesscom' or 'lichess'",
        )

    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connect a {platform} username before importing games.",
        )

    games = importer(
        db=db,
        user_id=current_user.id,
        username=username,
        max_games=request.max_games,
    )

    return {
        "message": f"Successfully imported {len(games)} games",
        "username": username,
        "platform": platform,
        "games": [
            {
                "id": game.id,
                "source": game.source,
                "opponent": game.opponent,
                "color_played": game.color_played,
                "result": game.result,
                "time_control": game.time_control,
            }
            for game in games
        ],
    }
