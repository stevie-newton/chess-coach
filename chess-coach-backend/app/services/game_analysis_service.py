from sqlalchemy.orm import Session

from app.models.game import Game
from app.models.analysis import GameAnalysis, MoveAnalysis
from app.models.user import User

from app.services.move_coaching_service import premium_move_explanation
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
    player_color = (
        game.color_played.strip().lower()
        if game.color_played and game.color_played.strip().lower() in {"white", "black"}
        else None
    )
    existing_analysis = (
        db.query(GameAnalysis)
        .filter(GameAnalysis.game_id == game.id)
        .first()
    )

    if existing_analysis:
        existing_moves = (
            db.query(MoveAnalysis)
            .filter(MoveAnalysis.game_id == game.id)
            .all()
        )

        analysis_matches_player = (
            existing_moves
            and (
                player_color is None
                or all(move.color == player_color for move in existing_moves)
            )
        )
        if analysis_matches_player:
            return existing_analysis

        for move in existing_moves:
            db.delete(move)
        db.delete(existing_analysis)
        db.commit()

    user = db.query(User).filter(User.id == user_id).first()
    result = analyze_pgn(game.pgn, player_color=player_color)

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
        explanation = premium_move_explanation(
            move=move,
            coach_personality=user.coach_personality if user else None
        )

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
            explanation=explanation
        )

        db.add(move_analysis)

        category = detect_weakness_category(
            move_number=move["move_number"],
            mistake_type=move["mistake_type"],
            explanation=explanation
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
