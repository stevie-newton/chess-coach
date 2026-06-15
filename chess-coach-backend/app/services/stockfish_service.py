import io
import chess
import chess.pgn
import chess.engine

from fastapi import HTTPException, status

from app.core.config import settings

PIECE_NAMES = {
    chess.PAWN: "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK: "rook",
    chess.QUEEN: "queen",
    chess.KING: "king",
}

PIECE_LOSS_THRESHOLDS = [
    (8.0, "queen"),
    (4.2, "rook"),
    (2.4, "bishop or knight"),
    (0.8, "pawn"),
]

SEARCH_PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,
}


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


def loss_for_color(eval_before: float, eval_after: float, color: str) -> float:
    if color == "black":
        return eval_after - eval_before

    return eval_before - eval_after


def move_loss_piece_name(board: chess.Board, move: chess.Move, loss: float) -> str | None:
    moved_piece = board.piece_at(move.from_square)

    if moved_piece and loss >= 2.4 and moved_piece.piece_type in [chess.BISHOP, chess.KNIGHT, chess.ROOK, chess.QUEEN]:
        return PIECE_NAMES[moved_piece.piece_type]

    for threshold, piece_name in PIECE_LOSS_THRESHOLDS:
        if loss >= threshold:
            return piece_name

    return None


def generate_explanation(
    mistake_type: str,
    loss: float,
    piece_name: str | None,
    best_move_san: str | None,
):
    best_move_line = f" Best move: {best_move_san}." if best_move_san else ""

    if mistake_type == "blunder":
        if piece_name:
            return f"Blunder: You lost your {piece_name}.{best_move_line}"
        return f"Blunder: The evaluation dropped by {loss:.1f} pawns.{best_move_line}"

    if mistake_type == "mistake":
        if piece_name:
            return f"Mistake: This gives up about a {piece_name}.{best_move_line}"
        return f"Mistake: The evaluation dropped by {loss:.1f} pawns.{best_move_line}"

    if mistake_type == "inaccuracy":
        return f"Inaccuracy: This missed a more precise move.{best_move_line}"

    if best_move_san:
        return f"Good move. Stockfish also considered {best_move_san}."

    return "Good or acceptable move."


def _fallback_evaluate_board(board: chess.Board) -> int:
    if board.is_checkmate():
        return -100000 if board.turn == chess.WHITE else 100000

    if board.is_stalemate() or board.is_insufficient_material():
        return 0

    score = 0
    center_squares = [chess.D4, chess.E4, chess.D5, chess.E5]

    for square, piece in board.piece_map().items():
        value = SEARCH_PIECE_VALUES[piece.piece_type]
        if square in center_squares:
            value += 18 if piece.piece_type == chess.PAWN else 10
        score += value if piece.color == chess.WHITE else -value

    mobility_turn = board.turn
    mobility = board.legal_moves.count()
    board.turn = not board.turn
    opponent_mobility = board.legal_moves.count()
    board.turn = mobility_turn
    mobility_score = (mobility - opponent_mobility) * 3

    return score + (mobility_score if board.turn == chess.WHITE else -mobility_score)


def _fallback_search(board: chess.Board, depth: int, alpha: int, beta: int) -> int:
    if depth == 0 or board.is_game_over():
        return _fallback_evaluate_board(board)

    if board.turn == chess.WHITE:
        value = -1000000
        for move in board.legal_moves:
            board.push(move)
            value = max(value, _fallback_search(board, depth - 1, alpha, beta))
            board.pop()
            alpha = max(alpha, value)
            if alpha >= beta:
                break
        return value

    value = 1000000
    for move in board.legal_moves:
        board.push(move)
        value = min(value, _fallback_search(board, depth - 1, alpha, beta))
        board.pop()
        beta = min(beta, value)
        if alpha >= beta:
            break
    return value


def fallback_best_move_for_fen(fen: str, depth: int = 3):
    try:
        board = chess.Board(fen)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid FEN"
        )

    if board.is_game_over():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game is already over"
        )

    legal_moves = list(board.legal_moves)
    if not legal_moves:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No legal moves found"
        )

    search_depth = max(2, min(depth, 4))
    best_move = legal_moves[0]
    best_score = -1000000 if board.turn == chess.WHITE else 1000000

    for move in legal_moves:
        board.push(move)
        score = _fallback_search(board, search_depth - 1, -1000000, 1000000)
        board.pop()

        if board.turn == chess.WHITE and score > best_score:
            best_score = score
            best_move = move
        elif board.turn == chess.BLACK and score < best_score:
            best_score = score
            best_move = move

    return {
        "move": best_move.uci(),
        "san": board.san(best_move),
        "evaluation": round(best_score / 100, 2),
        "depth": search_depth,
        "source": "fallback",
    }


def best_move_for_fen(fen: str, depth: int | None = None):
    try:
        board = chess.Board(fen)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid FEN"
        )

    if board.is_game_over():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game is already over"
        )

    try:
        engine = chess.engine.SimpleEngine.popen_uci(settings.STOCKFISH_PATH)
    except Exception as e:
        return fallback_best_move_for_fen(fen, depth=depth or 3)

    try:
        limit = chess.engine.Limit(depth=depth or settings.STOCKFISH_DEPTH)
        result = engine.play(board, limit)
        if not result.move:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stockfish did not return a legal move"
            )

        score_info = engine.analyse(board, limit)
        score = score_to_float(score_info["score"].white())

        return {
            "move": result.move.uci(),
            "san": board.san(result.move),
            "evaluation": score,
            "depth": depth or settings.STOCKFISH_DEPTH,
            "source": "stockfish",
        }
    finally:
        engine.quit()


def analyze_pgn(pgn_text: str, player_color: str | None = None):
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

    normalized_player_color = (
        player_color.strip().lower()
        if player_color and player_color.strip().lower() in {"white", "black"}
        else None
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

            if normalized_player_color and color != normalized_player_color:
                board.push(move)
                continue

            before_info = engine.analyse(
                board,
                chess.engine.Limit(depth=settings.STOCKFISH_DEPTH)
            )

            eval_before = score_to_float(before_info["score"].white())
            best_move = before_info.get("pv", [None])[0]
            best_move_san = board.san(best_move) if best_move else None

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
            loss = max(0, loss_for_color(eval_before, eval_after, color))
            loss_piece_name = None
            if mistake_type != "good":
                previous_board = chess.Board(fen_before)
                loss_piece_name = move_loss_piece_name(previous_board, move, loss)

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
                "best_move_san": best_move_san,
                "evaluation_before": eval_before,
                "evaluation_after": eval_after,
                "mistake_type": mistake_type,
                "explanation": generate_explanation(
                    mistake_type=mistake_type,
                    loss=loss,
                    piece_name=loss_piece_name,
                    best_move_san=best_move_san
                )
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
