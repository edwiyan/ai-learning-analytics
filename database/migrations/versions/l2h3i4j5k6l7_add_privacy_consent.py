"""add privacy_consents table

Revision ID: l2h3i4j5k6l7
Revises: k1f2g3h4i5j6
Create Date: 2026-05-27
"""
from alembic import op

revision = 'l2h3i4j5k6l7'
down_revision = 'k1f2g3h4i5j6'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS privacy_consents (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            student_id_hash VARCHAR(64) NOT NULL,
            accepted BOOLEAN NOT NULL,
            version VARCHAR(10) NOT NULL DEFAULT '1.0',
            ip_address VARCHAR(45),
            timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_privacy_consents_user_id ON privacy_consents (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_privacy_consents_student_id_hash ON privacy_consents (student_id_hash)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_privacy_consents_student_id_hash")
    op.execute("DROP INDEX IF EXISTS ix_privacy_consents_user_id")
    op.execute("DROP TABLE IF EXISTS privacy_consents")
