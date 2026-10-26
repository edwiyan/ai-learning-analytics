"""add curriculum layer: programs, curricula, curriculum_subjects, sections, enrollments

Revision ID: e8f9a0b1c2d3
Revises: d9e8f7a6b5c4
Create Date: 2026-05-20 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from backend.core.types import GUID

revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, None] = 'd9e8f7a6b5c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'programs',
        sa.Column('id', GUID(), primary_key=True),
        sa.Column('program_name', sa.String(), nullable=False),
        sa.Column('degree_type', sa.String(), nullable=False),
        sa.Column('ched_cmo_reference', sa.String(), nullable=True),
        sa.Column('total_units', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'curricula',
        sa.Column('id', GUID(), primary_key=True),
        sa.Column('program_id', GUID(), sa.ForeignKey('programs.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('ched_cmo_reference', sa.String(), nullable=True),
        sa.Column('effective_year', sa.Integer(), nullable=False),
        sa.Column('total_units', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
    )

    op.create_table(
        'curriculum_subjects',
        sa.Column('id', GUID(), primary_key=True),
        sa.Column('curriculum_id', GUID(), sa.ForeignKey('curricula.id'), nullable=False),
        sa.Column('subject_code', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('units', sa.Integer(), nullable=False),
        sa.Column('year_level', sa.Integer(), nullable=False),
        sa.Column('semester', sa.Integer(), nullable=False),
        sa.Column('prerequisite_subject_id', GUID(), sa.ForeignKey('curriculum_subjects.id'), nullable=True),
    )

    op.create_table(
        'sections',
        sa.Column('id', GUID(), primary_key=True),
        sa.Column('curriculum_id', GUID(), sa.ForeignKey('curricula.id'), nullable=False),
        sa.Column('section_name', sa.String(), nullable=False),
        sa.Column('year_level', sa.Integer(), nullable=False),
        sa.Column('academic_year', sa.String(), nullable=False),
    )

    op.create_table(
        'student_enrollments',
        sa.Column('id', GUID(), primary_key=True),
        sa.Column('student_id_hash', sa.String(64), nullable=False),
        sa.Column('section_id', GUID(), sa.ForeignKey('sections.id'), nullable=False),
        sa.Column('curriculum_id', GUID(), sa.ForeignKey('curricula.id'), nullable=False),
        sa.Column('enrollment_date', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
    )

    op.add_column('courses', sa.Column('curriculum_subject_id', GUID(), sa.ForeignKey('curriculum_subjects.id'), nullable=True))
    op.add_column('courses', sa.Column('section_id', GUID(), sa.ForeignKey('sections.id'), nullable=True))


def downgrade() -> None:
    op.drop_column('courses', 'section_id')
    op.drop_column('courses', 'curriculum_subject_id')
    op.drop_table('student_enrollments')
    op.drop_table('sections')
    op.drop_table('curriculum_subjects')
    op.drop_table('curricula')
    op.drop_table('programs')
