"""add college to users

Revision ID: a1b2c3d4e5f6
Revises: f0a1b2c3d4e5
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'f0a1b2c3d4e5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('college', sa.String(), nullable=True))
    op.create_index('ix_users_college', 'users', ['college'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_users_college', table_name='users')
    op.drop_column('users', 'college')
