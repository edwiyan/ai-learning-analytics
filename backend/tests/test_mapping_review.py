"""
Human-in-the-loop mapping review (capstone §3.6.2): faculty override / revert of
AI topic mappings.
"""

import pytest

from backend.models.assessment import (
    Assessment, AssessmentItem, AssessmentApprovalStatus, AssessmentType, GradingPeriod,
)
from backend.models.course import Course
from backend.models.score import StudentScore
from backend.models.syllabus import Competency, Syllabus, SyllabusStatus


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mapped(db, instructor_user):
    """A course with a validated syllabus (2 competencies), one assessment item the
    AI mapped to DSA-01 with low confidence, and one student score on that item."""
    course = Course(title="Data Structures", code="ITC 212", academic_period="AY 2025-2026 S1",
                    instructor_id=instructor_user.id)
    db.add(course)
    db.flush()
    syllabus = Syllabus(course_id=course.id, file_path="x.docx", status=SyllabusStatus.validated)
    db.add(syllabus)
    db.flush()
    comps = {}
    for code, topic in [("DSA-01", "Algorithm Analysis"), ("DSA-02", "Linked Lists")]:
        c = Competency(syllabus_id=syllabus.id, competency_code=code, topic_name=topic, learning_outcomes=[])
        db.add(c)
        comps[code] = c
    a = Assessment(course_id=course.id, title="Prelim", type=AssessmentType.exam,
                   grading_period=GradingPeriod.prelim, approval_status=AssessmentApprovalStatus.approved)
    db.add(a)
    db.flush()
    item = AssessmentItem(assessment_id=a.id, question_text="Insert a node at the head.",
                          mapped_competency_id=comps["DSA-01"].id, confidence_score=0.4,
                          needs_review=True)
    db.add(item)
    db.flush()
    db.add(StudentScore(student_id_hash="h1", assessment_id=a.id, item_id=item.id,
                        grading_period=GradingPeriod.prelim, score=4, max_score=10,
                        competency_id=comps["DSA-01"].id))
    db.commit()
    return {"course": course, "assessment": a, "item": item, "comps": comps}


def test_owner_can_reassign_mapping(client, db, instructor_token, mapped):
    item, target = mapped["item"], mapped["comps"]["DSA-02"]
    resp = client.put(f"/assessments/items/{item.id}/tag",
                      params={"competency_id": str(target.id)}, headers=_auth(instructor_token))
    assert resp.status_code == 200, resp.text

    db.refresh(item)
    assert item.mapped_competency_id == target.id
    assert item.needs_review is False
    score = db.query(StudentScore).one()
    assert score.competency_id == target.id


def test_owner_can_revert_mapping(client, db, instructor_token, mapped):
    item = mapped["item"]
    item.needs_review = False
    db.commit()
    resp = client.put(f"/assessments/items/{item.id}/revert", headers=_auth(instructor_token))
    assert resp.status_code == 200
    db.refresh(item)
    assert item.needs_review is True


def test_ai_suggestion_survives_override(client, db, instructor_token, mapped, monkeypatch):
    """Topic mapping records the AI's original choice; a later faculty reassignment
    changes the live mapping but not the recorded suggestion (§3.6.2 audit)."""
    from backend.routers import assessments as assessments_router

    item, comps = mapped["item"], mapped["comps"]
    item.mapped_competency_id = None
    item.confidence_score = None
    db.commit()
    monkeypatch.setattr(
        assessments_router, "map_question_to_competency",
        lambda q, c: {"competency_code": "DSA-01", "confidence_score": 0.6, "bloom_level": "Applying"},
    )
    assessments_router._run_topic_mapping(mapped["assessment"].id, db)
    db.refresh(item)
    assert item.ai_suggested_competency_id == comps["DSA-01"].id
    assert item.ai_confidence == 0.6
    assert item.ai_mapped_at is not None
    assert item.needs_review is True  # 0.6 < 0.75

    client.put(f"/assessments/items/{item.id}/tag",
               params={"competency_id": str(comps["DSA-02"].id)}, headers=_auth(instructor_token))
    db.refresh(item)
    assert item.mapped_competency_id == comps["DSA-02"].id
    assert item.ai_suggested_competency_id == comps["DSA-01"].id


def test_override_is_audit_logged(client, db, instructor_token, mapped):
    from backend.models.audit import AuditLog

    item, comps = mapped["item"], mapped["comps"]
    item.ai_suggested_competency_id = comps["DSA-01"].id
    item.ai_confidence = 0.4
    db.commit()

    resp = client.put(f"/assessments/items/{item.id}/tag",
                      params={"competency_id": str(comps["DSA-02"].id), "reason": "tests linked lists"},
                      headers=_auth(instructor_token))
    assert resp.json()["override_action"] == "reassigned"

    log = db.query(AuditLog).filter(AuditLog.action == "mapping_override").one()
    assert log.target_id == str(item.id)
    assert log.extra_data["ai_suggested_competency_id"] == str(comps["DSA-01"].id)
    assert log.extra_data["new_competency_id"] == str(comps["DSA-02"].id)
    assert log.extra_data["reason"] == "tests linked lists"

    # Accepting the AI's pick is recorded as "accepted"
    resp = client.put(f"/assessments/items/{item.id}/tag",
                      params={"competency_id": str(comps["DSA-01"].id)}, headers=_auth(instructor_token))
    assert resp.json()["override_action"] == "accepted"


