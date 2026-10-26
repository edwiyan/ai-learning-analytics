"""add sprint7 quality grading

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import backend.core.types

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None

BLOOM_LEVELS = ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating']


def upgrade():
    # T3-C: assessmentcategory enum + column on assessments
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE assessmentcategory AS ENUM ('formative', 'summative');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.add_column('assessments', sa.Column(
        'assessment_category',
        postgresql.ENUM('formative', 'summative', name='assessmentcategory', create_type=False),
        nullable=True,
    ))

    # T3-E-07: passing_grade on courses
    op.add_column('courses', sa.Column(
        'passing_grade', sa.Float(), nullable=False, server_default='75.0'
    ))

    # T3-B: bloom_level on competencies and assessment_items
    op.add_column('competencies', sa.Column('bloom_level', sa.String(), nullable=True))
    op.add_column('assessment_items', sa.Column('bloom_level', sa.String(), nullable=True))

    # T3-D: grade_weights table
    op.create_table(
        'grade_weights',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('course_id', backend.core.types.GUID(), nullable=False),
        sa.Column('grading_period', postgresql.ENUM(
            'prelim', 'midterm', 'semi_final', 'final', name='gradingperiod', create_type=False
        ), nullable=False),
        sa.Column('assessment_category', postgresql.ENUM(
            'formative', 'summative', name='assessmentcategory', create_type=False
        ), nullable=False),
        sa.Column('weight_percent', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', 'grading_period', 'assessment_category', name='uq_grade_weight'),
    )

    # T3-E: grade_scales table with BTECH 1.00–5.00 seed data
    op.create_table(
        'grade_scales',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('min_percent', sa.Float(), nullable=False),
        sa.Column('max_percent', sa.Float(), nullable=False),
        sa.Column('letter_grade', sa.String(), nullable=False),
        sa.Column('grade_points', sa.Float(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # Seed BTECH numeric grading scale (1.00 = Excellent, 5.00 = Failed)
    op.execute("""
        INSERT INTO grade_scales (id, min_percent, max_percent, letter_grade, grade_points, description) VALUES
        (gen_random_uuid(), 97, 100, '1.00', 1.00, 'Excellent'),
        (gen_random_uuid(), 94,  96, '1.25', 1.25, 'Excellent'),
        (gen_random_uuid(), 91,  93, '1.50', 1.50, 'Very Good'),
        (gen_random_uuid(), 88,  90, '1.75', 1.75, 'Very Good'),
        (gen_random_uuid(), 85,  87, '2.00', 2.00, 'Good'),
        (gen_random_uuid(), 82,  84, '2.25', 2.25, 'Good'),
        (gen_random_uuid(), 79,  81, '2.50', 2.50, 'Satisfactory'),
        (gen_random_uuid(), 76,  78, '2.75', 2.75, 'Satisfactory'),
        (gen_random_uuid(), 75,  75, '3.00', 3.00, 'Passed'),
        (gen_random_uuid(),  0,  74, '5.00', 5.00, 'Failed')
    """)

    # T3-A: table_of_specifications
    op.create_table(
        'table_of_specifications',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('assessment_id', backend.core.types.GUID(), nullable=False),
        sa.Column('competency_id', backend.core.types.GUID(), nullable=False),
        sa.Column('bloom_level', sa.String(), nullable=True),
        sa.Column('item_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('weight_percent', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['assessment_id'], ['assessments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['competency_id'], ['competencies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tos_assessment_id', 'table_of_specifications', ['assessment_id'])


def downgrade():
    op.drop_index('ix_tos_assessment_id', 'table_of_specifications')
    op.drop_table('table_of_specifications')
    op.drop_table('grade_scales')
    op.drop_table('grade_weights')
    op.drop_column('assessment_items', 'bloom_level')
    op.drop_column('competencies', 'bloom_level')
    op.drop_column('courses', 'passing_grade')
    op.drop_column('assessments', 'assessment_category')
    op.execute("DROP TYPE IF EXISTS assessmentcategory")
