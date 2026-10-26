"""mapping validation: faculty ground truth for AI topic mapping

Revision ID: y5u6v7w8x9y0
Revises: x4t5u6v7w8x9
Create Date: 2026-10-27

Panel comment 1: mapping accuracy is measured against a blind, two-validator,
adjudicated ground-truth sample instead of the AI's own confidence score.
"""
from alembic import op
import sqlalchemy as sa
import backend.core.types

revision = 'y5u6v7w8x9y0'
down_revision = 'x4t5u6v7w8x9'
branch_labels = None
depends_on = None

G = backend.core.types.GUID


def upgrade():
    op.create_table(
        'mapping_validation_sets',
        sa.Column('id', G(), primary_key=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('sample_size', sa.Integer(), nullable=False),
        sa.Column('seed', sa.Integer(), nullable=False),
        sa.Column('review_threshold', sa.Float(), nullable=False),
        sa.Column('created_by', G(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        'mapping_validation_assignments',
        sa.Column('id', G(), primary_key=True),
        sa.Column('set_id', G(), sa.ForeignKey('mapping_validation_sets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('course_id', G(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('validator_a_id', G(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('validator_b_id', G(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('adjudicator_id', G(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.UniqueConstraint('set_id', 'course_id', name='uq_validation_assignment_course'),
    )
    op.create_index('ix_mapping_validation_assignments_set_id', 'mapping_validation_assignments', ['set_id'])
    op.create_table(
        'mapping_validation_items',
        sa.Column('id', G(), primary_key=True),
        sa.Column('set_id', G(), sa.ForeignKey('mapping_validation_sets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('course_id', G(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assessment_item_id', G(), sa.ForeignKey('assessment_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('ai_competency_id', G(), sa.ForeignKey('competencies.id', ondelete='SET NULL'), nullable=True),
        sa.Column('ai_confidence', sa.Float(), nullable=True),
        sa.Column('confidence_band', sa.String(length=10), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.UniqueConstraint('set_id', 'assessment_item_id', name='uq_validation_item'),
    )
    op.create_index('ix_mapping_validation_items_set_id', 'mapping_validation_items', ['set_id'])
    op.create_index('ix_mapping_validation_items_course_id', 'mapping_validation_items', ['course_id'])
    op.create_table(
        'mapping_validation_labels',
        sa.Column('id', G(), primary_key=True),
        sa.Column('item_id', G(), sa.ForeignKey('mapping_validation_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('validator_id', G(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('competency_id', G(), sa.ForeignKey('competencies.id', ondelete='SET NULL'), nullable=True),
        sa.Column('none_fits', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('labeled_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('item_id', 'validator_id', name='uq_validation_label'),
    )
    op.create_index('ix_mapping_validation_labels_item_id', 'mapping_validation_labels', ['item_id'])
    op.create_table(
        'mapping_validation_adjudications',
        sa.Column('id', G(), primary_key=True),
        sa.Column('item_id', G(), sa.ForeignKey('mapping_validation_items.id', ondelete='CASCADE'),
                  nullable=False, unique=True),
        sa.Column('adjudicator_id', G(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('competency_id', G(), sa.ForeignKey('competencies.id', ondelete='SET NULL'), nullable=True),
        sa.Column('none_fits', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_table('mapping_validation_adjudications')
    op.drop_index('ix_mapping_validation_labels_item_id', table_name='mapping_validation_labels')
    op.drop_table('mapping_validation_labels')
    op.drop_index('ix_mapping_validation_items_course_id', table_name='mapping_validation_items')
    op.drop_index('ix_mapping_validation_items_set_id', table_name='mapping_validation_items')
    op.drop_table('mapping_validation_items')
    op.drop_index('ix_mapping_validation_assignments_set_id', table_name='mapping_validation_assignments')
    op.drop_table('mapping_validation_assignments')
    op.drop_table('mapping_validation_sets')
