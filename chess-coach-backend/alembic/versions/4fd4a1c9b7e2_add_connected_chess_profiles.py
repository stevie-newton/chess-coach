"""add connected chess profiles

Revision ID: 4fd4a1c9b7e2
Revises: dd9c7b4fa2c5
Create Date: 2026-05-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4fd4a1c9b7e2"
down_revision: Union[str, Sequence[str], None] = "dd9c7b4fa2c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("chesscom_username", sa.String(), nullable=True))
    op.add_column("users", sa.Column("lichess_username", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "lichess_username")
    op.drop_column("users", "chesscom_username")
