"""add played move uci to move analyses

Revision ID: a8e2f6d4c1b9
Revises: 4fd4a1c9b7e2
Create Date: 2026-05-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8e2f6d4c1b9"
down_revision: Union[str, Sequence[str], None] = "4fd4a1c9b7e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("move_analyses", sa.Column("played_move_uci", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("move_analyses", "played_move_uci")
