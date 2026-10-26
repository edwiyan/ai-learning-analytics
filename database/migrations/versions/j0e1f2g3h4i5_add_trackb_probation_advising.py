"""add track b probation and advising

Revision ID: j0e1f2g3h4i5
Revises: i9d0e1f2g3h4
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'j0e1f2g3h4i5'
down_revision = 'i9d0e1f2g3h4'
branch_labels = None
depends_on = None


def upgrade():
    # T5-C: advising fields on grade_consultations
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE advisingtype AS ENUM (
                'remediation','enrichment','counseling_referral',
                'retake_guidance','no_action_needed'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.add_column('grade_consultations',
        sa.Column('advising_type',
            sa.Enum('remediation','enrichment','counseling_referral',
                    'retake_guidance','no_action_needed', name='advisingtype', create_type=False),
            nullable=True))
    op.add_column('grade_consultations', sa.Column('advising_content', sa.Text, nullable=True))
    op.add_column('grade_consultations',
        sa.Column('retake_recommended', sa.Boolean, nullable=False, server_default='false'))
    op.add_column('grade_consultations', sa.Column('retake_notes', sa.Text, nullable=True))

    # T5-D: academic_standings table
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE academicstandinglevel AS ENUM (
                'good','warning','probation','dismissal_risk'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.create_table(
        'academic_standings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id_hash', sa.String(64), nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('academic_year', sa.String(20), nullable=True),
        sa.Column('semester', sa.String(20), nullable=True),
        sa.Column('standing',
            postgresql.ENUM('good','warning','probation','dismissal_risk', name='academicstandinglevel', create_type=False),
            nullable=False, server_default='good'),
        sa.Column('computed_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_academic_standings_student', 'academic_standings', ['student_id_hash'])
    op.create_index('ix_academic_standings_course',  'academic_standings', ['course_id'])
    op.create_unique_constraint(
        'uq_academic_standing_student_course', 'academic_standings',
        ['student_id_hash', 'course_id']
    )


def downgrade():
    op.drop_constraint('uq_academic_standing_student_course', 'academic_standings', type_='unique')
    op.drop_index('ix_academic_standings_course',  'academic_standings')
    op.drop_index('ix_academic_standings_student', 'academic_standings')
    op.drop_table('academic_standings')
    op.execute("DROP TYPE IF EXISTS academicstandinglevel;")
    op.drop_column('grade_consultations', 'retake_notes')
    op.drop_column('grade_consultations', 'retake_recommended')
    op.drop_column('grade_consultations', 'advising_content')
    op.drop_column('grade_consultations', 'advising_type')
    op.execute("DROP TYPE IF EXISTS advisingtype;")
