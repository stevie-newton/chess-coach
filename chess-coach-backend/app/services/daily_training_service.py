from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.analysis import GameAnalysis
from app.models.opening import Opening, OpeningLine, OpeningPracticeAttempt
from app.models.puzzle import PuzzleAttempt
from app.models.analysis import MoveAnalysis
from app.models.game import Game
from app.models.study_schedule import StudySchedule
from app.models.weakness import Weakness


def _count_mistakes(db: Session, user_id: int, *filters) -> int:
    return (
        db.query(func.count(MoveAnalysis.id))
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(
            Game.user_id == user_id,
            MoveAnalysis.mistake_type.in_(["inaccuracy", "mistake", "blunder"]),
            *filters,
        )
        .scalar()
    ) or 0


def detect_daily_training_patterns(db: Session, user_id: int) -> list[dict]:
    queen_blunders = _count_mistakes(
        db,
        user_id,
        MoveAnalysis.mistake_type == "blunder",
        MoveAnalysis.played_move.ilike("%Q%"),
    )
    weak_endgames = _count_mistakes(db, user_id, MoveAnalysis.move_number >= 30)
    poor_opening_development = _count_mistakes(db, user_id, MoveAnalysis.move_number <= 10)

    weakness_rows = (
        db.query(Weakness)
        .filter(Weakness.user_id == user_id)
        .order_by(Weakness.severity.desc(), Weakness.frequency.desc())
        .limit(5)
        .all()
    )

    for weakness in weakness_rows:
        category = weakness.category.lower()
        if "endgame" in category:
            weak_endgames += weakness.frequency
        if "opening" in category:
            poor_opening_development += weakness.frequency
        if "queen" in category:
            queen_blunders += weakness.frequency

    patterns = [
        {
            "key": "queen_safety",
            "label": "Queen safety",
            "description": "Recent analysis shows queen moves or queen exposure are costing material.",
            "score": queen_blunders,
            "focus_area": "Queen safety and loose-piece checks",
            "activity": (
                "Spend 10 minutes reviewing queen blunders, then solve tactics where the first task is to ask "
                "whether your queen or any loose piece can be attacked."
            ),
        },
        {
            "key": "endgames",
            "label": "Weak endgames",
            "description": "Late-game mistakes are showing up often in analyzed games.",
            "score": weak_endgames,
            "focus_area": "Endgame technique",
            "activity": (
                "Practice king activity, pawn races, and rook-endgame basics, then replay one late-game mistake "
                "and write the safer plan."
            ),
        },
        {
            "key": "opening_development",
            "label": "Opening development",
            "description": "Early mistakes suggest pieces are not developing cleanly or the king is staying unsafe.",
            "score": poor_opening_development,
            "focus_area": "Opening development",
            "activity": (
                "Review the first 10 moves from recent games, mark undeveloped pieces, then drill simple opening "
                "principles before solving two opening-position puzzles."
            ),
        },
    ]

    active_patterns = [pattern for pattern in patterns if pattern["score"] > 0]
    return sorted(active_patterns, key=lambda pattern: pattern["score"], reverse=True)


def duration_for_daily_session(skill_profile: dict, top_pattern: dict | None) -> int:
    base_duration = {
        "Beginner": 20,
        "Intermediate": 30,
        "Advanced": 40,
    }.get(skill_profile.get("detected_level"), 25)

    if top_pattern and top_pattern["score"] >= 6:
        return base_duration + 10

    return base_duration


def generate_daily_training_session(db: Session, user_id: int, skill_profile: dict) -> tuple[StudySchedule, list[dict]]:
    today_name = datetime.now().strftime("%A")
    patterns = detect_daily_training_patterns(db=db, user_id=user_id)
    top_pattern = patterns[0] if patterns else None

    focus_area = top_pattern["focus_area"] if top_pattern else "Balanced daily training"
    activity = (
        top_pattern["activity"]
        if top_pattern
        else "Solve a short tactics set, replay one recent mistake, and review one opening line."
    )

    session = StudySchedule(
        user_id=user_id,
        day=today_name,
        focus_area=focus_area,
        activity=activity,
        duration_minutes=duration_for_daily_session(skill_profile=skill_profile, top_pattern=top_pattern),
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return session, patterns


def _label_from_score(score: float) -> str:
    if score >= 80:
        return "Strong"
    if score >= 60:
        return "Good"
    if score >= 40:
        return "Needs Work"
    return "Weak"


def build_training_completion_summary(db: Session, user_id: int) -> dict:
    avg_accuracy = (
        db.query(func.avg(GameAnalysis.accuracy))
        .join(Game, Game.id == GameAnalysis.game_id)
        .filter(Game.user_id == user_id)
        .scalar()
    ) or 0

    puzzle_attempts = db.query(PuzzleAttempt).filter(PuzzleAttempt.user_id == user_id).count()
    puzzle_correct = (
        db.query(PuzzleAttempt)
        .filter(PuzzleAttempt.user_id == user_id, PuzzleAttempt.is_correct == True)
        .count()
    )
    tactics_score = 50 if puzzle_attempts == 0 else round((puzzle_correct / puzzle_attempts) * 100, 2)

    opening_lines = (
        db.query(OpeningLine)
        .join(Opening, Opening.id == OpeningLine.opening_id)
        .filter(Opening.user_id == user_id)
        .count()
    )
    opening_attempts = db.query(OpeningPracticeAttempt).filter(OpeningPracticeAttempt.user_id == user_id).count()
    opening_correct = (
        db.query(OpeningPracticeAttempt)
        .filter(OpeningPracticeAttempt.user_id == user_id, OpeningPracticeAttempt.is_correct == True)
        .count()
    )
    opening_score = (
        min(100, opening_lines * 10)
        if opening_attempts == 0
        else round((opening_correct / opening_attempts) * 100, 2)
    )

    endgame_weakness = (
        db.query(func.coalesce(func.sum(Weakness.severity + Weakness.frequency), 0))
        .filter(
            Weakness.user_id == user_id,
            Weakness.category.ilike("%endgame%"),
        )
        .scalar()
    ) or 0
    endgame_score = max(20, 85 - (endgame_weakness * 6))

    accuracy = round(
        (avg_accuracy * 0.35)
        + (tactics_score * 0.3)
        + (opening_score * 0.2)
        + (endgame_score * 0.15)
    )

    category_scores = {
        "tactics": {
            "score": round(tactics_score),
            "label": _label_from_score(tactics_score),
        },
        "openings": {
            "score": round(opening_score),
            "label": _label_from_score(opening_score),
        },
        "endgames": {
            "score": round(endgame_score),
            "label": _label_from_score(endgame_score),
        },
    }

    return {
        "title": "Training Complete",
        "accuracy": accuracy,
        "categories": category_scores,
        "summary_lines": [
            f"Accuracy: {accuracy}%",
            f"Tactics: {category_scores['tactics']['label']}",
            f"Openings: {category_scores['openings']['label']}",
            f"Endgames: {category_scores['endgames']['label']}",
        ],
        "next_focus": min(category_scores.items(), key=lambda item: item[1]["score"])[0],
    }
