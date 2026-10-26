"""add grade submissions

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import backend.core.types

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE gradesubmissionstatus AS ENUM
                ('draft', 'pending_pd', 'pending_dean', 'pending_vp', 'posted', 'rejected');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.create_table(
        'grade_submissions',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('course_id', backend.core.types.GUID(), nullable=False),
        sa.Column('instructor_id', backend.core.types.GUID(), nullable=False),
        sa.Column('grading_period', postgresql.ENUM('prelim', 'midterm', 'semi_final', 'final', name='gradingperiod', create_type=False), nullable=False),
        sa.Column(
            'status',
            postgresql.ENUM('draft', 'pending_pd', 'pending_dean', 'pending_vp', 'posted', 'rejected',
                    name='gradesubmissionstatus', create_type=False),
            nullable=False,
            server_default='draft',
        ),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('posted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id']),
        sa.ForeignKeyConstraint(['instructor_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_grade_submissions_course_id', 'grade_submissions', ['course_id'])
    op.create_index('ix_grade_submissions_instructor_id', 'grade_submissions', ['instructor_id'])

    op.create_table(
        'grade_submission_approvals',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('submission_id', backend.core.types.GUID(), nullable=False),
        sa.Column('approver_id', backend.core.types.GUID(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['submission_id'], ['grade_submissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approver_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_grade_submission_approvals_submission_id', 'grade_submission_approvals', ['submission_id'])


def downgrade():
    op.drop_index('ix_grade_submission_approvals_submission_id', 'grade_submission_approvals')
    op.drop_table('grade_submission_approvals')
    op.drop_index('ix_grade_submissions_instructor_id', 'grade_submissions')
    op.drop_index('ix_grade_submissions_course_id', 'grade_submissions')
    op.drop_table('grade_submissions')
    op.execute("DROP TYPE IF EXISTS gradesubmissionstatus")
