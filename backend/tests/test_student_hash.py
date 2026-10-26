"""
Salted student-ID hashing (capstone §3.9.1): SHA-256(Student_ID + Salt), and the
re-key helper that migrates stored hashes when the salt changes.
"""
import hashlib

from backend.core import security
from backend.core.rehash import rehash_student_ids
from backend.models.score import StudentScore
from backend.models.user import User, UserRole
from backend.models.assessment import GradingPeriod


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def test_hash_uses_salt(monkeypatch):
    monkeypatch.setattr(security.settings, "student_id_salt", "pepper")
    assert security.hash_student_id("2024-0001") == _sha("2024-0001pepper")
    assert security.hash_student_id("2024-0001") != _sha("2024-0001")


def test_user_hashed_identifier_follows_salt(db, monkeypatch):
    monkeypatch.setattr(security.settings, "student_id_salt", "pepper")
    user = User(email="s@test.com", password_hash="x", full_name="S", role=UserRole.student,
                student_number="2024-0001", is_active=True)
    db.add(user)
    db.commit()
    assert user.hashed_identifier == _sha("2024-0001pepper")


def test_rehash_rekeys_scores_and_reports_orphans(db):
    user = User(email="s@test.com", password_hash="x", full_name="S", role=UserRole.student,
                student_number="2024-0001", is_active=True)
    db.add(user)
    db.flush()
    import uuid
    assessment_id = uuid.uuid4()
    db.add(StudentScore(student_id_hash=_sha("2024-0001"), assessment_id=assessment_id,
                        grading_period=GradingPeriod.prelim, score=5, max_score=10))
    db.add(StudentScore(student_id_hash=_sha("no-account"), assessment_id=assessment_id,
                        grading_period=GradingPeriod.prelim, score=5, max_score=10))
    db.commit()

    counts = rehash_student_ids(db.connection(), old_salt="", new_salt="pepper")
    db.commit()

    hashes = {s.student_id_hash for s in db.query(StudentScore).all()}
    assert _sha("2024-0001pepper") in hashes
    assert _sha("2024-0001") not in hashes
    assert counts["student_scores"] == 1
    assert counts["orphan_hashes"] == 1
