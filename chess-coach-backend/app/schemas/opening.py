from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class OpeningCreate(BaseModel):
    name: str
    color: str
    starting_moves: str
    notes: Optional[str] = None


class OpeningResponse(BaseModel):
    id: int
    name: str
    color: str
    starting_moves: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class OpeningLineCreate(BaseModel):
    move_order: int
    fen: str
    best_move: str
    explanation: Optional[str] = None


class OpeningLineResponse(BaseModel):
    id: int
    opening_id: int
    move_order: int
    fen: str
    best_move: str
    explanation: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class OpeningPracticeAttemptCreate(BaseModel):
    user_move: str
    time_taken_seconds: Optional[int] = None


class OpeningPracticeAttemptResponse(BaseModel):
    id: int
    opening_id: int
    opening_line_id: int
    user_move: str
    is_correct: bool
    time_taken_seconds: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True