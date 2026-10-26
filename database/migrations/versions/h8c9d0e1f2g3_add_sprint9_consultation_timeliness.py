"""add sprint9 grade consultation and intervention improvement plan

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import backend.core.types

revision = 'h8c9d0e1f2g3'
down_revision = 'g7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade():
    # T5-A: academicstatus enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE academicstatus AS ENUM ('passed', 'failed', 'incomplete', 'dropped');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # T5-A + T5-B: grade_consultations table (includes T5-B incomplete fields)
    op.create_table(
        'grade_consultations',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('instructor_id', backend.core.types.GUID(), nullable=False),
        sa.Column('course_id', backend.core.types.GUID(), nullable=False),
        sa.Column('student_id_hash', sa.String(64), nullable=False),
        sa.Column('grading_period', postgresql.ENUM(
            'prelim', 'midterm', 'semi_final', 'final', name='gradingperiod', create_type=False
        ), nullable=True),
        sa.Column('conducted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('academic_status', postgresql.ENUM(
            'passed', 'failed', 'incomplete', 'dropped', name='academicstatus', create_type=False
        ), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('next_steps', sa.Text(), nullable=True),
        sa.Column('incomplete_reason', sa.Text(), nullable=True),
        sa.Column('completion_deadline', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['instructor_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_consultation_student', 'grade_consultations', ['student_id_hash'])
    op.create_index('ix_consultation_course', 'grade_consultations', ['course_id'])
    op.create_index('ix_consultation_instructor', 'grade_consultations', ['instructor_id'])

    # T4-B: improvement plan columns on instructor_interventions
    op.add_column('instructor_interventions', sa.Column('goal_description', sa.Text(), nullable=True))
    op.add_column('instructor_interventions', sa.Column('target_score', sa.Float(), nullable=True))
    op.add_column('instructor_interventions', sa.Column('target_period', sa.String(50), nullable=True))
    op.add_column('instructor_interventions', sa.Column('follow_up_date', sa.Date(), nullable=True))
    op.add_column('instructor_interventions', sa.Column(
        'plan_accepted_by_student', sa.Boolean(), nullable=False, server_default='false'
    ))


def downgrade():
    op.drop_column('instructor_interventions', 'plan_accepted_by_student')
    op.drop_column('instructor_interventions', 'follow_up_date')
    op.drop_column('instructor_interventions', 'target_period')
    op.drop_column('instructor_interventions', 'target_score')
    op.drop_column('instructor_interventions', 'goal_description')
    op.drop_index('ix_consultation_instructor', 'grade_consultations')
    op.drop_index('ix_consultation_course', 'grade_consultations')
    op.drop_index('ix_consultation_student', 'grade_consultations')
    op.drop_table('grade_consultations')
    op.execute("DROP TYPE IF EXISTS academicstatus")
