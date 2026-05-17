from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=256)
    chess_level: Optional[str] = None
    target_rating: Optional[int] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    chess_level: Optional[str]
    target_rating: Optional[int]
    chesscom_username: Optional[str] = None
    lichess_username: Optional[str] = None
    coach_personality: str = "friendly"
    xp_points: int = 0
    training_level: int = 1
    training_streak: int = 0
    endgame_completions: int = 0
    calculation_completions: int = 0
    is_email_verified: bool = True

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ConnectedProfilesUpdate(BaseModel):
    chesscom_username: Optional[str] = Field(default=None, max_length=80)
    lichess_username: Optional[str] = Field(default=None, max_length=80)


class CoachSettingsUpdate(BaseModel):
    coach_personality: str = Field(default="friendly", max_length=40)


class EmailVerificationResend(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    detail: str
