from pydantic import BaseModel
from typing import Optional, List


class MoveAnalysisResponse(BaseModel):
    id: int
    move_number: int
    color: str
    fen_before: Optional[str]
    played_move: str
    played_move_uci: Optional[str]
    best_move: Optional[str]
    best_move_san: Optional[str] = None
    evaluation_before: Optional[float]
    evaluation_after: Optional[float]
    mistake_type: Optional[str]
    tactical_miss: bool = False
    tactical_miss_reason: Optional[str] = None
    explanation: Optional[str]

    class Config:
        from_attributes = True


class GameAnalysisResponse(BaseModel):
    id: int
    game_id: int
    accuracy: Optional[float]
    inaccuracies: int
    mistakes: int
    blunders: int
    best_moves_found: int
    moves: List[MoveAnalysisResponse] = []

    class Config:
        from_attributes = True
