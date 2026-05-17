from pydantic import BaseModel
from typing import Optional


class CalculationDrillResponse(BaseModel):
    key: str
    title: str
    theme: str
    difficulty: str
    start_fen: str
    blind_after_seconds: int
    prompt: str
    preview_moves: list[str]
    preview_san: list[str]
    position_fen: str


class CalculationAttemptRequest(BaseModel):
    user_move: str


class CalculationAttemptResponse(BaseModel):
    key: str
    is_legal: bool
    is_correct: bool
    user_move: str
    best_move: str
    best_move_san: Optional[str] = None
    message: str
    feedback: str
    visualization_score: int
    calculation_depth: int
    missed_tactic: Optional[str] = None
    progression: Optional[dict] = None
