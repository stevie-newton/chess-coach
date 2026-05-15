from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TrainingSessionResponse(BaseModel):
    id: int
    focus_area: str
    activity: str
    duration_minutes: int
    completed: bool
    score: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class CompleteTrainingRequest(BaseModel):
    score: Optional[int] = None