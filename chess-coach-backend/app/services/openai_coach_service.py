import chess
import requests
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.analysis import GameAnalysis, MoveAnalysis
from app.models.game import Game
from app.models.puzzle import PuzzleAttempt
from app.models.training import TrainingSession
from app.models.tournament import TournamentSimulation
from app.models.user import User
from app.models.weakness import Weakness
from app.services.coaching_voice_service import coach_voice
from app.services.skill_profile_service import detect_skill_profile
from app.utils.player_move_scope import player_move_scope_filter


OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"


def _require_openai_key() -> str:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY is not configured on the backend.",
        )

    return settings.OPENAI_API_KEY


def _extract_output_text(response_json: dict) -> str:
    if response_json.get("output_text"):
        return response_json["output_text"].strip()

    chunks = []
    for item in response_json.get("output", []):
      for content in item.get("content", []):
          if content.get("type") == "output_text" and content.get("text"):
              chunks.append(content["text"])

    return "\n".join(chunks).strip()


def _san_from_uci(fen: str | None, move_uci: str | None) -> str | None:
    if not fen or not move_uci:
        return None

    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(move_uci)
    except ValueError:
        return None

    if move not in board.legal_moves:
        return None

    return board.san(move)


def _mover_eval_loss(eval_before, eval_after, color: str | None) -> str:
    if eval_before is None or eval_after is None:
        return "unknown"

    try:
        before = float(eval_before)
        after = float(eval_after)
    except (TypeError, ValueError):
        return "unknown"

    loss = after - before if color == "black" else before - after
    if loss <= 0:
        return "0.0 pawns"

    return f"{loss:.1f} pawns"


def _precision_instructions(feature: str) -> str:
    normalized_feature = feature.lower()
    if normalized_feature in {"explain-mistake", "explain my mistake", "ask", "ask coach"}:
        return (
            "For move explanations, be precise: name the played move, the best move, the evaluation loss if supplied, "
            "and the concrete chess reason using pieces and squares from the context. Prefer 'because' explanations over "
            "labels. Do not give a long variation unless the context contains it; if a variation is missing, say what the "
            "candidate move is meant to achieve."
        )

    if normalized_feature in {"game-summary", "game summary coach"}:
        return (
            "When summarizing a game, cite specific move numbers and patterns from the provided mistake list instead of "
            "generic advice."
        )

    return "Use concrete examples from the provided context before giving general advice."


def call_openai_coach(feature: str, prompt: str, context: str, coach_personality: str | None = None) -> str:
    api_key = _require_openai_key()
    voice = coach_voice(coach_personality)

    instructions = (
        "You are Chess Coach, a practical chess trainer for club players. "
        f"Personality: {voice['label']}. {voice['instruction']} "
        "Use only the provided app data as factual context. "
        "Explain chess ideas in simple words, avoid engine jargon unless useful, "
        "and give concrete next steps. Adapt puzzle difficulty, lesson complexity, "
        "engine-depth assumptions, and coaching language to the detected skill profile. "
        "If data is missing, say what analysis is needed next."
        f" {_precision_instructions(feature)}"
    )

    try:
        response = requests.post(
            OPENAI_RESPONSES_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.OPENAI_MODEL,
                "instructions": instructions,
                "input": (
                    f"Feature: {feature}\n\n"
                    f"App context:\n{context}\n\n"
                    f"User request:\n{prompt}"
                ),
            },
            timeout=45,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI request failed: {str(exc)}",
        )

    if response.status_code >= 400:
        detail = response.text
        try:
            detail = response.json().get("error", {}).get("message", detail)
        except ValueError:
            pass

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI API error: {detail}",
        )

    answer = _extract_output_text(response.json())
    if not answer:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenAI returned an empty response.",
        )

    return answer


