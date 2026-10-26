"""add role to assessment_approvals

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('assessment_approvals', sa.Column('role', sa.String(), nullable=True))


def downgrade():
    op.drop_column('assessment_approvals', 'role')
