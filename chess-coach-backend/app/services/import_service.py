import io
import requests
import chess.pgn

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.game import Game


def parse_result_from_pgn(pgn_text: str):
    game = chess.pgn.read_game(io.StringIO(pgn_text))

    if not game:
        return None

    return game.headers.get("Result")


def import_chesscom_games(db: Session, user_id: int, username: str, max_games: int = 5):
    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"

    archives_response = requests.get(
        archives_url,
        headers={"User-Agent": "ChessCoachBackend/1.0"},
        timeout=15
    )

    if archives_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not fetch Chess.com archives"
        )

    archives = archives_response.json().get("archives", [])

    if not archives:
        return []

    imported_games = []

    for archive_url in reversed(archives):
        if len(imported_games) >= max_games:
            break

        games_response = requests.get(
            archive_url,
            headers={"User-Agent": "ChessCoachBackend/1.0"},
            timeout=15
        )

        if games_response.status_code != 200:
            continue

        games = games_response.json().get("games", [])

        for item in reversed(games):
            if len(imported_games) >= max_games:
                break

            pgn = item.get("pgn")

            if not pgn:
                continue

            existing = db.query(Game).filter(Game.pgn == pgn, Game.user_id == user_id).first()
            if existing:
                continue

            white_username = item.get("white", {}).get("username", "")
            black_username = item.get("black", {}).get("username", "")

            if white_username.lower() == username.lower():
                color_played = "white"
                opponent = black_username
            else:
                color_played = "black"
                opponent = white_username

            game = Game(
                user_id=user_id,
                source="chess.com",
                opponent=opponent,
                color_played=color_played,
                result=parse_result_from_pgn(pgn),
                time_control=item.get("time_control"),
                pgn=pgn
            )

            db.add(game)
            imported_games.append(game)

    db.commit()

    for game in imported_games:
        db.refresh(game)

    return imported_games


def import_lichess_games(db: Session, user_id: int, username: str, max_games: int = 5):
    url = f"https://lichess.org/api/games/user/{username}"

    response = requests.get(
        url,
        params={
            "max": max_games,
            "pgnInJson": "false",
            "clocks": "true",
            "opening": "true"
        },
        headers={
            "Accept": "application/x-chess-pgn",
            "User-Agent": "ChessCoachBackend/1.0"
        },
        timeout=30
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not fetch Lichess games"
        )

    raw_pgn = response.text.strip()

    if not raw_pgn:
        return []

    pgn_io = io.StringIO(raw_pgn)
    imported_games = []

    while len(imported_games) < max_games:
        parsed_game = chess.pgn.read_game(pgn_io)

        if parsed_game is None:
            break

        exporter = chess.pgn.StringExporter(headers=True, variations=True, comments=True)
        pgn_text = parsed_game.accept(exporter)

        existing = db.query(Game).filter(Game.pgn == pgn_text, Game.user_id == user_id).first()
        if existing:
            continue

        white = parsed_game.headers.get("White", "")
        black = parsed_game.headers.get("Black", "")

        if white.lower() == username.lower():
            color_played = "white"
            opponent = black
        else:
            color_played = "black"
            opponent = white

        game = Game(
            user_id=user_id,
            source="lichess",
            opponent=opponent,
            color_played=color_played,
            result=parsed_game.headers.get("Result"),
            time_control=parsed_game.headers.get("TimeControl"),
            pgn=pgn_text
        )

        db.add(game)
        imported_games.append(game)

    db.commit()

    for game in imported_games:
        db.refresh(game)

    return imported_games