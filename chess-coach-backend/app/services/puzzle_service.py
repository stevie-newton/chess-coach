import io
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