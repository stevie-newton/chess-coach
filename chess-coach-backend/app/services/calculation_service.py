import chess


CALCULATION_DRILLS = [
    {
        "key": "knight_queen_attack",
        "title": "Knight Jump, Queen Attack",
        "theme": "Forcing moves",
        "difficulty": "advanced",
        "start_fen": "rnb1kbnr/pppp1ppp/8/4p2Q/4P3/5N2/PPPP1PPP/RNB1KB1R w KQkq - 0 1",
        "blind_after_seconds": 6,
        "prompt": "After the forcing knight move and Black's developing reply, what is the best continuation?",
        "preview_moves": ["f3g5", "g8f6"],
        "best_move": "h5f7",
        "missed_tactic": "queen invasion on f7 with check",
        "explanation": "Qxf7+ attacks the king and rook while exploiting the weak f7 square.",
    },
    {
        "key": "queen_h5_continuation",
        "title": "After Nf6+ and Qh5 Ideas",
        "theme": "Visualization",
        "difficulty": "advanced",
        "start_fen": "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1",
        "blind_after_seconds": 5,
        "prompt": "Visualize the knight moving with tempo. After Black's knight lands on h5, what is the best continuation?",
        "preview_moves": ["f3g5", "f6h5"],
        "best_move": "d1h5",
        "missed_tactic": "queen capture on h5",
        "explanation": "Qxh5 wins the misplaced knight and keeps the attack alive.",
    },
    {
        "key": "back_rank_clearance",
        "title": "Back Rank Clearance",
        "theme": "Candidate moves",
        "difficulty": "intermediate",
        "start_fen": "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
        "blind_after_seconds": 7,
        "prompt": "The board will vanish. Calculate the forcing rook move that keeps the defender boxed in.",
        "preview_moves": [],
        "best_move": "e1e8",
        "missed_tactic": "rook check on the back rank",
        "explanation": "Re8+ uses the open file and forces the king to respond before it can escape.",
    },
]


def get_drill(key: str) -> dict | None:
    return next((drill for drill in CALCULATION_DRILLS if drill["key"] == key), None)


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


def position_after_preview(drill: dict) -> tuple[chess.Board, list[str]]:
    board = chess.Board(drill["start_fen"])
    preview_san = []

    for move_uci in drill["preview_moves"]:
        move = chess.Move.from_uci(move_uci)
        if move not in board.legal_moves:
            break
        preview_san.append(board.san(move))
        board.push(move)

    return board, preview_san


def public_drill(drill: dict) -> dict:
    board, preview_san = position_after_preview(drill)
    return {
        "key": drill["key"],
        "title": drill["title"],
        "theme": drill["theme"],
        "difficulty": drill["difficulty"],
        "start_fen": drill["start_fen"],
        "blind_after_seconds": drill["blind_after_seconds"],
        "prompt": drill["prompt"],
        "preview_moves": drill["preview_moves"],
        "preview_san": preview_san,
        "position_fen": board.fen(),
    }


def evaluate_calculation_attempt(key: str, user_move: str) -> dict:
    drill = get_drill(key)
    if not drill:
        raise ValueError("Calculation drill not found")

    board, preview_san = position_after_preview(drill)
    best_move = chess.Move.from_uci(drill["best_move"])
    parsed_user_move = parse_move(board, user_move)
    best_move_san = board.san(best_move) if best_move in board.legal_moves else drill["best_move"]
    depth = max(1, len(preview_san) + 1)

    if not parsed_user_move:
        return {
            "key": key,
            "is_legal": False,
            "is_correct": False,
            "user_move": user_move,
            "best_move": drill["best_move"],
            "best_move_san": best_move_san,
            "message": "Illegal continuation",
            "feedback": "That move is not legal in the visualized position. Rebuild the position in your head and try again.",
            "visualization_score": 35,
            "calculation_depth": depth,
            "missed_tactic": drill["missed_tactic"],
        }

    is_correct = parsed_user_move == best_move
    user_san = board.san(parsed_user_move)

    return {
        "key": key,
        "is_legal": True,
        "is_correct": is_correct,
        "user_move": parsed_user_move.uci(),
        "best_move": drill["best_move"],
        "best_move_san": best_move_san,
        "message": "Correct continuation" if is_correct else "Missed continuation",
        "feedback": (
            f"{user_san} is right. {drill['explanation']}"
            if is_correct
            else f"{user_san} is legal, but {best_move_san} was stronger. {drill['explanation']}"
        ),
        "visualization_score": 100 if is_correct else 62,
        "calculation_depth": depth,
        "missed_tactic": None if is_correct else drill["missed_tactic"],
    }
