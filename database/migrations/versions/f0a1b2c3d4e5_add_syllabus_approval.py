"""add syllabus approval chain: approval_stage column + syllabus_approvals table

Revision ID: f0a1b2c3d4e5
Revises: e8f9a0b1c2d3
Create Date: 2026-05-20 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from backend.core.types import GUID

revision: str = 'f0a1b2c3d4e5'
down_revision: Union[str, None] = 'e8f9a0b1c2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

APPROVAL_STAGE_VALUES = ('draft', 'pending_pd', 'approved_pd', 'pending_dean', 'approved_dean', 'pending_vp', 'fully_approved', 'rejected')


def upgrade() -> None:
    op.execute("CREATE TYPE approvalstage AS ENUM ('draft', 'pending_pd', 'approved_pd', 'pending_dean', 'approved_dean', 'pending_vp', 'fully_approved', 'rejected')")

    op.add_column(
        'syllabi',
        sa.Column(
            'approval_stage',
            sa.Enum(*APPROVAL_STAGE_VALUES, name='approvalstage', create_type=False),
            server_default='draft',
            nullable=False,
        ),
    )

    op.create_table(
        'syllabus_approvals',
        sa.Column('id', GUID(), primary_key=True),
        sa.Column('syllabus_id', GUID(), sa.ForeignKey('syllabi.id'), nullable=False),
        sa.Column('approver_id', GUID(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('feedback', sa.String(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('syllabus_approvals')
    op.drop_column('syllabi', 'approval_stage')
    op.execute('DROP TYPE approvalstage')
