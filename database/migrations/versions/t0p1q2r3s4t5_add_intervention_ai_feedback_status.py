"""add ai_feedback and status tracking to instructor_interventions

Revision ID: t0p1q2r3s4t5
Revises: s9o0p1q2r3s4
Create Date: 2026-10-26

Capstone §3.4: the Interventions table logs AI feedback and status tracking.
"""
from alembic import op
import sqlalchemy as sa

revision = 't0p1q2r3s4t5'
down_revision = 's9o0p1q2r3s4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('instructor_interventions', sa.Column('ai_feedback', sa.Text(), nullable=True))
    op.add_column('instructor_interventions', sa.Column(
        'status', sa.String(length=20), nullable=False, server_default='open'))
    op.add_column('instructor_interventions', sa.Column('status_updated_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('instructor_interventions', 'status_updated_at')
    op.drop_column('instructor_interventions', 'status')
    op.drop_column('instructor_interventions', 'ai_feedback')
