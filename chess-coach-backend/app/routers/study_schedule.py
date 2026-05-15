from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.study_schedule import StudySchedule
from app.schemas.study_schedule import (
    StudyScheduleCreate,
    StudyScheduleResponse,
    StudyScheduleUpdate
)
from app.services.study_schedule_service import generate_weekly_schedule


router = APIRouter(
    prefix="/study-schedule",
    tags=["Study Schedule"]
)


@router.post("/generate-weekly", response_model=List[StudyScheduleResponse])
def create_weekly_study_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return generate_weekly_schedule(
        db=db,
        user_id=current_user.id
    )


@router.post("/", response_model=StudyScheduleResponse)
def create_custom_study_item(
    payload: StudyScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    schedule = StudySchedule(
        user_id=current_user.id,
        day=payload.day,
        focus_area=payload.focus_area,
        activity=payload.activity,
        duration_minutes=payload.duration_minutes
    )

    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    return schedule


@router.get("/", response_model=List[StudyScheduleResponse])
def get_my_study_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(StudySchedule)
        .filter(StudySchedule.user_id == current_user.id)
        .order_by(StudySchedule.id.asc())
        .all()
    )


@router.patch("/{schedule_id}", response_model=StudyScheduleResponse)
def update_study_schedule_item(
    schedule_id: int,
    payload: StudyScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    schedule = (
        db.query(StudySchedule)
        .filter(
            StudySchedule.id == schedule_id,
            StudySchedule.user_id == current_user.id
        )
        .first()
    )

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study schedule item not found"
        )

    if payload.completed is not None:
        schedule.completed = payload.completed

    db.commit()
    db.refresh(schedule)

    return schedule