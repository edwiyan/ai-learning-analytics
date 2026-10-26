"""add llm_cache (deterministic LLM response cache)

Revision ID: u1q2r3s4t5u6
Revises: t0p1q2r3s4t5
Create Date: 2026-10-26

Capstone §3.9.2 Inconsistent Output: identical prompts return the cached answer.
"""
from alembic import op
import sqlalchemy as sa
import backend.core.types

revision = 'u1q2r3s4t5u6'
down_revision = 't0p1q2r3s4t5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'llm_cache',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('cache_key', sa.String(length=64), nullable=False),
        sa.Column('purpose', sa.String(length=50), nullable=True),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('provider', sa.String(length=20), nullable=False),
        sa.Column('response', sa.Text(), nullable=False),
        sa.Column('hit_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('last_hit_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_llm_cache_cache_key', 'llm_cache', ['cache_key'], unique=True)


def downgrade():
    op.drop_index('ix_llm_cache_cache_key', 'llm_cache')
    op.drop_table('llm_cache')
