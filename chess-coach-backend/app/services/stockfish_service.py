import io
import chess
import chess.pgn
import chess.engine

from fastapi import HTTPException, status

from app.core.config import settings


def score_to_float(score) -> float:
    if score.is_mate():
        mate_score = score.mate()
        return 100.0 if mate_score and mate_score > 0 else -100.0

    return score.score(mate_score=10000) / 100


def classify_mistake(eval_before: float, eval_after: float, color: str):
    if color == "black":
        loss = eval_after - eval_before
    else:
        loss = eval_before - eval_after

    if loss >= 3:
        return "blunder"
    elif loss >= 1.5:
        return "mistake"
    elif loss >= 0.7:
        return "inaccuracy"
    return "good"


def generate_explanation(mistake_type: str):
    if mistake_type == "blunder":
        return "This move caused a major loss in position. Review it carefully."
    if mistake_type == "mistake":
        return "This move weakened your position significantly."
    if mistake_type == "inaccuracy":
        return "This move was not the best and slightly reduced your advantage."
    return "Good or acceptable move."


def analyze_pgn(pgn_text: str):
    pgn_io = io.StringIO(pgn_text)
    game = chess.pgn.read_game(pgn_io)

    if game is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PGN"
        )

    board = game.board()

    try:
        engine = chess.engine.SimpleEngine.popen_uci(settings.STOCKFISH_PATH)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stockfish failed to start: {str(e)}"
        )

    move_results = []

    inaccuracies = 0
    mistakes = 0
    blunders = 0
    best_moves_found = 0

    try:
        for index, move in enumerate(game.mainline_moves(), start=1):
            color = "white" if board.turn == chess.WHITE else "black"
            move_number = board.fullmove_number
            fen_before = board.fen()

            before_info = engine.analyse(
                board,
                chess.engine.Limit(depth=settings.STOCKFISH_DEPTH)
            )

            eval_before = score_to_float(before_info["score"].white())
            best_move = before_info.get("pv", [None])[0]

            played_move_san = board.san(move)
            played_move_uci = move.uci()
            best_move_uci = best_move.uci() if best_move else None

            if best_move and move == best_move:
                best_moves_found += 1

            board.push(move)

            after_info = engine.analyse(
                board,
                chess.engine.Limit(depth=settings.STOCKFISH_DEPTH)
            )

            eval_after = score_to_float(after_info["score"].white())

            mistake_type = classify_mistake(eval_before, eval_after, color)

            if mistake_type == "inaccuracy":
                inaccuracies += 1
            elif mistake_type == "mistake":
                mistakes += 1
            elif mistake_type == "blunder":
                blunders += 1

            move_results.append({
                "move_number": move_number,
                "color": color,
                "fen_before": fen_before,
                "played_move": played_move_san,
                "played_move_uci": played_move_uci,
                "best_move": best_move_uci,
                "evaluation_before": eval_before,
                "evaluation_after": eval_after,
                "mistake_type": mistake_type,
                "explanation": generate_explanation(mistake_type)
            })

    finally:
        engine.quit()

    total_moves = len(move_results)

    bad_moves = inaccuracies + mistakes + blunders
    accuracy = 100 if total_moves == 0 else round(100 - ((bad_moves / total_moves) * 100), 2)

    return {
        "accuracy": accuracy,
        "inaccuracies": inaccuracies,
        "mistakes": mistakes,
        "blunders": blunders,
        "best_moves_found": best_moves_found,
        "moves": move_results
    }
