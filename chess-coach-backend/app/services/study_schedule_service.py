from sqlalchemy.orm import Session

from app.models.study_schedule import StudySchedule
from app.models.weakness import Weakness


def generate_weekly_schedule(db: Session, user_id: int):
    top_weakness = (
        db.query(Weakness)
        .filter(Weakness.user_id == user_id)
        .order_by(Weakness.severity.desc(), Weakness.frequency.desc())
        .first()
    )

    weakness_focus = top_weakness.category if top_weakness else "tactics"

    weekly_plan = [
        {
            "day": "Monday",
            "focus_area": "tactics",
            "activity": "Solve tactical puzzles: forks, pins, skewers, and hanging pieces.",
            "duration_minutes": 30
        },
        {
            "day": "Tuesday",
            "focus_area": "opening repertoire",
            "activity": "Practice your main opening line for White and one response for Black.",
            "duration_minutes": 30
        },
        {
            "day": "Wednesday",
            "focus_area": weakness_focus,
            "activity": f"Train your current biggest weakness: {weakness_focus}. Review mistakes from recent games.",
            "duration_minutes": 35
        },
        {
            "day": "Thursday",
            "focus_area": "endgame",
            "activity": "Practice king and pawn endgames, rook endgames, and basic checkmates.",
            "duration_minutes": 30
        },
        {
            "day": "Friday",
            "focus_area": "game review",
            "activity": "Analyze one full game and write down your 3 worst moves.",
            "duration_minutes": 40
        },
        {
            "day": "Saturday",
            "focus_area": "tournament simulation",
            "activity": "Play a timed game against an engine or friend with tournament conditions.",
            "duration_minutes": 45
        },
        {
            "day": "Sunday",
            "focus_area": "rest and review",
            "activity": "Light review of the week's progress and plan for next week.",
            "duration_minutes": 20
        }
    ]

    schedule_items = []
    for item in weekly_plan:
        schedule = StudySchedule(
            user_id=user_id,
            day=item["day"],
            focus_area=item["focus_area"],
            activity=item["activity"],
            duration_minutes=item["duration_minutes"]
        )
        db.add(schedule)
        schedule_items.append(schedule)

    db.commit()
    for item in schedule_items:
        db.refresh(item)

    return schedule_items