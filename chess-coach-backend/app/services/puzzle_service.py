import io
import chess
import chess.pgn

from sqlalchemy.orm import Session

from app.models.analysis import MoveAnalysis
from app.models.puzzle import Puzzle


def difficulty_from_mistake(mistake_type: str):
    if mistake_type == "blunder":
        return "hard"
    if mistake_type == "mistake":
        return "medium"
    return "easy"


def theme_from_move_analysis(move_analysis: MoveAnalysis):
    if move_analysis.mistake_type == "blunder":
        return "critical blunder correction"

    if move_analysis.mistake_type == "mistake":
        return "mistake correction"

    if move_analysis.mistake_type == "inaccuracy":
        return "improve move precision"

    return "best move training"


def _parse_move(board: chess.Board, move_text: str):
    normalized = (move_text or "").strip()
    if not normalized:
        return None

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


def validate_puzzle_attempt(fen: str, user_move: str, best_move: str):
    try:
        board = chess.Board(fen)
    except ValueError:
        return {
            "is_legal": False,
            "is_correct": False,
            "normalized_user_move": user_move,
            "normalized_best_move": best_move,
            "message": "Puzzle position is invalid",
            "feedback": "This puzzle has an invalid FEN and cannot be checked safely.",
        }

    parsed_user_move = _parse_move(board, user_move)
    parsed_best_move = _parse_move(board, best_move)

    if not parsed_user_move:
        side_to_move = "White" if board.turn == chess.WHITE else "Black"
        return {
            "is_legal": False,
            "is_correct": False,
            "normalized_user_move": (user_move or "").strip(),
            "normalized_best_move": parsed_best_move.uci() if parsed_best_move else best_move,
            "user_move_san": None,
            "best_move_san": board.san(parsed_best_move) if parsed_best_move else None,
            "message": "Illegal move",
            "feedback": f"{side_to_move} cannot play that move from this position. Try selecting a legal move first.",
        }

    is_correct = parsed_best_move is not None and parsed_user_move == parsed_best_move
    user_move_san = board.san(parsed_user_move)
    best_move_san = board.san(parsed_best_move) if parsed_best_move else None

    return {
        "is_legal": True,
        "is_correct": is_correct,
        "normalized_user_move": parsed_user_move.uci(),
        "normalized_best_move": parsed_best_move.uci() if parsed_best_move else best_move,
        "user_move_san": user_move_san,
        "best_move_san": best_move_san,
        "message": "Correct!" if is_correct else "Incorrect",
        "feedback": (
            "Excellent tactical vision. Your move matches the engine best move."
            if is_correct
            else "That move is legal, but it does not match the engine best move for this position."
        ),
    }


def generate_puzzles_from_game(db: Session, user_id: int, game):
    pgn_io = io.StringIO(game.pgn)
    parsed_game = chess.pgn.read_game(pgn_io)

    if parsed_game is None:
        return []

    board = parsed_game.board()
    generated_puzzles = []

    move_analyses = (
        db.query(MoveAnalysis)
        .filter(
            MoveAnalysis.game_id == game.id,
            MoveAnalysis.mistake_type.in_(["inaccuracy", "mistake", "blunder"])
        )
        .order_by(MoveAnalysis.id.asc())
        .all()
    )

    move_analysis_map = {}
    for move_analysis in move_analyses:
        key = (move_analysis.move_number, move_analysis.color)
        move_analysis_map[key] = move_analysis

    for move in parsed_game.mainline_moves():
        color = "white" if board.turn else "black"
        move_number = board.fullmove_number

        key = (move_number, color)
        move_analysis = move_analysis_map.get(key)

        if move_analysis:
            existing = (
                db.query(Puzzle)
                .filter(
                    Puzzle.user_id == user_id,
                    Puzzle.game_id == game.id,
                    Puzzle.move_analysis_id == move_analysis.id
                )
                .first()
            )

            if not existing and move_analysis.best_move:
                puzzle = Puzzle(
                    user_id=user_id,
                    game_id=game.id,
                    move_analysis_id=move_analysis.id,
                    fen=board.fen(),
                    solution=move_analysis.best_move,
                    theme=theme_from_move_analysis(move_analysis),
                    difficulty=difficulty_from_mistake(move_analysis.mistake_type)
                )

                db.add(puzzle)
                generated_puzzles.append(puzzle)

        board.push(move)

    db.commit()

    for puzzle in generated_puzzles:
        db.refresh(puzzle)

    return generated_puzzles
