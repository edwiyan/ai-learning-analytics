"""add source to competencies (faculty-created topic tags)

Revision ID: r8n9o0p1q2r3
Revises: q7m8n9o0p1q2
Create Date: 2026-10-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'r8n9o0p1q2r3'
down_revision = 'q7m8n9o0p1q2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('competencies', sa.Column(
        'source', sa.String(), nullable=False, server_default='syllabus'))


def downgrade():
    op.drop_column('competencies', 'source')