def user_summary_context(db: Session, user_id: int) -> str:
    user = db.query(User).filter(User.id == user_id).first()
    skill_profile = detect_skill_profile(db=db, user=user) if user else None
    analyzed_games = (
        db.query(GameAnalysis)
        .join(Game, Game.id == GameAnalysis.game_id)
        .filter(Game.user_id == user_id)
        .count()
    )
    weaknesses = (
        db.query(Weakness)
        .filter(Weakness.user_id == user_id)
        .order_by(Weakness.severity.desc(), Weakness.frequency.desc())
        .limit(5)
        .all()
    )
    training_total = db.query(TrainingSession).filter(TrainingSession.user_id == user_id).count()
    training_completed = (
        db.query(TrainingSession)
        .filter(TrainingSession.user_id == user_id, TrainingSession.completed == True)
        .count()
    )
    puzzle_attempts = db.query(PuzzleAttempt).filter(PuzzleAttempt.user_id == user_id).count()
    tournament_games = (
        db.query(TournamentSimulation)
        .filter(TournamentSimulation.user_id == user_id)
        .order_by(TournamentSimulation.created_at.desc())
        .limit(5)
        .all()
    )

    weakness_lines = [
        f"- {weakness.category}: severity {weakness.severity}, frequency {weakness.frequency}"
        for weakness in weaknesses
    ] or ["- None detected yet"]

    tournament_lines = [
        f"- {game.time_control}, style {game.opponent_style}, result {game.result or 'pending'}, notes {game.notes or 'none'}"
        for game in tournament_games
    ] or ["- No tournament simulations yet"]

    context_lines = [
            f"Analyzed games: {analyzed_games}",
            f"Training sessions: {training_completed}/{training_total} completed",
            f"Puzzle attempts: {puzzle_attempts}",
            "Weaknesses:",
            *weakness_lines,
            "Recent tournament simulations:",
            *tournament_lines,
    ]

    if skill_profile:
        context_lines.extend(
            [
                f"Coach personality: {coach_voice(user.coach_personality)['label']}",
                "Skill profile:",
                f"- Declared level: {skill_profile['declared_level'] or 'not set'}",
                f"- Detected level: {skill_profile['detected_level']}",
                f"- Confidence: {skill_profile['confidence']}",
                f"- Puzzle difficulty: {skill_profile['adaptation']['puzzle_difficulty']}",
                f"- Lesson complexity: {skill_profile['adaptation']['lesson_complexity']}",
                f"- Engine depth: {skill_profile['adaptation']['engine_depth']}",
                f"- Coaching language: {skill_profile['adaptation']['coaching_language']}",
            ]
        )

    return "\n".join(context_lines)


def game_context(db: Session, user_id: int, game_id: int) -> str:
    game = (
        db.query(Game)
        .filter(Game.id == game_id, Game.user_id == user_id)
        .first()
    )
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    analysis = db.query(GameAnalysis).filter(GameAnalysis.game_id == game.id).first()
    moves = (
        db.query(MoveAnalysis)
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(MoveAnalysis.game_id == game.id)
        .filter(player_move_scope_filter())
        .order_by(MoveAnalysis.id.asc())
        .all()
    )
    mistakes = [move for move in moves if move.mistake_type in ["inaccuracy", "mistake", "blunder"]]

    mistake_lines = [
        (
            f"- Move {move.move_number} {move.color}: played {move.played_move} "
            f"({move.played_move_uci}), best {move.best_move}, type {move.mistake_type}, "
            f"eval {move.evaluation_before} to {move.evaluation_after}, note: {move.explanation}"
        )
        for move in mistakes[:10]
    ] or ["- No mistakes recorded"]

    return "\n".join(
        [
            f"Game id: {game.id}",
            f"Opponent: {game.opponent or 'unknown'}",
            f"Result: {game.result or 'unknown'}",
            f"Color played: {game.color_played or 'unknown'}",
            f"Source: {game.source or 'manual'}",
            f"Time control: {game.time_control or 'unknown'}",
            f"Accuracy: {analysis.accuracy if analysis else 'not analyzed'}",
            f"Inaccuracies/Mistakes/Blunders: {analysis.inaccuracies if analysis else 0}/"
            f"{analysis.mistakes if analysis else 0}/{analysis.blunders if analysis else 0}",
            "Mistake positions:",
            *mistake_lines,
            "PGN:",
            game.pgn[:3500],
        ]
    )


def move_context(db: Session, user_id: int, move_analysis_id: int) -> str:
    move = (
        db.query(MoveAnalysis)
        .join(Game, Game.id == MoveAnalysis.game_id)
        .filter(
            MoveAnalysis.id == move_analysis_id,
            Game.user_id == user_id,
            player_move_scope_filter(),
        )
        .first()
    )
    if not move:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Move analysis not found")

    return "\n".join(
        [
            f"Game id: {move.game_id}",
            f"Move: {move.move_number} {move.color}",
            f"FEN before move: {move.fen_before}",
            f"Played move: {move.played_move} ({move.played_move_uci})",
            f"Best move: {_san_from_uci(move.fen_before, move.best_move) or move.best_move} ({move.best_move})",
            f"Evaluation before: {move.evaluation_before}",
            f"Evaluation after: {move.evaluation_after}",
            f"Evaluation loss for mover: {_mover_eval_loss(move.evaluation_before, move.evaluation_after, move.color)}",
            f"Mistake type: {move.mistake_type}",
            f"Stored explanation: {move.explanation}",
        ]
    )
