from sqlalchemy.orm import Session

from app.models.game import Game
from app.models.analysis import GameAnalysis, MoveAnalysis

from app.services.stockfish_service import analyze_pgn
from app.services.weakness_service import (
    detect_weakness_category,
    update_user_weakness
)


def analyze_game_and_save(
    db: Session,
    user_id: int,
    game: Game
):
    existing_analysis = (
        db.query(GameAnalysis)
        .filter(GameAnalysis.game_id == game.id)
        .first()
    )

    if existing_analysis:
        existing_moves_count = (
            db.query(MoveAnalysis)
            .filter(MoveAnalysis.game_id == game.id)
            .count()
        )

        if existing_moves_count > 0:
            return existing_analysis

        db.delete(existing_analysis)
        db.commit()

    result = analyze_pgn(game.pgn)

    analysis = GameAnalysis(
        game_id=game.id,
        accuracy=result["accuracy"],
        inaccuracies=result["inaccuracies"],
        mistakes=result["mistakes"],
        blunders=result["blunders"],
        best_moves_found=result["best_moves_found"]
    )

    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    for move in result["moves"]:
        move_analysis = MoveAnalysis(
            game_id=game.id,
            move_number=move["move_number"],
            color=move["color"],
            fen_before=move["fen_before"],
            played_move=move["played_move"],
            played_move_uci=move["played_move_uci"],
            best_move=move["best_move"],
            evaluation_before=move["evaluation_before"],
            evaluation_after=move["evaluation_after"],
            mistake_type=move["mistake_type"],
            explanation=move["explanation"]
        )

        db.add(move_analysis)

        category = detect_weakness_category(
            move_number=move["move_number"],
            mistake_type=move["mistake_type"],
            explanation=move["explanation"]
        )

        if category:
            update_user_weakness(
                db=db,
                user_id=user_id,
                category=category,
                mistake_type=move["mistake_type"]
            )

    db.commit()

    return analysis