def test_mapping_accuracy_report(client, db, instructor_token, mapped, other_instructor_token):
    """2 reviewed AI items, 1 matched -> 50%; an auto-accepted unreviewed item is
    reported separately and not counted toward accuracy."""
    from datetime import datetime, timezone

    comps, a = mapped["comps"], mapped["assessment"]
    item = mapped["item"]
    item.ai_suggested_competency_id = comps["DSA-01"].id
    item.ai_mapped_at = datetime.now(timezone.utc)
    second = AssessmentItem(assessment_id=a.id, question_text="Big-O of lookup?",
                            mapped_competency_id=comps["DSA-01"].id, ai_suggested_competency_id=comps["DSA-01"].id,
                            ai_mapped_at=datetime.now(timezone.utc), confidence_score=0.5, needs_review=True)
    auto = AssessmentItem(assessment_id=a.id, question_text="Define a stack.",
                          mapped_competency_id=comps["DSA-02"].id, ai_suggested_competency_id=comps["DSA-02"].id,
                          ai_mapped_at=datetime.now(timezone.utc), confidence_score=0.9, needs_review=False)
    db.add_all([second, auto])
    db.commit()

    h = _auth(instructor_token)
    client.put(f"/assessments/items/{item.id}/tag", params={"competency_id": str(comps["DSA-02"].id)}, headers=h)
    client.put(f"/assessments/items/{second.id}/tag", params={"competency_id": str(comps["DSA-01"].id)}, headers=h)

    report = client.get(f"/assessments/course/{mapped['course'].id}/mapping-accuracy", headers=h).json()
    assert report["reviewed_items"] == 2
    assert report["matched_items"] == 1
    assert report["accuracy_pct"] == 50.0
    assert report["meets_target"] is False
    assert report["auto_accepted_unreviewed"] == 1
    assert report["by_action"] == {"accepted": 1, "reassigned": 1, "custom": 0}

    resp = client.get(f"/assessments/course/{mapped['course'].id}/mapping-accuracy",
                      headers=_auth(other_instructor_token))
    assert resp.status_code == 403


def test_faculty_can_create_custom_tag_and_use_it(client, db, instructor_token, mapped, other_instructor_token):
    h = _auth(instructor_token)
    course_id = mapped["course"].id
    resp = client.post(f"/syllabi/courses/{course_id}/competencies",
                       json={"topic_name": "Recursion basics"}, headers=h)
    assert resp.status_code == 201, resp.text
    tag = resp.json()
    assert tag["competency_code"] == "FAC-01" and tag["source"] == "faculty"

    dup = client.post(f"/syllabi/courses/{course_id}/competencies",
                      json={"topic_name": "Other", "competency_code": "dsa-01"}, headers=h)
    assert dup.status_code == 409

    foreign = client.post(f"/syllabi/courses/{course_id}/competencies",
                          json={"topic_name": "Sneaky tag"}, headers=_auth(other_instructor_token))
    assert foreign.status_code == 403

    item = mapped["item"]
    resp = client.put(f"/assessments/items/{item.id}/tag",
                      params={"competency_id": tag["id"]}, headers=h)
    assert resp.status_code == 200
    assert resp.json()["override_action"] == "custom"


def test_mapping_batch_runs_concurrently_and_is_timed(db, mapped, monkeypatch):
    """LLM calls for a CSV run in parallel (§3.8.1: < 5 s per mapping batch) and the
    batch duration is recorded for the ingestion stats."""
    import threading
    import time as _time
    from backend.models.audit import AuditLog
    from backend.routers import assessments as assessments_router

    a = mapped["assessment"]
    mapped["item"].mapped_competency_id = None
    for i in range(7):
        db.add(AssessmentItem(assessment_id=a.id, question_text=f"Extra question {i}?", needs_review=True))
    db.commit()

    active, peak, lock = [0], [0], threading.Lock()

    def slow_llm(question, comps):
        with lock:
            active[0] += 1
            peak[0] = max(peak[0], active[0])
        _time.sleep(0.2)
        with lock:
            active[0] -= 1
        return {"competency_code": "DSA-01", "confidence_score": 0.9, "bloom_level": "Applying"}
    monkeypatch.setattr(assessments_router, "map_question_to_competency", slow_llm)

    started = _time.perf_counter()
    assessments_router._map_unmapped_items(a.id, db)
    elapsed = _time.perf_counter() - started

    assert peak[0] > 1               # calls overlapped
    assert elapsed < 8 * 0.2         # faster than 8 sequential calls
    log = db.query(AuditLog).filter(AuditLog.action == "ingestion").one()
    assert log.extra_data["kind"] == "topic_mapping_batch"
    assert log.extra_data["items"] == 8 and log.extra_data["parse_ok"] is True
