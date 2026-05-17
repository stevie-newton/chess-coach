import requests
import chess

from app.core.config import settings
from app.models.analysis import MoveAnalysis
from app.models.puzzle import Puzzle
from app.services.coaching_voice_service import coach_voice, trainer_reaction


OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"


def _piece_name(piece: chess.Piece | None) -> str | None:
    if not piece:
        return None

    names = {
        chess.PAWN: "pawn",
        chess.KNIGHT: "knight",
        chess.BISHOP: "bishop",
        chess.ROOK: "rook",
        chess.QUEEN: "queen",
        chess.KING: "king",
    }
    return names.get(piece.piece_type)


def _move_features(board: chess.Board, move_uci: str | None) -> dict:
    if not move_uci:
        return {}

    try:
        move = chess.Move.from_uci(move_uci)
    except ValueError:
        return {}

    if move not in board.legal_moves:
        return {}

    captured_piece = board.piece_at(move.to_square)
    san = board.san(move)
    board.push(move)
    gives_check = board.is_check()
    gives_mate = board.is_checkmate()
    board.pop()

    return {
        "san": san,
        "is_capture": captured_piece is not None,
        "captured_piece": _piece_name(captured_piece),
        "gives_check": gives_check,
        "gives_mate": gives_mate,
    }


def _fallback_explanation(
    puzzle: Puzzle,
    validation: dict,
    move_analysis: MoveAnalysis | None,
    coach_personality: str | None = None,
) -> str:
    try:
        board = chess.Board(puzzle.fen)
    except ValueError:
        return "I cannot explain this puzzle reliably because the saved position is invalid."

    user_features = _move_features(board, validation.get("normalized_user_move"))
    best_features = _move_features(board, validation.get("normalized_best_move"))
    user_move = user_features.get("san") or validation.get("normalized_user_move")
    best_move = best_features.get("san") or validation.get("normalized_best_move")

    if not validation.get("is_legal"):
        return (
            f"{trainer_reaction(False, False, coach_personality, puzzle.theme)} "
            f"{validation.get('normalized_user_move') or 'That move'} is not legal in this position, "
            "so the coach stops before comparing it with the engine choice. First make sure the piece can move there "
            "and that your king is not left in check."
        )

    if validation.get("is_correct"):
        reason = "It matches the engine best move and keeps the tactical point of the position."
    else:
        reason = "It is legal, but it misses the strongest tactical idea in the position."

    best_reason_parts = []
    if best_features.get("gives_mate"):
        best_reason_parts.append("it delivers checkmate")
    elif best_features.get("gives_check"):
        best_reason_parts.append("it gives check and forces the opponent to respond")

    if best_features.get("is_capture"):
        captured_piece = best_features.get("captured_piece") or "piece"
        best_reason_parts.append(f"it wins or removes a {captured_piece}")

    if not best_reason_parts:
        best_reason_parts.append("it improves the position without allowing the tactic to slip away")

    eval_note = ""
    if move_analysis and move_analysis.evaluation_before is not None and move_analysis.evaluation_after is not None:
        eval_note = (
            f" In the original game, the evaluation moved from {move_analysis.evaluation_before} "
            f"to {move_analysis.evaluation_after}, which is why this position became training material."
        )

    stored_note = ""
    if move_analysis and move_analysis.explanation:
        stored_note = f" Stored analysis note: {move_analysis.explanation}"

    return (
        f"{trainer_reaction(validation.get('is_correct'), True, coach_personality, puzzle.theme)} "
        f"Your move {user_move} was {'right' if validation.get('is_correct') else 'not the best'} because {reason} "
        f"The best move was {best_move} because {' and '.join(best_reason_parts)}.{eval_note}{stored_note}"
    )


def _openai_explanation(
    puzzle: Puzzle,
    validation: dict,
    move_analysis: MoveAnalysis | None,
    fallback: str,
    coach_personality: str | None = None,
) -> str | None:
    if not settings.OPENAI_API_KEY:
        return None

    context = [
        f"FEN: {puzzle.fen}",
        f"User move: {validation.get('normalized_user_move')}",
        f"Best move: {validation.get('normalized_best_move')}",
        f"Is legal: {validation.get('is_legal')}",
        f"Is correct: {validation.get('is_correct')}",
        f"Puzzle theme: {puzzle.theme or 'best move training'}",
        f"Difficulty: {puzzle.difficulty}",
    ]

    if move_analysis:
        context.extend(
            [
                f"Original game move: {move_analysis.played_move} ({move_analysis.played_move_uci})",
                f"Original best move: {move_analysis.best_move}",
                f"Mistake type: {move_analysis.mistake_type}",
                f"Evaluation before: {move_analysis.evaluation_before}",
                f"Evaluation after: {move_analysis.evaluation_after}",
                f"Stored note: {move_analysis.explanation}",
            ]
        )

    try:
        response = requests.post(
            OPENAI_RESPONSES_URL,
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.OPENAI_MODEL,
                "instructions": (
                    "You are a chess explanation engine. Explain why the submitted puzzle move is right or wrong. "
                    "Use concrete chess language, name the user move and best move, and keep it to 2-4 short sentences. "
                    f"Coaching personality: {coach_voice(coach_personality)['label']}. "
                    f"Voice rules: {coach_voice(coach_personality)['instruction']} "
                    "Do not invent a forced line unless it follows from the provided context. "
                    "If the fallback explanation is all that can be known, improve its clarity without adding false details."
                ),
                "input": "\n".join(
                    [
                        "Puzzle attempt context:",
                        *context,
                        "",
                        "Fallback explanation:",
                        fallback,
                    ]
                ),
            },
            timeout=20,
        )
        response.raise_for_status()
    except requests.RequestException:
        return None

    data = response.json()
    if data.get("output_text"):
        return data["output_text"].strip()

    chunks = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                chunks.append(content["text"])

    return "\n".join(chunks).strip() or None


def explain_puzzle_attempt(
    puzzle: Puzzle,
    validation: dict,
    move_analysis: MoveAnalysis | None,
    coach_personality: str | None = None,
) -> tuple[str, str]:
    fallback = _fallback_explanation(
        puzzle=puzzle,
        validation=validation,
        move_analysis=move_analysis,
        coach_personality=coach_personality,
    )
    ai_explanation = _openai_explanation(
        puzzle=puzzle,
        validation=validation,
        move_analysis=move_analysis,
        fallback=fallback,
        coach_personality=coach_personality,
    )

    if ai_explanation:
        return ai_explanation, "openai"

    return fallback, "fallback"
