"""add hashed_identifier and competency_mastery

Revision ID: m3i4j5k6l7m8
Revises: l2h3i4j5k6l7
Create Date: 2026-06-02

Brings the schema into line with the capstone document:
  - Users.hashed_identifier (SHA-256 of student_number) — §3.4
  - competency_mastery pre-aggregation table — Table 9
"""
from alembic import op
import sqlalchemy as sa
import hashlib
import backend.core.types

revision = 'm3i4j5k6l7m8'
down_revision = 'l2h3i4j5k6l7'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Users.hashed_identifier (SHA-256 of student_number) — capstone §3.4
    op.add_column('users', sa.Column('hashed_identifier', sa.String(), nullable=True))
    op.create_index('ix_users_hashed_identifier', 'users', ['hashed_identifier'])

    # Backfill existing students
    conn = op.get_bind()
    rows = conn.execute(sa.text(
        "SELECT id, student_number FROM users WHERE student_number IS NOT NULL"
    )).fetchall()
    for row in rows:
        digest = hashlib.sha256(str(row.student_number).encode()).hexdigest()
        conn.execute(
            sa.text("UPDATE users SET hashed_identifier = :h WHERE id = :i"),
            {"h": digest, "i": row.id},
        )

    # 2. competency_mastery table — capstone Table 9
    op.create_table(
        'competency_mastery',
        sa.Column('id', backend.core.types.GUID(), nullable=False),
        sa.Column('student_id_hash', sa.String(), nullable=False),
        sa.Column('course_id', backend.core.types.GUID(), nullable=False),
        sa.Column('competency_id', backend.core.types.GUID(), nullable=False),
        sa.Column('mastery_percentage', sa.Float(), nullable=False),
        sa.Column('mastery_level', sa.String(), nullable=False),
        sa.Column('risk_flag', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id']),
        sa.ForeignKeyConstraint(['competency_id'], ['competencies.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_competency_mastery_student_id_hash', 'competency_mastery', ['student_id_hash'])


def downgrade():
    op.drop_index('ix_competency_mastery_student_id_hash', table_name='competency_mastery')
    op.drop_table('competency_mastery')
    op.drop_index('ix_users_hashed_identifier', table_name='users')
    op.drop_column('users', 'hashed_identifier')
