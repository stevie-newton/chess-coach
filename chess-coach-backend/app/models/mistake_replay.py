from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.core.database import Base


class MistakeReplayAttempt(Base):
    __tablename__ = "mistake_replay_attempts"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    move_analysis_id = Column(Integer, ForeignKey("move_analyses.id"), nullable=False)

    user_move = Column(String, nullable=False)
    is_correct = Column(Boolean, default=False)

    time_taken_seconds = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MistakeReviewState(Base):
    __tablename__ = "mistake_review_states"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    move_analysis_id = Column(Integer, ForeignKey("move_analyses.id"), nullable=False)

    ease_factor = Column(Integer, default=250)
    interval_days = Column(Integer, default=1)
    repetitions = Column(Integer, default=0)

    due_at = Column(DateTime(timezone=True), server_default=func.now())

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())