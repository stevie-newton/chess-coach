from sqlalchemy import Boolean, Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    chess_level = Column(String, nullable=True)
    target_rating = Column(Integer, nullable=True)
    chesscom_username = Column(String, nullable=True)
    lichess_username = Column(String, nullable=True)
    is_email_verified = Column(Boolean, nullable=False, default=True)
    email_verification_token_hash = Column(String, nullable=True)
    email_verification_expires_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
