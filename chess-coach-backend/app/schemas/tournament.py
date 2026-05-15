from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TournamentSimulationCreate(BaseModel):
    time_control: str
    opponent_style: str
    notes: Optional[str] = None


class TournamentSimulationUpdate(BaseModel):
    result: Optional[str] = None
    accuracy: Optional[float] = None
    notes: Optional[str] = None


class TournamentSimulationResponse(BaseModel):
    id: int
    time_control: str
    opponent_style: str
    result: Optional[str]
    accuracy: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True