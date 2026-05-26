import chess

from app.utils.chess_move_utils import parse_uci_move


def generate_hint(move, hint_level: int):
    best_move_preview = parse_uci_move(move.best_move)

    if not best_move_preview:
        return {
            "hint_level": hint_level,
            "hint": "No hint available for this position."
        }

    from_square = best_move_preview["from_square"]
    to_square = best_move_preview["to_square"]
    move_theme = "Look for checks, captures, and threats before choosing your move."

    try:
        board = chess.Board(move.fen_before)
        best_move = chess.Move.from_uci(move.best_move)
        piece = board.piece_at(best_move.from_square)

        if best_move in board.legal_moves:
            if board.gives_check(best_move):
                move_theme = "The best move is forcing: it gives check."
            elif board.is_capture(best_move):
                move_theme = "The best move is tactical: it captures something important."
            elif best_move.promotion:
                move_theme = "The best move turns a passed pawn into a promoted piece."
            elif piece:
                move_theme = f"The best move improves a {piece.symbol().upper() if piece.color == chess.WHITE else piece.symbol()} piece."
    except (ValueError, TypeError):
        pass

    if hint_level == 1:
        return {
            "hint_level": 1,
            "hint": move_theme
        }

    if hint_level == 2:
        return {
            "hint_level": 2,
            "hint": f"The best move starts from the square {from_square}."
        }

    if hint_level == 3:
        return {
            "hint_level": 3,
            "hint": f"The best move goes to the square {to_square}."
        }

    return {
        "hint_level": 4,
        "hint": f"The full best move is {move.best_move}."
    }
