import io
import chess.pgn
from fastapi import HTTPException, status


def validate_pgn(pgn_text: str):
    pgn_io = io.StringIO(pgn_text)
    game = chess.pgn.read_game(pgn_io)

    if game is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PGN format"
        )

    return game


def extract_pgn_metadata(pgn_text: str):
    game = validate_pgn(pgn_text)

    headers = game.headers

    white = headers.get("White")
    black = headers.get("Black")
    result = headers.get("Result")
    time_control = headers.get("TimeControl")

    return {
        "white": white,
        "black": black,
        "result": result,
        "time_control": time_control
    }