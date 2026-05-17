from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.study_schedule import StudySchedule
from app.models.mistake_replay import MistakeReviewState
from app.models.puzzle import PuzzleAttempt
from app.models.weakness import Weakness
from app.services.daily_training_service import (
    build_training_completion_summary,
    detect_daily_training_patterns,
    generate_daily_training_session,
)
from app.services.progression_service import complete_daily_progression
from app.services.post_training_report_service import build_post_training_report
from app.services.skill_profile_service import detect_skill_profile


router = APIRouter(
    prefix="/daily-training",
    tags=["Daily Training"]
)


@router.get("/today")
def get_today_training_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today_name = datetime.now().strftime("%A")
    now = datetime.now(timezone.utc)
    skill_profile = detect_skill_profile(db=db, user=current_user)

    today_schedule = (
        db.query(StudySchedule)
        .filter(
            StudySchedule.user_id == current_user.id,
            StudySchedule.day == today_name
        )
        .order_by(StudySchedule.created_at.desc())
        .first()
    )

    generated_today = False
    detected_patterns = detect_daily_training_patterns(db=db, user_id=current_user.id)

    if not today_schedule:
        today_schedule, detected_patterns = generate_daily_training_session(
            db=db,
            user_id=current_user.id,
            skill_profile=skill_profile,
        )
        generated_today = True

    due_mistakes = (
        db.query(MistakeReviewState)
        .filter(
            MistakeReviewState.user_id == current_user.id,
            MistakeReviewState.due_at <= now
        )
        .count()
    )

    puzzle_attempts = (
        db.query(PuzzleAttempt)
        .filter(PuzzleAttempt.user_id == current_user.id)
        .count()
    )

    puzzle_correct = (
        db.query(PuzzleAttempt)
        .filter(
            PuzzleAttempt.user_id == current_user.id,
            PuzzleAttempt.is_correct == True
        )
        .count()
    )

    puzzle_success_rate = (
        0 if puzzle_attempts == 0
        else round((puzzle_correct / puzzle_attempts) * 100, 2)
    )

    top_weakness = (
        db.query(Weakness)
        .filter(Weakness.user_id == current_user.id)
        .order_by(Weakness.severity.desc(), Weakness.frequency.desc())
        .first()
    )

    return {
        "day": today_name,
        "study_schedule": None if not today_schedule else {
            "id": today_schedule.id,
            "focus_area": today_schedule.focus_area,
            "activity": today_schedule.activity,
            "duration_minutes": today_schedule.duration_minutes,
            "completed": today_schedule.completed,
            "generated_today": generated_today,
        },
        "mistake_replay": {
            "due_now": due_mistakes,
            "recommended": due_mistakes > 0
        },
        "puzzles": {
            "attempts": puzzle_attempts,
            "correct": puzzle_correct,
            "success_rate": puzzle_success_rate
        },
        "priority_focus": None if not top_weakness else {
            "category": top_weakness.category,
            "frequency": top_weakness.frequency,
            "severity": top_weakness.severity
        },
        "skill_profile": skill_profile,
        "detected_patterns": [
            {
                "key": pattern["key"],
                "label": pattern["label"],
                "description": pattern["description"],
                "score": pattern["score"],
            }
            for pattern in detected_patterns
        ],
        "recommended_actions": build_recommended_actions(
            today_schedule=today_schedule,
            due_mistakes=due_mistakes,
            puzzle_success_rate=puzzle_success_rate,
            top_weakness=top_weakness,
            skill_profile=skill_profile,
            detected_patterns=detected_patterns,
        )
    }


@router.post("/complete")
def complete_today_training(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today_name = datetime.now().strftime("%A")
    today_schedule = (
        db.query(StudySchedule)
        .filter(
            StudySchedule.user_id == current_user.id,
            StudySchedule.day == today_name
        )
        .order_by(StudySchedule.created_at.desc())
        .first()
    )

    if not today_schedule:
        skill_profile = detect_skill_profile(db=db, user=current_user)
        today_schedule, _ = generate_daily_training_session(
            db=db,
            user_id=current_user.id,
            skill_profile=skill_profile,
        )

    today_schedule.completed = True
    db.add(today_schedule)
    db.commit()
    db.refresh(today_schedule)

    completion_report = build_training_completion_summary(db=db, user_id=current_user.id)
    progression = complete_daily_progression(
        db=db,
        user=current_user,
        accuracy=completion_report["accuracy"],
    )
    post_training_report = build_post_training_report(
        completion_report=completion_report,
        user=current_user,
    )

    return {
        "study_schedule": {
            "id": today_schedule.id,
            "focus_area": today_schedule.focus_area,
            "activity": today_schedule.activity,
            "duration_minutes": today_schedule.duration_minutes,
            "completed": today_schedule.completed,
        },
        "completion_report": completion_report,
        "post_training_report": post_training_report,
        "progression": progression,
    }


def build_recommended_actions(
    today_schedule,
    due_mistakes: int,
    puzzle_success_rate: float,
    top_weakness,
    skill_profile: dict | None = None,
    detected_patterns: list[dict] | None = None,
):
    actions = []
    detected_patterns = detected_patterns or []

    if today_schedule and not today_schedule.completed:
        actions.append(
            f"Complete today's study: {today_schedule.focus_area} for {today_schedule.duration_minutes} minutes."
        )

    if due_mistakes > 0:
        actions.append(
            f"Replay {due_mistakes} due mistake position(s) using spaced repetition."
        )

    if puzzle_success_rate < 70:
        actions.append(
            "Solve personalized puzzles and repeat failed ones."
        )

    if top_weakness:
        actions.append(
            f"Focus on your biggest weakness: {top_weakness.category}."
        )

    if detected_patterns:
        top_pattern = detected_patterns[0]
        actions.append(
            f"AI adaptation: today's session targets {top_pattern['label'].lower()} from recent game patterns."
        )

    if skill_profile:
        actions.append(
            (
                f"Session difficulty is tuned for {skill_profile['detected_level'].lower()} level: "
                f"{skill_profile['adaptation']['puzzle_difficulty']}."
            )
        )

    return actions
