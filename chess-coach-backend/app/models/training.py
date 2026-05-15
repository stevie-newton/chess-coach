from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.core.database import Base


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    focus_area = Column(String, nullable=False)
    activity = Column(String, nullable=False)
    duration_minutes = Column(Integer, default=15)

    completed = Column(Boolean, default=False)
    score = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())