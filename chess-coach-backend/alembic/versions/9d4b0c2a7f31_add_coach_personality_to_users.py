"""add coach personality to users

Revision ID: 9d4b0c2a7f31
Revises: b7a8c9d0e1f2
Create Date: 2026-05-17 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "9d4b0c2a7f31"
down_revision: Union[str, None] = "b7a8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("coach_personality", sa.String(), nullable=False, server_default="friendly"),
    )
    op.alter_column("users", "coach_personality", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "coach_personality")
