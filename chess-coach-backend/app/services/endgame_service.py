import chess


ENDGAME_TEMPLATES = [
    {
        "key": "king_pawn_vs_king",
        "title": "King + Pawn vs King",
        "category": "Pawn Endgame",
        "goal": "Promote the passed pawn",
        "max_moves": 1,
        "start_fen": "2k5/4P3/3K4/8/8/8/8/8 w - - 0 1",
        "user_color": "white",
        "difficulty": "easy",
        "description": "Use the king's support to queen the pawn cleanly.",
        "line": ["e7e8q"],
    },
    {
        "key": "lucena_position",
        "title": "Lucena Position",
        "category": "Rook Endgame",
        "goal": "Build the bridge",
        "max_moves": 3,
        "start_fen": "4K3/3RP1k1/8/8/8/8/r7/8 w - - 0 1",
        "user_color": "white",
        "difficulty": "hard",
        "description": "Lift the rook so checks can be blocked and the pawn can promote.",
        "line": ["d7d4", "a2a8", "e8d7", "a8a7", "d7c6"],
    },
    {
        "key": "philidor_position",
        "title": "Philidor Position",
        "category": "Rook Endgame",
        "goal": "Hold with active checks",
        "max_moves": 3,
        "start_fen": "8/8/4k2r/4P3/4K3/8/8/4R3 b - - 0 1",
        "user_color": "black",
        "difficulty": "hard",
        "description": "Switch from passive waiting to checking once the pawn advances.",
        "line": ["h6h4", "e4f3", "h4h1", "f3g3", "h1e1"],
    },
    {
        "key": "queen_mate",
        "title": "Queen Mate",
        "category": "Checkmate Pattern",
        "goal": "Deliver mate without stalemate",
        "max_moves": 1,
        "start_fen": "7k/5K2/6Q1/8/8/8/8/8 w - - 0 1",
        "user_color": "white",
        "difficulty": "medium",
        "description": "Keep the king boxed in and finish with a protected queen net.",
        "line": ["g6g8"],
    },
    {
        "key": "rook_mate",
        "title": "Rook Mate",
        "category": "Checkmate Pattern",
        "goal": "Deliver mate with king support",
        "max_moves": 1,
        "start_fen": "7k/5K2/6R1/8/8/8/8/8 w - - 0 1",
        "user_color": "white",
        "difficulty": "medium",
        "description": "Use the king to cover escape squares while the rook gives mate.",
        "line": ["g6h6"],
    },
]


def validate_endgame_templates() -> None:
    for template in ENDGAME_TEMPLATES:
        board = chess.Board(template["start_fen"])
        expected_turn = chess.WHITE if template["user_color"] == "white" else chess.BLACK
        if board.turn != expected_turn:
            raise ValueError(f"{template['key']} starts with the wrong side to move")

        for ply_index, move_uci in enumerate(template["line"]):
            move = chess.Move.from_uci(move_uci)
            if move not in board.legal_moves:
                raise ValueError(
                    f"{template['key']} has illegal move {move_uci} at ply {ply_index}"
                )
            board.push(move)


validate_endgame_templates()


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
