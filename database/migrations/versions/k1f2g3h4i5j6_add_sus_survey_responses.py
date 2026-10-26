"""add sus_survey_responses table

Revision ID: k1f2g3h4i5j6
Revises: j0e1f2g3h4i5
Create Date: 2026-05-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'k1f2g3h4i5j6'
down_revision = 'j0e1f2g3h4i5'
branch_labels = None
depends_on = None


def upgrade():
    # Table may already exist if created via SQLAlchemy metadata before this migration was added
    op.execute("""
        CREATE TABLE IF NOT EXISTS sus_survey_responses (
            id UUID NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            responses JSONB NOT NULL,
            sus_score FLOAT NOT NULL,
            submitted_at TIMESTAMPTZ DEFAULT now(),
            PRIMARY KEY (id)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_sus_survey_responses_user_id
        ON sus_survey_responses (user_id)
    """)


def downgrade():
    op.drop_index('ix_sus_survey_responses_user_id', 'sus_survey_responses')
    op.drop_table('sus_survey_responses')
