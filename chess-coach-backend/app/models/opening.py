from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func

from app.core.database import Base


class Opening(Base):
    __tablename__ = "openings"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    name = Column(String, nullable=False)
    color = Column(String, nullable=False)  # white or black
    starting_moves = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OpeningLine(Base):
    __tablename__ = "opening_lines"

    id = Column(Integer, primary_key=True, index=True)

    opening_id = Column(Integer, ForeignKey("openings.id"), nullable=False)

    move_order = Column(Integer, nullable=False)
    fen = Column(Text, nullable=False)
    best_move = Column(String, nullable=False)
    explanation = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OpeningPracticeAttempt(Base):
    __tablename__ = "opening_practice_attempts"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    opening_id = Column(Integer, ForeignKey("openings.id"), nullable=False)
    opening_line_id = Column(Integer, ForeignKey("opening_lines.id"), nullable=False)

    user_move = Column(String, nullable=False)
    is_correct = Column(Boolean, default=False)

    time_taken_seconds = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())