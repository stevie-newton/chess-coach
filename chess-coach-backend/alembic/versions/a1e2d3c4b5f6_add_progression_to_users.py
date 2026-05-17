"""add progression to users

Revision ID: a1e2d3c4b5f6
Revises: 9d4b0c2a7f31
Create Date: 2026-05-17 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a1e2d3c4b5f6"
down_revision: Union[str, None] = "9d4b0c2a7f31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("xp_points", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("training_level", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("users", sa.Column("training_streak", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("last_training_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("endgame_completions", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("calculation_completions", sa.Integer(), nullable=False, server_default="0"))

    op.alter_column("users", "xp_points", server_default=None)
    op.alter_column("users", "training_level", server_default=None)
    op.alter_column("users", "training_streak", server_default=None)
    op.alter_column("users", "endgame_completions", server_default=None)
    op.alter_column("users", "calculation_completions", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "calculation_completions")
    op.drop_column("users", "endgame_completions")
    op.drop_column("users", "last_training_completed_at")
    op.drop_column("users", "training_streak")
    op.drop_column("users", "training_level")
    op.drop_column("users", "xp_points")
