import requests

from app.core.config import settings
from app.services.coaching_voice_service import coach_voice
from app.services.openai_coach_service import OPENAI_RESPONSES_URL, _extract_output_text


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

    if from_square.startswith("f") and from_square[1:] in {"2", "7"}:
        return (
            f"{mistake_type.capitalize()}: {played_move} weakened your king safety by moving the f-pawn too early. "
            f"{stockfish_note} Best move: {best_move}."
        )

    if "x" in best_move:
        return (
            f"{mistake_type.capitalize()}: {played_move} missed a tactical capture. "
            f"Stockfish preferred {best_move}, which wins material or removes an important defender."
        )

    if "+" in best_move:
        return (
            f"{mistake_type.capitalize()}: {played_move} missed a forcing check. "
            f"{best_move} would have made the opponent respond to your threat first."
        )

    if to_square in {"g4", "b4", "g5", "b5"}:
        return (
            f"{mistake_type.capitalize()}: {played_move} pushed a piece or pawn forward before your position was ready. "
            f"Stockfish preferred {best_move}, keeping more control and fewer weaknesses."
        )

    return (
        f"{mistake_type.capitalize()}: {played_move} made the position harder to defend. "
        f"{stockfish_note} Best move: {best_move}."
    )


def premium_move_explanation(move: dict, coach_personality: str | None = None) -> str:
    """Turn engine facts into a premium coaching explanation, without inventing analysis."""
    mistake_type = move.get("mistake_type")
    if mistake_type not in ["inaccuracy", "mistake", "blunder"]:
        return move.get("explanation") or "Good or acceptable move."

    fallback = _fallback_positional_explanation(move)

    if not settings.OPENAI_API_KEY:
        return fallback

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
            f"Mistake type: {mistake_type}",
            f"Engine note: {move.get('explanation')}",
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
                    "Write 1-2 short sentences. Name the real chess reason when possible, such as king safety, loose piece, "
                    "missed capture, missed check, weak square, development, or pawn structure. "
                    "Avoid saying only 'bad move' or generic evaluation language. "
                    f"Coaching personality: {voice['label']}. {voice['instruction']}"
                ),
                "input": context,
            },
            timeout=18,
        )
        response.raise_for_status()
    except requests.RequestException:
        return fallback

    try:
        explanation = _extract_output_text(response.json())
    except ValueError:
        return fallback

    return explanation or fallback
