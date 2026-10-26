"""
Assessment score CSV upload: one item per distinct question, and the optional
competency_code column that tags questions directly (no LLM topic mapping).
"""

import pytest

from backend.core.limiter import limiter
from backend.models.assessment import (
    Assessment, AssessmentItem, AssessmentApprovalStatus, AssessmentType, GradingPeriod,
)
from backend.models.course import Course
from backend.models.score import StudentScore
from backend.models.syllabus import Competency, Syllabus, SyllabusStatus

HEADER = "student_id,question_text,score,max_score,competency_code\n"


@pytest.fixture(autouse=True)
def _isolate_upload(monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)

    # No network: LLM mapping "fails", so untagged questions land in the review queue
    def _no_llm(*args, **kwargs):
        raise RuntimeError("LLM unavailable in tests")
    monkeypatch.setattr("backend.routers.assessments.map_question_to_competency", _no_llm)


@pytest.fixture
def assessment(db, instructor_user):
    course = Course(title="Data Structures", code="ITC 212", academic_period="AY 2025-2026 S1",
                    instructor_id=instructor_user.id)
    db.add(course)
    db.flush()
    syllabus = Syllabus(course_id=course.id, file_path="x.docx", status=SyllabusStatus.validated)
    db.add(syllabus)
    db.flush()
    for code, topic in [("DSA-01", "Algorithm Analysis"), ("DSA-02", "Linked Lists")]:
        db.add(Competency(syllabus_id=syllabus.id, competency_code=code, topic_name=topic, learning_outcomes=[]))
    a = Assessment(course_id=course.id, title="Prelim", type=AssessmentType.exam,
                   grading_period=GradingPeriod.prelim, approval_status=AssessmentApprovalStatus.approved)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def _upload(client, token, assessment_id, body):
    return client.post(
        f"/assessments/{assessment_id}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("scores.csv", body.encode(), "text/csv")},
    )


def test_one_item_per_question_and_competency_code_tags(client, db, instructor_token, assessment):
    body = HEADER + (
        "2024-0001,What is Big-O of array access?,5,5,dsa-01\n"
        "2024-0001,Insert a node at the head of a linked list.,8,10,\n"
        "2024-0002,What is  Big-O of array access?,3,5,DSA-01\n"   # same question, extra space
        "2024-0002,Insert a node at the head of a linked list.,6,10,\n"
    )
    res = _upload(client, instructor_token, assessment.id, body)
    assert res.status_code == 200, res.text
    summary = res.json()
    assert summary["total_rows"] == 4
    assert summary["items_created"] == 2
    assert summary["questions"] == 2
    assert summary["pre_tagged"] == 1
    assert summary["flagged_for_review"] == 1

    items = {i.question_text: i for i in db.query(AssessmentItem).all()}
    assert len(items) == 2
    tagged = items["What is Big-O of array access?"]
    assert tagged.mapped_competency.competency_code == "DSA-01"
    assert (tagged.confidence_score, tagged.needs_review) == (1.0, False)
    assert tagged.validated_by is not None

    untagged = items["Insert a node at the head of a linked list."]
    assert untagged.mapped_competency_id is None and untagged.needs_review is True

    scores = db.query(StudentScore).all()
    assert len(scores) == 4
    assert {s.item_id for s in scores} == {tagged.id, untagged.id}


def test_second_batch_reuses_existing_questions(client, db, instructor_token, assessment):
    _upload(client, instructor_token, assessment.id, HEADER + "2024-0001,Define a stack.,4,5,\n")
    res = _upload(client, instructor_token, assessment.id, HEADER + "2024-0002,define a stack.,5,5,DSA-02\n")
    assert res.status_code == 200, res.text
    assert res.json()["items_created"] == 0
    item = db.query(AssessmentItem).one()
    db.refresh(item)
    assert item.mapped_competency.competency_code == "DSA-02"
    assert item.needs_review is False
    assert db.query(StudentScore).count() == 2


def test_unknown_competency_code_rejected(client, db, instructor_token, assessment):
    res = _upload(client, instructor_token, assessment.id, HEADER + "2024-0001,Define a stack.,4,5,DSA-99\n")
    assert res.status_code == 422
    assert "DSA-99" in res.json()["detail"] and "DSA-01" in res.json()["detail"]
    assert db.query(AssessmentItem).count() == 0


def test_conflicting_codes_for_same_question_rejected(client, db, instructor_token, assessment):
    body = HEADER + (
        "2024-0001,Define a stack.,4,5,DSA-01\n"
        "2024-0002,Define a stack.,5,5,DSA-02\n"
    )
    res = _upload(client, instructor_token, assessment.id, body)
    assert res.status_code == 422
    assert "conflicting" in res.json()["detail"]
    assert db.query(StudentScore).count() == 0


def test_csv_without_competency_code_column_still_works(client, instructor_token, assessment):
    body = "student_id,question_text,score,max_score\n2024-0001,Define a stack.,4,5\n2024-0002,Define a stack.,3,5\n"
    res = _upload(client, instructor_token, assessment.id, body)
    assert res.status_code == 200, res.text
    assert res.json()["items_created"] == 1
    assert res.json()["flagged_for_review"] == 1


def test_upload_fills_competency_mastery(client, db, instructor_token, assessment):
    """Pre-tagged scores carry their competency, and the post-upload refresh writes
    competency_mastery rows (capstone Table 9) without running the seed script."""
    from backend.models.competency_mastery import CompetencyMastery

    body = HEADER + (
        "2024-0001,What is Big-O of array access?,2,5,DSA-01\n"
        "2024-0002,What is Big-O of array access?,5,5,DSA-01\n"
    )
    res = _upload(client, instructor_token, assessment.id, body)
    assert res.status_code == 200, res.text

    assert all(s.competency_id is not None for s in db.query(StudentScore).all())
    rows = db.query(CompetencyMastery).all()
    assert len(rows) == 2
    by_pct = sorted((r.mastery_percentage, r.mastery_level, r.risk_flag) for r in rows)
    assert by_pct == [(40.0, "Emerging", True), (100.0, "Proficient", False)]


def test_ingestion_is_measured(client, db, instructor_token, admin_token, assessment):
    """Each upload attempt is recorded with outcome and timing; admins see the
    parse rate and latency vs. the < 2 s target (capstone §3.1 Objective 1)."""
    ok = _upload(client, instructor_token, assessment.id, HEADER + "2024-0001,Q1?,1,1,DSA-01\n")
    assert ok.status_code == 200
    bad = _upload(client, instructor_token, assessment.id, "wrong,header\n1,2\n")
    assert bad.status_code == 422

    stats = client.get("/analytics/admin/ingestion-stats",
                       headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert stats["target_ms"] == 2000
    csv = next(k for k in stats["kinds"] if k["kind"] == "assessment_csv")
    assert csv["attempts"] == 2 and csv["parsed_ok"] == 1
    assert csv["parse_rate_pct"] == 50.0
    assert csv["median_ms"] >= 0

    forbidden = client.get("/analytics/admin/ingestion-stats",
                           headers={"Authorization": f"Bearer {instructor_token}"})
    assert forbidden.status_code == 403
