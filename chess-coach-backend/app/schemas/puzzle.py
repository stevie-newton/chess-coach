from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PuzzleResponse(BaseModel):
    id: int
    game_id: int
    move_analysis_id: Optional[int]
    fen: str
    solution: str
    theme: Optional[str]
    difficulty: str
    created_at: datetime

    class Config:
        from_attributes = True


class PuzzleAttemptCreate(BaseModel):
    user_move: str
    time_taken_seconds: Optional[int] = None


class PuzzleAttemptResponse(BaseModel):
    id: int
    puzzle_id: int
    user_move: str
    is_correct: bool
    time_taken_seconds: Optional[int]
    message: str
    feedback: str
    is_legal: bool = True
    best_move: Optional[str] = None
    explanation_source: Optional[str] = None
    explanation: Optional[str] = None
    puzzle_rating: int
    puzzle_streak: int
    spaced_repetition: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True
