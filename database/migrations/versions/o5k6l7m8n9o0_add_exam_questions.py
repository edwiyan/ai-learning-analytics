"""add exam_questions table

Revision ID: o5k6l7m8n9o0
Revises: n4j5k6l7m8n9
Create Date: 2026-10-25
"""
from alembic import op

revision = 'o5k6l7m8n9o0'
down_revision = 'n4j5k6l7m8n9'
branch_labels = None
depends_on = None


def upgrade():
    # Table may already exist if created via SQLAlchemy metadata before this migration was added
    op.execute("""
        CREATE TABLE IF NOT EXISTS exam_questions (
            id UUID NOT NULL,
            assessment_id UUID NOT NULL REFERENCES assessments(id),
            competency_id UUID REFERENCES competencies(id),
            question_text TEXT NOT NULL,
            question_type VARCHAR NOT NULL DEFAULT 'short_answer',
            choices JSON,
            answer_key TEXT,
            points FLOAT NOT NULL DEFAULT 1.0,
            bloom_level VARCHAR,
            order_index INTEGER NOT NULL DEFAULT 0,
            source VARCHAR NOT NULL DEFAULT 'manual',
            created_at TIMESTAMPTZ DEFAULT now(),
            PRIMARY KEY (id)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_exam_questions_assessment_id
        ON exam_questions (assessment_id)
    """)


def downgrade():
    op.drop_index('ix_exam_questions_assessment_id', 'exam_questions')
    op.drop_table('exam_questions')
