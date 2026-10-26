"""keep original AI mapping suggestion on assessment items

Revision ID: q7m8n9o0p1q2
Revises: p6l7m8n9o0p1
Create Date: 2026-10-26

Capstone §3.6.2: the mapping-accuracy audit compares the AI's initial mapping with
the final faculty decision, so the initial suggestion must survive overrides.
Existing AI-mapped items are backfilled from their current mapping where no faculty
member has validated them yet (best available evidence of the AI's choice).
"""
from alembic import op
import sqlalchemy as sa
import backend.core.types

revision = 'q7m8n9o0p1q2'
down_revision = 'p6l7m8n9o0p1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('assessment_items', sa.Column(
        'ai_suggested_competency_id', backend.core.types.GUID(),
        sa.ForeignKey('competencies.id'), nullable=True))
    op.add_column('assessment_items', sa.Column('ai_confidence', sa.Float(), nullable=True))
    op.add_column('assessment_items', sa.Column('ai_mapped_at', sa.DateTime(timezone=True), nullable=True))
    op.execute("""
        UPDATE assessment_items
        SET ai_suggested_competency_id = mapped_competency_id,
            ai_confidence = mapping_confidence
        WHERE mapped_competency_id IS NOT NULL
          AND validated_by IS NULL
          AND mapping_confidence IS NOT NULL
          AND mapping_confidence < 1.0
    """)


def downgrade():
    op.drop_column('assessment_items', 'ai_mapped_at')
    op.drop_column('assessment_items', 'ai_confidence')
    op.drop_column('assessment_items', 'ai_suggested_competency_id')
