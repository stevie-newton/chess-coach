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
    variation_name: Optional[str] = None
    difficulty: str = "medium"


class OpeningLineResponse(BaseModel):
    id: int
    opening_id: int
    move_order: int
    fen: str
    best_move: str
    explanation: Optional[str]
    variation_name: Optional[str]
    difficulty: str
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
    is_legal: bool = True
    expected_move: Optional[str] = None
    message: str = "Saved"
    feedback: str = "Opening practice attempt saved."
    theory_response: Optional[dict] = None
    next_line: Optional[dict] = None
    time_taken_seconds: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class OpeningPracticeSessionResponse(BaseModel):
    opening: OpeningResponse
    lines: list[OpeningLineResponse]
    progress: OpeningProgressResponse


class OpeningProgressWeakLine(BaseModel):
    opening_line_id: int
    move_order: int
    variation_name: Optional[str]
    best_move: str
    difficulty: str
    attempts: int
    misses: int
    last_user_move: Optional[str] = None


class OpeningProgressResponse(BaseModel):
    opening_id: int
    opening_name: str
    known_percent: float
    total_lines: int
    mastered_lines: int
    attempted_lines: int
    total_attempts: int
    correct_attempts: int
    weak_lines: list[OpeningProgressWeakLine]
    summary: str
    focus: Optional[str] = None
