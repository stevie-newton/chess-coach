import io
import requests
import chess.pgn

from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.game import Game


def normalize_max_games(max_games: int):
    return max(1, min(max_games, 100))


def parse_chesscom_played_at(item: dict):
    end_time = item.get("end_time")

    if end_time is None:
        return None

    try:
        return datetime.fromtimestamp(int(end_time), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def parse_chesscom_sort_timestamp(item: dict):
    end_time = item.get("end_time") or item.get("last_activity") or item.get("start_time")

    try:
        return int(end_time)
    except (TypeError, ValueError):
        return 0


def parse_lichess_played_at(parsed_game):
    utc_date = parsed_game.headers.get("UTCDate") or parsed_game.headers.get("Date")
    utc_time = parsed_game.headers.get("UTCTime") or "00:00:00"

    if not utc_date or "?" in utc_date:
        return None

    try:
        return datetime.strptime(
            f"{utc_date} {utc_time}",
            "%Y.%m.%d %H:%M:%S",
        ).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def update_existing_played_at(existing: Game, played_at):
    if played_at and not existing.played_at:
        existing.played_at = played_at
        return True

    return False


def parse_result_from_pgn(pgn_text: str):
    game = chess.pgn.read_game(io.StringIO(pgn_text))

    if not game:
        return None

    return game.headers.get("Result")


def import_chesscom_games(db: Session, user_id: int, username: str, max_games: int = 5):
    max_games = normalize_max_games(max_games)
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

    recent_items = []

    for archive_url in reversed(archives):
        if len(recent_items) >= max_games:
            break

        games_response = requests.get(
            archive_url,
            headers={"User-Agent": "ChessCoachBackend/1.0"},
            timeout=15
        )

        if games_response.status_code != 200:
            continue

        games = sorted(
            games_response.json().get("games", []),
            key=parse_chesscom_sort_timestamp,
            reverse=True,
        )

        for item in games:
            if len(recent_items) >= max_games:
                break

            pgn = item.get("pgn")

            if not pgn:
                continue

            recent_items.append(item)

    imported_games = []

    for item in recent_items:
        pgn = item.get("pgn")
        played_at = parse_chesscom_played_at(item)
        existing = db.query(Game).filter(Game.pgn == pgn, Game.user_id == user_id).first()
        if existing:
            update_existing_played_at(existing, played_at)
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
            pgn=pgn,
            played_at=played_at,
        )

        db.add(game)
        imported_games.append(game)

    db.commit()

    for game in imported_games:
        db.refresh(game)

    return imported_games


def import_lichess_games(db: Session, user_id: int, username: str, max_games: int = 5):
    max_games = normalize_max_games(max_games)
    url = f"https://lichess.org/api/games/user/{username}"

    response = requests.get(
        url,
        params={
            "max": max_games,
            "pgnInJson": "false",
            "clocks": "true",
            "opening": "true",
            "finished": "true",
            "sort": "dateDesc",
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
    candidates = []

    while True:
        parsed_game = chess.pgn.read_game(pgn_io)

        if parsed_game is None:
            break

        exporter = chess.pgn.StringExporter(headers=True, variations=True, comments=True)
        pgn_text = parsed_game.accept(exporter)
        played_at = parse_lichess_played_at(parsed_game)

        candidates.append((played_at, parsed_game, pgn_text))

    candidates.sort(
        key=lambda candidate: candidate[0] or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    imported_games = []

    for played_at, parsed_game, pgn_text in candidates[:max_games]:
        existing = db.query(Game).filter(Game.pgn == pgn_text, Game.user_id == user_id).first()
        if existing:
            update_existing_played_at(existing, played_at)
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
            pgn=pgn_text,
            played_at=played_at,
        )

        db.add(game)
        imported_games.append(game)

    db.commit()

    for game in imported_games:
        db.refresh(game)

    return imported_games
