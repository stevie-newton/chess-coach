from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MistakeReplayAttemptCreate(BaseModel):
    user_move: str
    time_taken_seconds: Optional[int] = None


class MistakeReplayAttemptResponse(BaseModel):
    id: int
    move_analysis_id: int
    user_move: str
    is_correct: bool
    best_move: Optional[str] = None
    explanation: Optional[str] = None
    time_taken_seconds: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
