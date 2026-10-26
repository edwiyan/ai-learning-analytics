"""Re-key every stored student hash from one salt to another.

Student identifiers are stored only as SHA-256(Student_ID + Salt). When the salt
changes (or is introduced for the first time), every stored hash must be rewritten
or users lose the link to their scores. The mapping old -> new is rebuilt from
users.student_number, so hashes belonging to students without an account cannot
be re-keyed and are reported back as orphans.
"""
import hashlib

import sqlalchemy as sa

# Every table/column that stores a student hash.
HASH_COLUMNS = [
    ("student_scores", "student_id_hash"),
    ("student_enrollments", "student_id_hash"),
    ("competency_mastery", "student_id_hash"),
    ("risk_predictions", "student_id_hash"),
    ("recommendations", "student_id_hash"),
    ("attendance_records", "student_id_hash"),
    ("instructor_interventions", "student_id_hash"),
    ("grade_consultations", "student_id_hash"),
    ("academic_standings", "student_id_hash"),
    ("privacy_consents", "student_id_hash"),
]


def _digest(student_number: str, salt: str) -> str:
    return hashlib.sha256((str(student_number) + salt).encode()).hexdigest()


def rehash_student_ids(conn, old_salt: str, new_salt: str) -> dict:
    """Rewrite all stored hashes from old_salt to new_salt. Returns per-table counts
    plus the number of orphan hashes that could not be mapped."""
    if old_salt == new_salt:
        return {"skipped": True}

    inspector = sa.inspect(conn)
    existing = set(inspector.get_table_names())

    students = conn.execute(sa.text(
        "SELECT id, student_number FROM users WHERE student_number IS NOT NULL"
    )).fetchall()
    mapping = {_digest(s.student_number, old_salt): _digest(s.student_number, new_salt) for s in students}

    counts = {}
    known_new = set(mapping.values())
    orphans = set()
    for table, column in HASH_COLUMNS:
        if table not in existing:
            continue
        updated = 0
        for old, new in mapping.items():
            result = conn.execute(
                sa.text(f"UPDATE {table} SET {column} = :new WHERE {column} = :old"),
                {"new": new, "old": old},
            )
            updated += result.rowcount or 0
        counts[table] = updated
        rows = conn.execute(sa.text(f"SELECT DISTINCT {column} FROM {table}")).fetchall()
        orphans.update(r[0] for r in rows if r[0] not in known_new)

    for s in students:
        conn.execute(
            sa.text("UPDATE users SET hashed_identifier = :h WHERE id = :i"),
            {"h": _digest(s.student_number, new_salt), "i": s.id},
        )
    counts["users"] = len(students)
    counts["orphan_hashes"] = len(orphans)
    return counts
