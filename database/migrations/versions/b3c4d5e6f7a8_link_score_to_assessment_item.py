"""link_score_to_assessment_item

Revision ID: b3c4d5e6f7a8
Revises: 7cdcf6555b87
Create Date: 2026-05-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = '7cdcf6555b87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('student_scores', sa.Column('item_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_student_scores_item_id',
        'student_scores', 'assessment_items',
        ['item_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_student_scores_item_id', 'student_scores', type_='foreignkey')
    op.drop_column('student_scores', 'item_id')
