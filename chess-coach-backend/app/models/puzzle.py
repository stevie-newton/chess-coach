from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func

from app.core.database import Base


class Puzzle(Base):
    __tablename__ = "puzzles"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)
    move_analysis_id = Column(Integer, ForeignKey("move_analyses.id"), nullable=True)

    fen = Column(Text, nullable=False)
    solution = Column(String, nullable=False)
    theme = Column(String, nullable=True)
    difficulty = Column(String, default="medium")

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PuzzleAttempt(Base):
    __tablename__ = "puzzle_attempts"

    id = Column(Integer, primary_key=True, index=True)

    puzzle_id = Column(Integer, ForeignKey("puzzles.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    user_move = Column(String, nullable=False)
    is_correct = Column(Boolean, default=False)
    time_taken_seconds = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())