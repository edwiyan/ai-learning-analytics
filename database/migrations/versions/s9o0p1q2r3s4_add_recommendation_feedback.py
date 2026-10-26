"""add recommendation_feedback (student feedback loop)

Revision ID: s9o0p1q2r3s4
Revises: r8n9o0p1q2r3
Create Date: 2026-10-26

Capstone §2.3 Feedback Loop: students rate the usefulness of recommendations.
"""
from alembic import op
import sqlalchemy as sa
import backend.core.types

revision = 's9o0p1q2r3s4'
down_revision = 'r8n9o0p1q2r3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'recommendation_feedback',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('student_id_hash', sa.String(length=64), nullable=False),
        sa.Column('resource_id', backend.core.types.GUID(), nullable=False),
        sa.Column('course_id', backend.core.types.GUID(), nullable=True),
        sa.Column('helpful', sa.Boolean(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['resource_id'], ['resources.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id_hash', 'resource_id', name='uq_rec_feedback_student_resource'),
    )
    op.create_index('ix_recommendation_feedback_student_id_hash', 'recommendation_feedback', ['student_id_hash'])
    op.create_index('ix_recommendation_feedback_resource_id', 'recommendation_feedback', ['resource_id'])


def downgrade():
    op.drop_index('ix_recommendation_feedback_resource_id', 'recommendation_feedback')
    op.drop_index('ix_recommendation_feedback_student_id_hash', 'recommendation_feedback')
    op.drop_table('recommendation_feedback')
