"""salt student id hashes

Revision ID: p6l7m8n9o0p1
Revises: o5k6l7m8n9o0
Create Date: 2026-10-26

Capstone §3.9.1: hashed_identifier = SHA-256(Student_ID + Salt). Re-keys every
stored student hash from the unsalted form to the salt in STUDENT_ID_SALT.
Set STUDENT_ID_SALT in .env BEFORE running this; with no salt it is a no-op.
Hashes of students with no user account cannot be re-keyed (see core/rehash.py).
"""
from alembic import op

from backend.core.config import settings
from backend.core.rehash import rehash_student_ids

revision = 'p6l7m8n9o0p1'
down_revision = 'o5k6l7m8n9o0'
branch_labels = None
depends_on = None


def upgrade():
    counts = rehash_student_ids(op.get_bind(), old_salt="", new_salt=settings.student_id_salt)
    print(f"[p6l7m8n9o0p1] re-keyed student hashes: {counts}")


def downgrade():
    rehash_student_ids(op.get_bind(), old_salt=settings.student_id_salt, new_salt="")
