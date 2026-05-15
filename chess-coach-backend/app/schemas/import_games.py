from pydantic import BaseModel
from typing import Optional


class ImportGamesRequest(BaseModel):
    platform: str  # chesscom or lichess
    username: str
    max_games: int = 5
    color_played: Optional[str] = None
    auto_analyze: bool = False

    class Config:
        from_attributes = True