"""add sprint8 attendance and intervention type

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import backend.core.types

revision = 'g7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    # T4-A: interventiontype enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE interventiontype AS ENUM (
                'academic_counseling', 'tutoring_referral', 'study_skills_workshop',
                'peer_mentoring', 'modified_learning_strategy', 'time_management_coaching',
                'wellness_support_referral', 'general_note'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # T4-A: intervention_type column on instructor_interventions
    op.add_column('instructor_interventions', sa.Column(
        'intervention_type',
        postgresql.ENUM(
            'academic_counseling', 'tutoring_referral', 'study_skills_workshop',
            'peer_mentoring', 'modified_learning_strategy', 'time_management_coaching',
            'wellness_support_referral', 'general_note',
            name='interventiontype', create_type=False,
        ),
        nullable=True,
    ))

    # T6-A: attendancestatus enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE attendancestatus AS ENUM ('present', 'absent', 'late', 'excused');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # T6-A: attendance_records table
    op.create_table(
        'attendance_records',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('student_id_hash', sa.String(64), nullable=False),
        sa.Column('course_id', backend.core.types.GUID(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column(
            'status',
            postgresql.ENUM('present', 'absent', 'late', 'excused', name='attendancestatus', create_type=False),
            nullable=False,
        ),
        sa.Column('recorded_by', backend.core.types.GUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recorded_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_attendance_student', 'attendance_records', ['student_id_hash'])
    op.create_index('ix_attendance_course', 'attendance_records', ['course_id'])
    op.create_index('ix_attendance_date', 'attendance_records', ['date'])


def downgrade():
    op.drop_index('ix_attendance_date', 'attendance_records')
    op.drop_index('ix_attendance_course', 'attendance_records')
    op.drop_index('ix_attendance_student', 'attendance_records')
    op.drop_table('attendance_records')
    op.execute("DROP TYPE IF EXISTS attendancestatus")
    op.drop_column('instructor_interventions', 'intervention_type')
    op.execute("DROP TYPE IF EXISTS interventiontype")
