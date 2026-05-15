from pydantic import BaseModel, Field
from typing import Optional


class AskCoachRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1200)
    game_id: Optional[int] = None
    move_analysis_id: Optional[int] = None


class GameSummaryCoachRequest(BaseModel):
    game_id: int


class ExplainMistakeRequest(BaseModel):
    move_analysis_id: int


class WeeklyImprovementPlanRequest(BaseModel):
    focus_minutes_per_day: Optional[int] = Field(default=30, ge=10, le=180)


class TournamentAdviceRequest(BaseModel):
    event_name: Optional[str] = Field(default=None, max_length=120)
    time_control: Optional[str] = Field(default=None, max_length=80)
    goal: Optional[str] = Field(default=None, max_length=300)


class CoachAIResponse(BaseModel):
    feature: str
    answer: str
