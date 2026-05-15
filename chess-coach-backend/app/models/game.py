from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    source = Column(String, nullable=True)  # chess.com, lichess, manual
    opponent = Column(String, nullable=True)
    color_played = Column(String, nullable=True)  # white or black
    result = Column(String, nullable=True)  # win, loss, draw
    time_control = Column(String, nullable=True)

    pgn = Column(Text, nullable=False)

    played_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")