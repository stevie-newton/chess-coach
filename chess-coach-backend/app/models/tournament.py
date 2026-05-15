from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func

from app.core.database import Base


class TournamentSimulation(Base):
    __tablename__ = "tournament_simulations"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    time_control = Column(String, nullable=False)  # 10+0, 15+10, 30+0
    opponent_style = Column(String, nullable=False)  # aggressive, positional, tactical

    result = Column(String, nullable=True)  # win, loss, draw
    accuracy = Column(Float, nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())