import requests
import chess

from app.core.config import settings
from app.models.analysis import MoveAnalysis
from app.models.puzzle import Puzzle
from app.services.coaching_voice_service import coach_voice, trainer_reaction


OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"


PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 99,
}


def _square_name(square: int) -> str:
    return chess.square_name(square)


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


def _piece_label(piece: chess.Piece | None, square: int | None = None) -> str | None:
    name = _piece_name(piece)
    if not name:
        return None

    if square is None:
        return name

    return f"{name} on {_square_name(square)}"


def _attacked_targets_after(board: chess.Board, move: chess.Move) -> list[str]:
    board.push(move)
    try:
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return []

        targets = []
        for square in board.attacks(move.to_square):
            target = board.piece_at(square)
            if target and target.color != moved_piece.color and PIECE_VALUES.get(target.piece_type, 0) >= 3:
                targets.append(_piece_label(target, square))

        return [target for target in targets if target]
    finally:
        board.pop()


def _controlled_squares_after(board: chess.Board, move: chess.Move) -> list[str]:
    board.push(move)
    try:
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return []

        center = {chess.D4, chess.E4, chess.D5, chess.E5}
        enemy_half = range(chess.A5, chess.H8 + 1) if moved_piece.color == chess.WHITE else range(chess.A1, chess.H4 + 1)
        priority_squares = []

        for square in board.attacks(move.to_square):
            if square in center or square in enemy_half:
                priority_squares.append(_square_name(square))

        return sorted(priority_squares)[:3]
    finally:
        board.pop()


def _move_reason(board: chess.Board, move_uci: str | None) -> str:
    if not move_uci:
        return "the engine move is not available for this position"

    try:
        move = chess.Move.from_uci(move_uci)
    except ValueError:
        return "the saved engine move could not be parsed"

    if move not in board.legal_moves:
        return "the saved engine move is not legal in this position"

    moving_piece = board.piece_at(move.from_square)
    captured_piece = board.piece_at(move.to_square)
    san = board.san(move)
    reasons = []

    board.push(move)
    gives_check = board.is_check()
    gives_mate = board.is_checkmate()
    board.pop()

    if gives_mate:
        reasons.append("delivers checkmate")
    elif gives_check:
        reasons.append("gives check, so the opponent must answer the king threat")

    if captured_piece:
        reasons.append(f"captures the {_piece_label(captured_piece, move.to_square)}")

    if move.promotion:
        promoted_piece = chess.piece_name(move.promotion)
        reasons.append(f"promotes the pawn to a {promoted_piece}")

    attacked_targets = _attacked_targets_after(board, move)
    if attacked_targets:
        if len(attacked_targets) >= 2:
            reasons.append(f"creates a fork on {', '.join(attacked_targets[:2])}")
        else:
            reasons.append(f"attacks the {attacked_targets[0]}")

    if board.is_castling(move):
        reasons.append("castles the king to safety and connects the rooks")

    if not reasons and moving_piece:
        controlled_squares = _controlled_squares_after(board, move)
        reasons.append(
            f"moves the {_piece_name(moving_piece)} from {_square_name(move.from_square)} "
            f"to {_square_name(move.to_square)}"
        )
        if controlled_squares:
            reasons[-1] += f", where it controls {', '.join(controlled_squares)}"

    if not reasons:
        reasons.append("keeps the engine's preferred position")

    return f"{san} works because it " + " and ".join(reasons) + "."


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
    attacked_targets = _attacked_targets_after(board, move)
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
        "attacked_targets": attacked_targets,
        "reason": _move_reason(board, move_uci),
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

    best_reason = best_features.get("reason") or _move_reason(board, validation.get("normalized_best_move"))
    user_reason = user_features.get("reason") or _move_reason(board, validation.get("normalized_user_move"))

    if validation.get("is_correct"):
        reason = f"Your move {user_move} is right because it matches the engine choice. {best_reason}"
    else:
        reason = (
            f"Your move {user_move} is legal, but its main effect is weaker: {user_reason} "
            f"The stronger move is {best_move}. {best_reason}"
        )

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
        f"{reason}{eval_note}{stored_note}"
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
                    "Prefer specific effects such as check, mate, capture, attacked piece, fork, promotion, or king safety. "
                    "Avoid vague phrases like 'increases activity' unless you name the square or target that changed. "
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
