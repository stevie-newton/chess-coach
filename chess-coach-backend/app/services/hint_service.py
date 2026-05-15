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

    if hint_level == 1:
        return {
            "hint_level": 1,
            "hint": "Look for checks, captures, and threats before choosing your move."
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