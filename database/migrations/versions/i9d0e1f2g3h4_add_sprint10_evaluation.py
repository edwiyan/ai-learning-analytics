"""add sprint10 evaluation

Revision ID: i9d0e1f2g3h4
Revises: h8c9d0e1f2g3
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'i9d0e1f2g3h4'
down_revision = 'h8c9d0e1f2g3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sus_survey_responses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('responses', sa.JSON(), nullable=False),
        sa.Column('sus_score', sa.Float(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_sus_survey_responses_user_id', 'sus_survey_responses', ['user_id'])


def downgrade():
    op.drop_index('ix_sus_survey_responses_user_id', 'sus_survey_responses')
    op.drop_table('sus_survey_responses')
