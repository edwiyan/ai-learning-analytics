"""add notifications

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa
import backend.core.types

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'notifications',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('user_id', backend.core.types.GUID(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('related_id', sa.String(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_is_read', 'notifications', ['user_id', 'is_read'])


def downgrade():
    op.drop_index('ix_notifications_is_read', 'notifications')
    op.drop_index('ix_notifications_user_id', 'notifications')
    op.drop_table('notifications')
