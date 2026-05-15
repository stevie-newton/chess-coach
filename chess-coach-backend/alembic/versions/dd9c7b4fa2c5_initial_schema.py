"""initial schema

Revision ID: dd9c7b4fa2c5
Revises:
Create Date: 2026-05-11 01:47:20.007757

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "dd9c7b4fa2c5"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("chess_level", sa.String(), nullable=True),
        sa.Column("target_rating", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "games",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("opponent", sa.String(), nullable=True),
        sa.Column("color_played", sa.String(), nullable=True),
        sa.Column("result", sa.String(), nullable=True),
        sa.Column("time_control", sa.String(), nullable=True),
        sa.Column("pgn", sa.Text(), nullable=False),
        sa.Column("played_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_games_id"), "games", ["id"], unique=False)

    op.create_table(
        "openings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=False),
        sa.Column("starting_moves", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_openings_id"), "openings", ["id"], unique=False)

    op.create_table(
        "study_schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("day", sa.String(), nullable=False),
        sa.Column("focus_area", sa.String(), nullable=False),
        sa.Column("activity", sa.String(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_study_schedules_id"), "study_schedules", ["id"], unique=False)

    op.create_table(
        "tournament_simulations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("time_control", sa.String(), nullable=False),
        sa.Column("opponent_style", sa.String(), nullable=False),
        sa.Column("result", sa.String(), nullable=True),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tournament_simulations_id"), "tournament_simulations", ["id"], unique=False)

    op.create_table(
        "training_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("focus_area", sa.String(), nullable=False),
        sa.Column("activity", sa.String(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_training_sessions_id"), "training_sessions", ["id"], unique=False)

    op.create_table(
        "weaknesses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("frequency", sa.Integer(), nullable=True),
        sa.Column("severity", sa.Integer(), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_weaknesses_id"), "weaknesses", ["id"], unique=False)

    op.create_table(
        "game_analyses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("inaccuracies", sa.Integer(), nullable=True),
        sa.Column("mistakes", sa.Integer(), nullable=True),
        sa.Column("blunders", sa.Integer(), nullable=True),
        sa.Column("best_moves_found", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_game_analyses_id"), "game_analyses", ["id"], unique=False)

    op.create_table(
        "move_analyses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("move_number", sa.Integer(), nullable=False),
        sa.Column("color", sa.String(), nullable=False),
        sa.Column("fen_before", sa.String(), nullable=True),
        sa.Column("played_move", sa.String(), nullable=False),
        sa.Column("best_move", sa.String(), nullable=True),
        sa.Column("evaluation_before", sa.Float(), nullable=True),
        sa.Column("evaluation_after", sa.Float(), nullable=True),
        sa.Column("mistake_type", sa.String(), nullable=True),
        sa.Column("explanation", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_move_analyses_id"), "move_analyses", ["id"], unique=False)

    op.create_table(
        "opening_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("opening_id", sa.Integer(), nullable=False),
        sa.Column("move_order", sa.Integer(), nullable=False),
        sa.Column("fen", sa.Text(), nullable=False),
        sa.Column("best_move", sa.String(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["opening_id"], ["openings.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_opening_lines_id"), "opening_lines", ["id"], unique=False)

    op.create_table(
        "mistake_replay_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("move_analysis_id", sa.Integer(), nullable=False),
        sa.Column("user_move", sa.String(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("time_taken_seconds", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["move_analysis_id"], ["move_analyses.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_mistake_replay_attempts_id"), "mistake_replay_attempts", ["id"], unique=False)

    op.create_table(
        "mistake_review_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("move_analysis_id", sa.Integer(), nullable=False),
        sa.Column("ease_factor", sa.Integer(), nullable=True),
        sa.Column("interval_days", sa.Integer(), nullable=True),
        sa.Column("repetitions", sa.Integer(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["move_analysis_id"], ["move_analyses.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_mistake_review_states_id"), "mistake_review_states", ["id"], unique=False)

    op.create_table(
        "puzzles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("move_analysis_id", sa.Integer(), nullable=True),
        sa.Column("fen", sa.Text(), nullable=False),
        sa.Column("solution", sa.String(), nullable=False),
        sa.Column("theme", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
        sa.ForeignKeyConstraint(["move_analysis_id"], ["move_analyses.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_puzzles_id"), "puzzles", ["id"], unique=False)

    op.create_table(
        "opening_practice_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("opening_id", sa.Integer(), nullable=False),
        sa.Column("opening_line_id", sa.Integer(), nullable=False),
        sa.Column("user_move", sa.String(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("time_taken_seconds", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["opening_id"], ["openings.id"]),
        sa.ForeignKeyConstraint(["opening_line_id"], ["opening_lines.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_opening_practice_attempts_id"), "opening_practice_attempts", ["id"], unique=False)

    op.create_table(
        "puzzle_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("puzzle_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("user_move", sa.String(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("time_taken_seconds", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["puzzle_id"], ["puzzles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_puzzle_attempts_id"), "puzzle_attempts", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_puzzle_attempts_id"), table_name="puzzle_attempts")
    op.drop_table("puzzle_attempts")
    op.drop_index(op.f("ix_opening_practice_attempts_id"), table_name="opening_practice_attempts")
    op.drop_table("opening_practice_attempts")
    op.drop_index(op.f("ix_puzzles_id"), table_name="puzzles")
    op.drop_table("puzzles")
    op.drop_index(op.f("ix_mistake_review_states_id"), table_name="mistake_review_states")
    op.drop_table("mistake_review_states")
    op.drop_index(op.f("ix_mistake_replay_attempts_id"), table_name="mistake_replay_attempts")
    op.drop_table("mistake_replay_attempts")
    op.drop_index(op.f("ix_opening_lines_id"), table_name="opening_lines")
    op.drop_table("opening_lines")
    op.drop_index(op.f("ix_move_analyses_id"), table_name="move_analyses")
    op.drop_table("move_analyses")
    op.drop_index(op.f("ix_game_analyses_id"), table_name="game_analyses")
    op.drop_table("game_analyses")
    op.drop_index(op.f("ix_weaknesses_id"), table_name="weaknesses")
    op.drop_table("weaknesses")
    op.drop_index(op.f("ix_training_sessions_id"), table_name="training_sessions")
    op.drop_table("training_sessions")
    op.drop_index(op.f("ix_tournament_simulations_id"), table_name="tournament_simulations")
    op.drop_table("tournament_simulations")
    op.drop_index(op.f("ix_study_schedules_id"), table_name="study_schedules")
    op.drop_table("study_schedules")
    op.drop_index(op.f("ix_openings_id"), table_name="openings")
    op.drop_table("openings")
    op.drop_index(op.f("ix_games_id"), table_name="games")
    op.drop_table("games")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
