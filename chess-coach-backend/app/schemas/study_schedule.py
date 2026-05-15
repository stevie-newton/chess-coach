from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class StudyScheduleCreate(BaseModel):
    day: str
    focus_area: str
    activity: str
    duration_minutes: int = 30


class StudyScheduleResponse(BaseModel):
    id: int
    day: str
    focus_area: str
    activity: str
    duration_minutes: int
    completed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StudyScheduleUpdate(BaseModel):
    completed: Optional[bool] = None