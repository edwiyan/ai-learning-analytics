"""add approval roles: program_director, dean, vp_academic_affairs

Revision ID: d9e8f7a6b5c4
Revises: c1d2e3f4a5b6
Create Date: 2026-05-19 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'd9e8f7a6b5c4'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL requires each value to be added individually
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'program_director'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'dean'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'vp_academic_affairs'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values natively.
    # To roll back: drop dependent columns, recreate enum without these values, restore columns.
    pass
