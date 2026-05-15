from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class GameAnalysis(Base):
    __tablename__ = "game_analyses"

    id = Column(Integer, primary_key=True, index=True)

    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)

    accuracy = Column(Float, nullable=True)
    inaccuracies = Column(Integer, default=0)
    mistakes = Column(Integer, default=0)
    blunders = Column(Integer, default=0)
    best_moves_found = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    game = relationship("Game")


class MoveAnalysis(Base):
    __tablename__ = "move_analyses"

    id = Column(Integer, primary_key=True, index=True)

    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)

    move_number = Column(Integer, nullable=False)
    color = Column(String, nullable=False)

    fen_before = Column(String, nullable=True)

    played_move = Column(String, nullable=False)
    played_move_uci = Column(String, nullable=True)
    best_move = Column(String, nullable=True)

    evaluation_before = Column(Float, nullable=True)
    evaluation_after = Column(Float, nullable=True)

    mistake_type = Column(String, nullable=True)
    explanation = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    game = relationship("Game")