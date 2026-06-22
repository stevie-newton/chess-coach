from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.game import Game
from app.models.analysis import GameAnalysis, MoveAnalysis
from app.models.weakness import Weakness
from app.models.training import TrainingSession
from app.models.puzzle import PuzzleAttempt
from app.models.tournament import TournamentSimulation
from app.models.user import User
from app.services.skill_profile_service import detect_skill_profile
from app.utils.player_move_scope import player_move_scope_filter


def generate_coach_feedback(db: Session, user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    skill_profile = detect_skill_profile(db=db, user=user) if user else None

    analyzed_games = (
        db.query(GameAnalysis)
        .join(Game, Game.id == GameAnalysis.game_id)
        .filter(Game.user_id == user_id)
        .count()
    )

    avg_accuracy = (
        db.query(func.avg(GameAnalysis.accuracy))
        .join(Game, Game.id == GameAnalysis.game_id)
        .filter(Game.user_id == user_id)
        .scalar()
    ) or 0

    total_blunders = (
        db.query(MoveAnalysis)
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(
            Game.user_id == user_id,
            player_move_scope_filter(),
            MoveAnalysis.mistake_type == "blunder"
        )
        .count()
    )

    top_weakness = (
        db.query(Weakness)
        .filter(Weakness.user_id == user_id)
        .order_by(Weakness.severity.desc(), Weakness.frequency.desc())
        .first()
    )

    training_total = (
        db.query(TrainingSession)
        .filter(TrainingSession.user_id == user_id)
        .count()
    )

    training_completed = (
        db.query(TrainingSession)
        .filter(
            TrainingSession.user_id == user_id,
            TrainingSession.completed == True
        )
        .count()
    )

    puzzle_attempts = (
        db.query(PuzzleAttempt)
        .filter(PuzzleAttempt.user_id == user_id)
        .count()
    )

    puzzle_correct = (
        db.query(PuzzleAttempt)
        .filter(
            PuzzleAttempt.user_id == user_id,
            PuzzleAttempt.is_correct == True
        )
        .count()
    )

    tournament_games = (
        db.query(TournamentSimulation)
        .filter(TournamentSimulation.user_id == user_id)
        .count()
    )

    tournament_wins = (
        db.query(TournamentSimulation)
        .filter(
            TournamentSimulation.user_id == user_id,
            TournamentSimulation.result == "win"
        )
        .count()
    )

    puzzle_success_rate = (
        0 if puzzle_attempts == 0
        else round((puzzle_correct / puzzle_attempts) * 100, 2)
    )

    training_completion_rate = (
        0 if training_total == 0
        else round((training_completed / training_total) * 100, 2)
    )

    tournament_win_rate = (
        0 if tournament_games == 0
        else round((tournament_wins / tournament_games) * 100, 2)
    )

    feedback = []

    if analyzed_games == 0:
        feedback.append(
            "Start by uploading and analyzing at least 3 of your recent games. Your improvement plan will become much more accurate after that."
        )

    if avg_accuracy < 60 and analyzed_games > 0:
        feedback.append(
            "Your average accuracy is still low. Focus first on avoiding one-move blunders and checking if your pieces are attacked before every move."
        )
    elif avg_accuracy < 75 and analyzed_games > 0:
        feedback.append(
            "Your accuracy is improving, but you still need stronger consistency. Spend more time on candidate moves before committing."
        )
    elif avg_accuracy >= 75:
        feedback.append(
            "Your accuracy is becoming solid. Start focusing more on strategic plans, endgames, and tournament time control discipline."
        )

    if total_blunders >= 5:
        feedback.append(
            "You are losing too many positions through blunders. Before every move, ask: checks, captures, threats. This should become automatic."
        )

    if top_weakness:
        feedback.append(
            f"Your biggest weakness right now is: {top_weakness.category}. Make this your main training focus this week."
        )

    if training_total > 0 and training_completion_rate < 70:
        feedback.append(
            "You are not completing enough training sessions. A simple 30-minute daily routine is better than long inconsistent sessions."
        )

    if puzzle_attempts > 0 and puzzle_success_rate < 70:
        feedback.append(
            "Your puzzle score shows that tactical vision needs work. Repeat failed puzzles instead of only solving new ones."
        )

    if tournament_games > 0 and tournament_win_rate < 50:
        feedback.append(
            "Your tournament simulation results show pressure issues. Practice slower games and write a short note after every loss."
        )

    if not feedback:
        feedback.append(
            "You are on the right path. Keep analyzing your games, solving personalized puzzles, and reviewing your opening repertoire every week."
        )

    if skill_profile:
        feedback.insert(
            0,
            (
                f"Detected level: {skill_profile['detected_level']} "
                f"({skill_profile['confidence'].lower()} confidence). "
                f"I will adapt with {skill_profile['adaptation']['puzzle_difficulty'].lower()} and "
                f"{skill_profile['adaptation']['coaching_language'].lower()}."
            )
        )

    return {
        "average_accuracy": round(avg_accuracy, 2),
        "total_blunders": total_blunders,
        "training_completion_rate": training_completion_rate,
        "puzzle_success_rate": puzzle_success_rate,
        "tournament_win_rate": tournament_win_rate,
        "skill_profile": skill_profile,
        "coach_feedback": feedback
    }
