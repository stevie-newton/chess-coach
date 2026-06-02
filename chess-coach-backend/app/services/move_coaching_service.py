import chess
import requests

from app.core.config import settings
from app.services.coaching_voice_service import coach_voice
from app.services.openai_coach_service import OPENAI_RESPONSES_URL, _extract_output_text


def _piece_label(piece: chess.Piece | None) -> str:
    if not piece:
        return "piece"

    return chess.piece_name(piece.piece_type)


def _move_reason_from_board(fen: str | None, played_uci: str | None, best_uci: str | None) -> str | None:
    if not fen:
        return None

    try:
        board = chess.Board(fen)
    except ValueError:
        return None

    details = []
    played_move = None
    if played_uci:
        try:
            played_move = chess.Move.from_uci(played_uci)
        except ValueError:
            played_move = None

    if played_move and played_move in board.legal_moves:
        piece = board.piece_at(played_move.from_square)
        from_square = chess.square_name(played_move.from_square)
        to_square = chess.square_name(played_move.to_square)
        details.append(f"your {_piece_label(piece)} moved from {from_square} to {to_square}")

        captured_piece = board.piece_at(played_move.to_square)
        if captured_piece:
            details.append(f"it captured a {_piece_label(captured_piece)}")

        board_after_played = board.copy()
        board_after_played.push(played_move)
        attackers = board_after_played.attackers(board_after_played.turn, played_move.to_square)
        if piece and attackers:
            details.append(f"the {_piece_label(piece)} on {to_square} is attacked by an opponent piece")

    if best_uci:
        try:
            best_move = chess.Move.from_uci(best_uci)
        except ValueError:
            best_move = None

        if best_move and best_move in board.legal_moves:
            best_san = board.san(best_move)
            best_piece = board.piece_at(best_move.from_square)
            target_piece = board.piece_at(best_move.to_square)
            if board.gives_check(best_move):
                details.append(f"{best_san} was forcing because it gives check")
            elif target_piece:
                details.append(
                    f"{best_san} wins or removes the {_piece_label(target_piece)} on "
                    f"{chess.square_name(best_move.to_square)}"
                )
            else:
                details.append(
                    f"{best_san} improves the {_piece_label(best_piece)} from "
                    f"{chess.square_name(best_move.from_square)} to {chess.square_name(best_move.to_square)}"
                )

    if not details:
        return None

    return "; ".join(details)


def _loss_text(move: dict) -> str | None:
    eval_before = move.get("evaluation_before")
    eval_after = move.get("evaluation_after")
    color = move.get("color")
    if eval_before is None or eval_after is None:
        return None

    try:
        before = float(eval_before)
        after = float(eval_after)
    except (TypeError, ValueError):
        return None

    loss = after - before if color == "black" else before - after
    if loss <= 0:
        return None

    return f"about {loss:.1f} pawns"


