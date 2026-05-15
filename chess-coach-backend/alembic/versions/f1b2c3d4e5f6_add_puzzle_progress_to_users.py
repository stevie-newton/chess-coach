"""add puzzle progress to users

Revision ID: f1b2c3d4e5f6
Revises: c3f8a91e0d12
Create Date: 2026-05-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "c3f8a91e0d12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("puzzle_rating", sa.Integer(), nullable=False, server_default="1200"),
    )
    op.add_column(
        "users",
        sa.Column("puzzle_streak", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "puzzle_streak")
    op.drop_column("users", "puzzle_rating")
