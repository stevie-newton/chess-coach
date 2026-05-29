import chess

from app.models.analysis import MoveAnalysis
from app.models.game import Game


FOCUS_LABELS = {
    "practice": "General practice",
    "tournament_simulation": "Tournament habits",
    "opening_training": "Opening focus",
    "endgame_training": "Endgame focus",
    "tactics_training": "Tactics focus",
}


def focus_from_game(game: Game) -> str:
    source = game.source or ""
    prefix = "training-session:"

    if source.startswith(prefix):
        return source.removeprefix(prefix)

    return "practice"


def focus_label(focus: str) -> str:
    return FOCUS_LABELS.get(focus, "General practice")


def is_focus_move(move: MoveAnalysis, focus: str) -> bool:
    if focus == "opening_training":
        return move.move_number <= 12

    if focus == "endgame_training":
        if move.move_number >= 30:
            return True

        if not move.fen_before:
            return False

        try:
            board = chess.Board(move.fen_before)
        except ValueError:
            return False

        non_king_material = [
            piece
            for piece in board.piece_map().values()
            if piece.piece_type != chess.KING
        ]
        return len(non_king_material) <= 8

    if focus == "tactics_training":
        best_move = (move.best_move or "").lower()
        best_san = best_move_san(move)

        return (
            move.mistake_type in ["inaccuracy", "mistake", "blunder"]
            and (
                "#" in best_san
                or "+" in best_san
                or "x" in best_san
                or bool(best_move)
            )
        )

    if focus == "tournament_simulation":
        return move.mistake_type in ["inaccuracy", "mistake", "blunder"]

    return True


def best_move_san(move: MoveAnalysis) -> str:
    if not move.fen_before or not move.best_move:
        return ""

    try:
        board = chess.Board(move.fen_before)
        best_move = chess.Move.from_uci(move.best_move)
        if best_move not in board.legal_moves:
            return ""
        return board.san(best_move)
    except ValueError:
        return ""


def focus_note_for_move(move: MoveAnalysis, focus: str) -> str | None:
    if not is_focus_move(move, focus):
        return None

    if focus == "opening_training":
        if move.move_number <= 4:
            return "Opening focus: center, development, and king safety matter most here."
        if move.move_number <= 12:
            return "Opening focus: check whether this move supports your plan before the middlegame."

    if focus == "endgame_training":
        return "Endgame focus: king activity, pawn races, conversion, and defensive technique are the priority."

    if focus == "tactics_training":
        san = best_move_san(move)
        if "#" in san:
            return f"Tactics focus: {san} was a mating resource."
        if "+" in san:
            return f"Tactics focus: {san} was a forcing check."
        if "x" in san:
            return f"Tactics focus: {san} won or saved material."
        return "Tactics focus: review forcing checks, captures, and threats in this position."

    if focus == "tournament_simulation":
        return "Tournament focus: this is a practical decision point to review for clock discipline and risk."

    return None


def build_focused_review(game: Game, moves: list[MoveAnalysis]) -> dict:
    focus = focus_from_game(game)
    focus_moves = [move for move in moves if is_focus_move(move, focus)]
    focus_mistakes = [
        move
        for move in focus_moves
        if move.mistake_type in ["inaccuracy", "mistake", "blunder"]
    ]
    total = len(focus_moves)
    accuracy = 100 if total == 0 else round(100 - (len(focus_mistakes) / total * 100), 2)

    if focus == "opening_training":
        summary = "Opening review is limited to the first 12 moves, with emphasis on development, center control, castling, and reaching a playable middlegame."
    elif focus == "endgame_training":
        summary = "Endgame review emphasizes late or simplified positions, king activity, pawn conversion, rook activity, and defensive technique."
    elif focus == "tactics_training":
        summary = "Tactics review highlights forcing resources: checks, captures, threats, mating ideas, and material wins."
    elif focus == "tournament_simulation":
        summary = "Tournament review highlights practical mistakes and decision points from the whole game."
    else:
        summary = "General practice review covers the whole game."

    return {
        "focus": focus,
        "label": focus_label(focus),
        "summary": summary,
        "reviewed_moves": total,
        "mistakes": len(focus_mistakes),
        "accuracy": accuracy,
        "move_ids": [move.id for move in focus_moves],
    }
