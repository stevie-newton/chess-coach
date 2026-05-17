from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.schemas.coach_ai import (
    AskCoachRequest,
    CoachAIResponse,
    ExplainMistakeRequest,
    GameSummaryCoachRequest,
    TournamentAdviceRequest,
    WeeklyImprovementPlanRequest,
)
from app.services.coach_service import generate_coach_feedback
from app.services.openai_coach_service import (
    call_openai_coach,
    game_context,
    move_context,
    user_summary_context,
)


router = APIRouter(
    prefix="/coach",
    tags=["AI Coach"]
)


@router.get("/feedback")
def get_coach_feedback(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return generate_coach_feedback(
        db=db,
        user_id=current_user.id
    )


@router.post("/ask", response_model=CoachAIResponse)
def ask_coach(
    payload: AskCoachRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    context_parts = [user_summary_context(db, current_user.id)]

    if payload.game_id:
        context_parts.append(game_context(db, current_user.id, payload.game_id))

    if payload.move_analysis_id:
        context_parts.append(move_context(db, current_user.id, payload.move_analysis_id))

    answer = call_openai_coach(
        feature="Ask Coach",
        prompt=payload.question,
        context="\n\n".join(context_parts),
        coach_personality=current_user.coach_personality,
    )

    return {"feature": "Ask Coach", "answer": answer}


@router.post("/game-summary", response_model=CoachAIResponse)
def game_summary_coach(
    payload: GameSummaryCoachRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    answer = call_openai_coach(
        feature="Game Summary Coach",
        prompt=(
            "Summarize this analyzed game. Include the result, turning points, "
            "biggest mistakes, best practical lesson, and 3 training takeaways."
        ),
        context=game_context(db, current_user.id, payload.game_id),
        coach_personality=current_user.coach_personality,
    )

    return {"feature": "Game Summary Coach", "answer": answer}


@router.post("/explain-mistake", response_model=CoachAIResponse)
def explain_mistake(
    payload: ExplainMistakeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    answer = call_openai_coach(
        feature="Explain My Mistake",
        prompt=(
            "Explain why the played move was bad, explain the best move in simple words, "
            "and give one practical rule I can use next time."
        ),
        context=move_context(db, current_user.id, payload.move_analysis_id),
        coach_personality=current_user.coach_personality,
    )

    return {"feature": "Explain My Mistake", "answer": answer}


@router.post("/weekly-plan", response_model=CoachAIResponse)
def weekly_improvement_plan(
    payload: WeeklyImprovementPlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    answer = call_openai_coach(
        feature="Weekly Improvement Plan",
        prompt=(
            f"Tell me my biggest weakness this week and create a personalized 7-day training plan. "
            f"Assume {payload.focus_minutes_per_day} minutes per day. Make it practical and specific."
        ),
        context=user_summary_context(db, current_user.id),
        coach_personality=current_user.coach_personality,
    )

    return {"feature": "Weekly Improvement Plan", "answer": answer}


@router.post("/tournament-advice", response_model=CoachAIResponse)
def tournament_advice(
    payload: TournamentAdviceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event_context = "\n".join(
        [
            f"Event: {payload.event_name or 'not specified'}",
            f"Time control: {payload.time_control or 'not specified'}",
            f"Goal: {payload.goal or 'not specified'}",
        ]
    )

    answer = call_openai_coach(
        feature="Tournament Advice",
        prompt=(
            "Give tournament advice based on my weaknesses and goals. Include opening prep, "
            "time management, mindset, and what to review after each game."
        ),
        context=f"{user_summary_context(db, current_user.id)}\n\nTournament request:\n{event_context}",
        coach_personality=current_user.coach_personality,
    )

    return {"feature": "Tournament Advice", "answer": answer}
