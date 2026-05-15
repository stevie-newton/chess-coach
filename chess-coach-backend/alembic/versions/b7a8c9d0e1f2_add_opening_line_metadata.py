"""add opening line metadata

Revision ID: b7a8c9d0e1f2
Revises: f1b2c3d4e5f6
Create Date: 2026-05-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7a8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("opening_lines", sa.Column("variation_name", sa.String(), nullable=True))
    op.add_column(
        "opening_lines",
        sa.Column("difficulty", sa.String(), nullable=False, server_default="medium"),
    )


def downgrade() -> None:
    op.drop_column("opening_lines", "difficulty")
    op.drop_column("opening_lines", "variation_name")
