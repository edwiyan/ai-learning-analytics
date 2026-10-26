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
