"""add_instructor_interventions

Revision ID: c1d2e3f4a5b6
Revises: b3c4d5e6f7a8
Create Date: 2026-05-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "instructor_interventions",
        sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
        sa.Column("instructor_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.UUID(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id_hash", sa.String(64), nullable=False),
        sa.Column("action_type", sa.String(50), nullable=False, server_default="flag"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_instructor_interventions_instructor_id", "instructor_interventions", ["instructor_id"])
    op.create_index("ix_instructor_interventions_course_id", "instructor_interventions", ["course_id"])
    op.create_index("ix_instructor_interventions_student_hash", "instructor_interventions", ["student_id_hash"])


def downgrade() -> None:
    op.drop_index("ix_instructor_interventions_student_hash", table_name="instructor_interventions")
    op.drop_index("ix_instructor_interventions_course_id", table_name="instructor_interventions")
    op.drop_index("ix_instructor_interventions_instructor_id", table_name="instructor_interventions")
    op.drop_table("instructor_interventions")
