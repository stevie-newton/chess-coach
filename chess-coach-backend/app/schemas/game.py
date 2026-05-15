from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class GameCreate(BaseModel):
    source: Optional[str] = "manual"
    opponent: Optional[str] = None
    color_played: Optional[str] = None
    result: Optional[str] = None
    time_control: Optional[str] = None
    pgn: str


class GameResponse(BaseModel):
    id: int
    source: Optional[str]
    opponent: Optional[str]
    color_played: Optional[str]
    result: Optional[str]
    time_control: Optional[str]
    pgn: str
    played_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True