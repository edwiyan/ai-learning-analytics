"""institution_settings: configurable operational thresholds

Revision ID: x4t5u6v7w8x9
Revises: w3s4t5u6v7w8
Create Date: 2026-10-27

Panel comment 2: the at-risk and mapping thresholds are institutional decisions, so
BTECH can set them without code changes. Rows only exist for values changed from the
defaults in services/institution_settings.py.
"""
from alembic import op
import sqlalchemy as sa
import backend.core.types

revision = 'x4t5u6v7w8x9'
down_revision = 'w3s4t5u6v7w8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'institution_settings',
        sa.Column('key', sa.String(length=64), primary_key=True),
        sa.Column('value', sa.JSON(), nullable=True),
        sa.Column('updated_by', backend.core.types.GUID(),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_table('institution_settings')
