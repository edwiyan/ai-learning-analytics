"""add assessment approval

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa
import backend.core.types

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE TYPE assessmentapprovalstatus AS ENUM ('draft', 'pending_pd', 'approved', 'rejected')")

    op.add_column('assessments', sa.Column(
        'approval_status',
        sa.Enum('draft', 'pending_pd', 'approved', 'rejected', name='assessmentapprovalstatus', create_type=False),
        nullable=False,
        server_default='draft',
    ))

    op.create_table(
        'assessment_approvals',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('assessment_id', backend.core.types.GUID(), nullable=False),
        sa.Column('approver_id', backend.core.types.GUID(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.Column('content_validity', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('difficulty_appropriate', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('instructions_clear', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('bias_free', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('outcomes_covered', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['assessment_id'], ['assessments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approver_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_assessment_approvals_assessment_id', 'assessment_approvals', ['assessment_id'])


def downgrade():
    op.drop_index('ix_assessment_approvals_assessment_id', 'assessment_approvals')
    op.drop_table('assessment_approvals')
    op.drop_column('assessments', 'approval_status')
    op.execute("DROP TYPE IF EXISTS assessmentapprovalstatus")
