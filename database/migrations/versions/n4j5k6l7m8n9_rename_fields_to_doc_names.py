"""rename assessment_item and syllabus fields to capstone doc names

Revision ID: n4j5k6l7m8n9
Revises: m3i4j5k6l7m8
Create Date: 2026-06-02

Renames DB columns to match the capstone §3.4 schema:
  assessment_items.confidence_score -> mapping_confidence
  assessment_items.needs_review     -> requires_review
  syllabi.parsed_json               -> llm_structured_output
"""
from alembic import op

revision = 'n4j5k6l7m8n9'
down_revision = 'm3i4j5k6l7m8'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('assessment_items', 'confidence_score', new_column_name='mapping_confidence')
    op.alter_column('assessment_items', 'needs_review', new_column_name='requires_review')
    op.alter_column('syllabi', 'parsed_json', new_column_name='llm_structured_output')


def downgrade():
    op.alter_column('syllabi', 'llm_structured_output', new_column_name='parsed_json')
    op.alter_column('assessment_items', 'requires_review', new_column_name='needs_review')
    op.alter_column('assessment_items', 'mapping_confidence', new_column_name='confidence_score')
