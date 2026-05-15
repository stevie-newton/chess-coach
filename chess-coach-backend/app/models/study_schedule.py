from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.core.database import Base


class StudySchedule(Base):
    __tablename__ = "study_schedules"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    day = Column(String, nullable=False)
    focus_area = Column(String, nullable=False)
    activity = Column(String, nullable=False)
    duration_minutes = Column(Integer, default=30)

    completed = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())