from pydantic import BaseModel
from typing import Optional


class EndgameTemplateResponse(BaseModel):
    key: str
    title: str
    category: str
    goal: str
    max_moves: int
    start_fen: str
    user_color: str
    difficulty: str
    description: str


class EndgameMoveRequest(BaseModel):
    ply_index: int = 0
    user_move: str
    mistakes: int = 0


class EndgameMoveResponse(BaseModel):
    key: str
    is_legal: bool
    is_correct: bool
    message: str
    feedback: str
    precision: int
    efficiency: int
    mistakes: int
    user_move: str
    expected_move: str
    ai_reply: Optional[dict] = None
    next_ply_index: int
    fen: str
    completed: bool
    goal: str
    progression: Optional[dict] = None
