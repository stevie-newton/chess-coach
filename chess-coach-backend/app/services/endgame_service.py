import chess


ENDGAME_TEMPLATES = [
    {
        "key": "king_pawn_vs_king",
        "title": "King + Pawn vs King",
        "category": "Pawn Endgame",
        "goal": "Win in 10 moves",
        "max_moves": 10,
        "start_fen": "8/8/4k3/8/8/3K4/4P3/8 w - - 0 1",
        "user_color": "white",
        "difficulty": "easy",
        "description": "Use king activity and pawn timing to convert a simple extra pawn.",
        "line": ["e2e4", "e6e5", "d3e3", "e5e6", "e3f4", "e6f6", "e4e5"],
    },
    {
        "key": "lucena_position",
        "title": "Lucena Position",
        "category": "Rook Endgame",
        "goal": "Build the bridge in 10 moves",
        "max_moves": 10,
        "start_fen": "8/5R2/8/8/8/8/4K1k1/4R3 w - - 0 1",
        "user_color": "white",
        "difficulty": "hard",
        "description": "Practice the classic bridge-building technique in rook endings.",
        "line": ["f7f4", "g2g3", "e1g1", "g3h3", "f4f8"],
    },
    {
        "key": "philidor_position",
        "title": "Philidor Position",
        "category": "Rook Endgame",
        "goal": "Hold the draw in 10 moves",
        "max_moves": 10,
        "start_fen": "8/8/8/4K3/8/8/4k3/R6r b - - 0 1",
        "user_color": "black",
        "difficulty": "hard",
        "description": "Defend actively with rook checks and keep the king contained.",
        "line": ["h1e1", "e5d4", "e1d1", "d4c3", "d1c1"],
    },
    {
        "key": "queen_mate",
        "title": "Queen Mate",
        "category": "Checkmate Pattern",
        "goal": "Mate with queen support in 10 moves",
        "max_moves": 10,
        "start_fen": "6k1/8/8/8/8/8/5Q2/6K1 w - - 0 1",
        "user_color": "white",
        "difficulty": "medium",
        "description": "Coordinate queen and king, force the defender back, and avoid stalemate habits.",
        "line": ["f2f7", "g8h8", "f7f8", "h8h7", "f8f7"],
    },
    {
        "key": "rook_mate",
        "title": "Rook Mate",
        "category": "Checkmate Pattern",
        "goal": "Mate with rook support in 10 moves",
        "max_moves": 10,
        "start_fen": "6k1/8/8/8/8/8/5R2/6K1 w - - 0 1",
        "user_color": "white",
        "difficulty": "medium",
        "description": "Use the rook to cut off the king and bring your own king closer.",
        "line": ["f2f8", "g8g7", "f8f7", "g7g6", "f7f3"],
    },
]


def public_template(template: dict) -> dict:
    return {key: value for key, value in template.items() if key != "line"}


def get_template(template_key: str) -> dict | None:
    return next((template for template in ENDGAME_TEMPLATES if template["key"] == template_key), None)


def board_after_line(template: dict, ply_index: int) -> chess.Board:
    board = chess.Board(template["start_fen"])
    for move_uci in template["line"][:ply_index]:
        move = chess.Move.from_uci(move_uci)
        if move not in board.legal_moves:
            break
        board.push(move)
    return board


def parse_move(board: chess.Board, move_text: str):
    normalized = (move_text or "").strip()
    try:
        move = chess.Move.from_uci(normalized.lower())
        if move in board.legal_moves:
            return move
    except ValueError:
        pass

    try:
        return board.parse_san(normalized)
    except ValueError:
        return None


def move_san(board: chess.Board, move_uci: str) -> str:
    move = chess.Move.from_uci(move_uci)
    return board.san(move) if move in board.legal_moves else move_uci


def evaluate_endgame_move(template_key: str, ply_index: int, user_move: str, previous_mistakes: int = 0) -> dict:
    template = get_template(template_key)
    if not template:
        raise ValueError("Endgame template not found")

    line = template["line"]
    bounded_ply = max(0, min(ply_index, len(line) - 1))
    board = board_after_line(template, bounded_ply)
    expected_move_uci = line[bounded_ply]
    expected_move = chess.Move.from_uci(expected_move_uci)
    parsed_user_move = parse_move(board, user_move)

    if not parsed_user_move:
        mistakes = previous_mistakes + 1
        return {
            **public_template(template),
            "is_legal": False,
            "is_correct": False,
            "message": "Illegal endgame move",
            "feedback": "That move is not legal from this endgame position. Re-check king safety and piece movement.",
            "precision": max(0, 100 - mistakes * 20),
            "efficiency": max(0, 100 - bounded_ply * 8),
            "mistakes": mistakes,
            "user_move": user_move,
            "expected_move": expected_move_uci,
            "ai_reply": None,
            "next_ply_index": bounded_ply,
            "fen": board.fen(),
            "completed": False,
        }

    is_correct = parsed_user_move == expected_move
    mistakes = previous_mistakes if is_correct else previous_mistakes + 1
    user_san = board.san(parsed_user_move)
    expected_san = board.san(expected_move)
    board.push(parsed_user_move)
    next_ply = bounded_ply + 1
    ai_reply = None

    if is_correct and next_ply < len(line):
        reply_board = board.copy()
        reply_move_uci = line[next_ply]
        reply_move = chess.Move.from_uci(reply_move_uci)
        if reply_move in reply_board.legal_moves:
            ai_reply = {
                "move": reply_move_uci,
                "san": reply_board.san(reply_move),
                "role": "defender",
                "feedback": "The defender replies with the practical resistance move.",
            }
            reply_board.push(reply_move)
            board = reply_board
            next_ply += 1

    completed = next_ply >= len(line) and is_correct
    user_moves_used = (next_ply + 1) // 2
    precision = max(0, 100 - mistakes * 18)
    efficiency = max(0, 100 - max(0, user_moves_used - template["max_moves"]) * 12 - mistakes * 8)

    return {
        **public_template(template),
        "is_legal": True,
        "is_correct": is_correct,
        "message": "Precise endgame move" if is_correct else "Imprecise endgame move",
        "feedback": (
            f"{user_san} is the practical move. Keep converting efficiently."
            if is_correct
            else f"{user_san} is legal, but {expected_san} is the precise conversion move."
        ),
        "precision": precision,
        "efficiency": efficiency,
        "mistakes": mistakes,
        "user_move": parsed_user_move.uci(),
        "expected_move": expected_move_uci,
        "ai_reply": ai_reply,
        "next_ply_index": next_ply,
        "fen": board.fen(),
        "completed": completed,
    }
