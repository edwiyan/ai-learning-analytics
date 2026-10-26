"""add program_outcomes to programs

Revision ID: v2r3s4t5u6v7
Revises: u1q2r3s4t5u6
Create Date: 2026-10-26

Capstone §3.11.2 Phase 1: syllabus CLOs are checked against program outcomes.
"""
from alembic import op
import sqlalchemy as sa

revision = 'v2r3s4t5u6v7'
down_revision = 'u1q2r3s4t5u6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('programs', sa.Column('program_outcomes', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('programs', 'program_outcomes')