def _fallback_positional_explanation(move: dict) -> str:
    played_move = move.get("played_move") or "that move"
    played_uci = move.get("played_move_uci") or ""
    best_move = move.get("best_move_san") or move.get("best_move") or "the engine move"
    mistake_type = move.get("mistake_type") or "mistake"
    stockfish_note = move.get("explanation") or "The engine evaluation dropped after this move."
    stockfish_note = stockfish_note.split(" Best move:")[0].strip()
    for prefix in ["Blunder: ", "Mistake: ", "Inaccuracy: "]:
        if stockfish_note.startswith(prefix):
            stockfish_note = stockfish_note[len(prefix):]
            break

    from_square = played_uci[:2]
    to_square = played_uci[2:4]
    board_reason = _move_reason_from_board(move.get("fen_before"), played_uci, move.get("best_move"))
    loss_text = _loss_text(move)
    cost = f" It cost {loss_text} from your side's point of view." if loss_text else ""

    if from_square.startswith("f") and from_square[1:] in {"2", "7"}:
        return (
            f"{mistake_type.capitalize()}: {played_move} weakened your king safety by moving the f-pawn too early. "
            f"{stockfish_note} Best move: {best_move}.{cost}"
        )

    if "x" in best_move:
        return (
            f"{mistake_type.capitalize()}: {played_move} missed a tactical capture. "
            f"Stockfish preferred {best_move}, which wins material or removes an important defender.{cost}"
        )

    if "+" in best_move:
        return (
            f"{mistake_type.capitalize()}: {played_move} missed a forcing check. "
            f"{best_move} would have made the opponent respond to your threat first.{cost}"
        )

    if to_square in {"g4", "b4", "g5", "b5"}:
        return (
            f"{mistake_type.capitalize()}: {played_move} pushed a piece or pawn forward before your position was ready. "
            f"Stockfish preferred {best_move}, keeping more control and fewer weaknesses.{cost}"
        )

    if board_reason:
        return (
            f"{mistake_type.capitalize()}: {played_move} was imprecise because {board_reason}. "
            f"Best move: {best_move}.{cost}"
        )

    return (
        f"{mistake_type.capitalize()}: {played_move} made the position harder to defend. "
        f"{stockfish_note} Best move: {best_move}.{cost}"
    )


def premium_move_explanation_result(move: dict, coach_personality: str | None = None) -> dict:
    """Turn engine facts into a premium coaching explanation, without inventing analysis."""
    mistake_type = move.get("mistake_type")
    if mistake_type not in ["inaccuracy", "mistake", "blunder"]:
        return {
            "explanation": move.get("explanation") or "Good or acceptable move.",
            "source": "stored",
        }

    fallback = _fallback_positional_explanation(move)

    if not settings.OPENAI_API_KEY:
        return {"explanation": fallback, "source": "fallback"}

    voice = coach_voice(coach_personality)
    context = "\n".join(
        [
            f"Move number: {move.get('move_number')}",
            f"Side to move: {move.get('color')}",
            f"FEN before move: {move.get('fen_before')}",
            f"Played move: {move.get('played_move')} ({move.get('played_move_uci')})",
            f"Stockfish best move: {move.get('best_move_san') or move.get('best_move')}",
            f"Evaluation before: {move.get('evaluation_before')}",
            f"Evaluation after: {move.get('evaluation_after')}",
            f"Evaluation loss for mover: {_loss_text(move) or 'unknown'}",
            f"Mistake type: {mistake_type}",
            f"Engine note: {move.get('explanation')}",
            f"Board-derived details: {_move_reason_from_board(move.get('fen_before'), move.get('played_move_uci'), move.get('best_move')) or 'none'}",
            f"Fallback coach note: {fallback}",
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
                    "You are a premium chess coach rewriting Stockfish facts into human coaching. "
                    "Use only the provided context. Do not invent a variation, tactic, or material loss that is not supported. "
                    "Write 2 compact sentences. Sentence 1 must explain the concrete problem with the played move using "
                    "piece names, squares, or the eval loss when available. Sentence 2 must name the best move and why it is "
                    "better. Name the real chess reason when possible, such as king safety, loose piece, missed capture, "
                    "missed check, weak square, development, or pawn structure. "
                    "Avoid saying only 'bad move' or generic evaluation language. "
                    f"Coaching personality: {voice['label']}. {voice['instruction']}"
                ),
                "input": context,
            },
            timeout=18,
        )
        response.raise_for_status()
    except requests.RequestException:
        return {"explanation": fallback, "source": "fallback"}

    try:
        explanation = _extract_output_text(response.json())
    except ValueError:
        return {"explanation": fallback, "source": "fallback"}

    return {
        "explanation": explanation or fallback,
        "source": "openai" if explanation else "fallback",
    }


def premium_move_explanation(move: dict, coach_personality: str | None = None) -> str:
    return premium_move_explanation_result(move, coach_personality)["explanation"]
