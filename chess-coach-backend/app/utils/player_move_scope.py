from sqlalchemy import func, or_

from app.models.analysis import MoveAnalysis
from app.models.game import Game


VALID_PLAYER_COLORS = ("white", "black")


def normalized_player_color(game: Game) -> str | None:
    if not game.color_played:
        return None

    color = game.color_played.strip().lower()
    return color if color in VALID_PLAYER_COLORS else None


def player_move_scope_filter():
    return or_(
        Game.color_played.is_(None),
        ~func.lower(Game.color_played).in_(VALID_PLAYER_COLORS),
        MoveAnalysis.color == func.lower(Game.color_played),
    )
