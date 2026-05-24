import io
import chess
import chess.pgn
import chess.engine

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.analysis import MoveAnalysis
from app.models.puzzle import Puzzle
from app.models.weakness import Weakness
from app.services.weakness_service import update_user_weakness


PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 99,
}


def difficulty_from_mistake(mistake_type: str):
    if mistake_type == "blunder":
        return "hard"
    if mistake_type == "mistake":
        return "medium"
    return "easy"


def _parse_uci(board: chess.Board, move_uci: str | None):
    if not move_uci:
        return None

    try:
        move = chess.Move.from_uci(move_uci)
    except ValueError:
        return None

    return move if move in board.legal_moves else None


def _is_fork(board: chess.Board, move: chess.Move):
    moved_piece = board.piece_at(move.from_square)
    if not moved_piece:
        return False

    board.push(move)
    try:
        attacked_targets = []
        for square in board.attacks(move.to_square):
            target = board.piece_at(square)
            if target and target.color != moved_piece.color:
                attacked_targets.append(target)

        valuable_targets = [
            target
            for target in attacked_targets
            if target.piece_type == chess.KING or PIECE_VALUES.get(target.piece_type, 0) >= 3
        ]

        return len(valuable_targets) >= 2
    finally:
        board.pop()


def _best_move_san(board: chess.Board, move: chess.Move):
    try:
        return board.san(move)
    except AssertionError:
        return move.uci()


def theme_from_move_analysis(move_analysis: MoveAnalysis):
    explanation = (move_analysis.explanation or "").lower()

    if "fork" in explanation:
        return "fork training"

    if "pin" in explanation:
        return "pin training"

    if "skewer" in explanation:
        return "skewer training"

    if "discovered" in explanation:
        return "discovered attack training"

    if "king safety" in explanation or "f-pawn" in explanation:
        return "king safety tactics"

    if move_analysis.fen_before and move_analysis.best_move:
        try:
            board = chess.Board(move_analysis.fen_before)
            best_move = _parse_uci(board, move_analysis.best_move)
        except ValueError:
            best_move = None

        if best_move:
            best_san = _best_move_san(board, best_move)
            if _is_fork(board, best_move):
                return "fork training"

            if "#" in best_san:
                return "mate training"

            if "+" in best_san:
                return "forcing check training"

            if "x" in best_san:
                return "capture training"

    if move_analysis.mistake_type == "blunder":
        return "critical blunder correction"

    if move_analysis.mistake_type == "mistake":
        return "mistake correction"

    if move_analysis.mistake_type == "inaccuracy":
        return "improve move precision"

    return "best move training"


def weakness_category_from_theme(theme: str | None):
    normalized = (theme or "").lower()

    if "fork" in normalized:
        return "missed forks"

    if "pin" in normalized:
        return "missed pins"

    if "skewer" in normalized:
        return "missed skewers"

    if "discovered" in normalized:
        return "missed discovered attacks"

    if "capture" in normalized:
        return "missed captures"

    if "mate" in normalized:
        return "missed mate or mating threat"

    if "king safety" in normalized:
        return "king safety"

    return None


def personalized_training_focus(db: Session, user_id: int):
    weakness = (
        db.query(Weakness)
        .filter(Weakness.user_id == user_id)
        .order_by(Weakness.severity.desc(), Weakness.frequency.desc(), Weakness.last_seen.desc())
        .first()
    )

    if weakness:
        return {
            "category": weakness.category,
            "frequency": weakness.frequency,
            "severity": weakness.severity,
            "message": f"You often miss {weakness.category.replace('missed ', '')}.",
        }

    return {
        "category": "best move training",
        "frequency": 0,
        "severity": 0,
        "message": "Analyze more games to unlock personalized tactical training.",
    }


def get_personalized_puzzle_queue(db: Session, user_id: int, limit: int = 20):
    focus = personalized_training_focus(db=db, user_id=user_id)
    category = focus["category"].replace("missed ", "").replace("safety", "safety").lower()
    theme_keywords = {
        "forks": ["fork"],
        "pins": ["pin"],
        "skewers": ["skewer"],
        "discovered attacks": ["discovered"],
        "captures": ["capture"],
        "king safety": ["king safety"],
        "mate or mating threat": ["mate"],
    }.get(category, [category])

    query = db.query(Puzzle).filter(Puzzle.user_id == user_id)
    matching = []

    for puzzle in query.order_by(Puzzle.created_at.desc()).all():
        theme = (puzzle.theme or "").lower()
        if any(keyword in theme for keyword in theme_keywords):
            matching.append(puzzle)

        if len(matching) >= limit:
            break

    if len(matching) < limit:
        existing_ids = {puzzle.id for puzzle in matching}
        fallback_query = query
        if existing_ids:
            fallback_query = fallback_query.filter(Puzzle.id.notin_(existing_ids))

        fallback = (
            fallback_query
            .order_by(Puzzle.created_at.desc())
            .limit(limit - len(matching))
            .all()
        )
        matching.extend(fallback)

    return {
        "focus": focus,
        "puzzles": matching,
    }


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


def build_puzzle_solution_line(fen: str, solution: str, max_plies: int = 7):
    try:
        board = chess.Board(fen)
    except ValueError:
        return []

    first_move = _parse_move(board, solution)
    if not first_move:
        return []

    line = []

    try:
        engine = chess.engine.SimpleEngine.popen_uci(settings.STOCKFISH_PATH)
    except Exception:
        return []

    try:
        move = first_move

        for index in range(max_plies):
            if move not in board.legal_moves:
                break

            fen_before = board.fen()
            color = "white" if board.turn == chess.WHITE else "black"
            san = board.san(move)
            board.push(move)

            line.append({
                "ply": index,
                "uci": move.uci(),
                "san": san,
                "color": color,
                "is_user_move": index % 2 == 0,
                "fen_before": fen_before,
                "fen_after": board.fen(),
                "is_checkmate": board.is_checkmate(),
            })

            if board.is_game_over() or index == max_plies - 1:
                break

            result = engine.play(
                board,
                chess.engine.Limit(depth=settings.STOCKFISH_DEPTH)
            )
            move = result.move
            if not move:
                break
    finally:
        engine.quit()

    return line


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
                theme = theme_from_move_analysis(move_analysis)
                puzzle = Puzzle(
                    user_id=user_id,
                    game_id=game.id,
                    move_analysis_id=move_analysis.id,
                    fen=board.fen(),
                    solution=move_analysis.best_move,
                    theme=theme,
                    difficulty=difficulty_from_mistake(move_analysis.mistake_type)
                )

                db.add(puzzle)
                generated_puzzles.append(puzzle)
                weakness_category = weakness_category_from_theme(theme)
                if weakness_category:
                    update_user_weakness(
                        db=db,
                        user_id=user_id,
                        category=weakness_category,
                        mistake_type=move_analysis.mistake_type,
                    )

        board.push(move)

    db.commit()

    for puzzle in generated_puzzles:
        db.refresh(puzzle)

    return generated_puzzles
