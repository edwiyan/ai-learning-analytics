"""
Risk snapshots and At-Risk alerts (capstone §3.8.2: an At-Risk flag triggers a
faculty alert and a student notification).
"""
import pytest

from backend.models.assessment import (
    Assessment, AssessmentItem, AssessmentApprovalStatus, AssessmentType, GradingPeriod,
)
from backend.models.course import Course
from backend.models.prediction import RiskLevel, RiskPrediction
from backend.models.score import StudentScore
from backend.models.syllabus import Competency, Syllabus, SyllabusStatus
from backend.services.ai.risk_snapshot import refresh_course_risk


@pytest.fixture
def course_setup(db, instructor_user):
    course = Course(title="Data Structures", code="ITC 212", academic_period="AY 2025-2026 S1",
                    instructor_id=instructor_user.id)
    db.add(course)
    db.flush()
    syllabus = Syllabus(course_id=course.id, file_path="x.docx", status=SyllabusStatus.validated)
    db.add(syllabus)
    db.flush()
    comps = []
    for i in range(3):
        c = Competency(syllabus_id=syllabus.id, competency_code=f"DSA-0{i+1}", topic_name=f"Topic {i+1}",
                       learning_outcomes=[])
        db.add(c)
        comps.append(c)
    a = Assessment(course_id=course.id, title="Prelim", type=AssessmentType.exam,
                   grading_period=GradingPeriod.prelim, approval_status=AssessmentApprovalStatus.approved)
    db.add(a)
    db.flush()
    items = []
    for c in comps:
        item = AssessmentItem(assessment_id=a.id, question_text=f"Q on {c.topic_name}",
                              mapped_competency_id=c.id, confidence_score=1.0)
        db.add(item)
        items.append(item)
    db.commit()
    return {"course": course, "assessment": a, "items": items}


def add_scores(db, setup, student_hash, pct):
    for item in setup["items"]:
        db.add(StudentScore(student_id_hash=student_hash, assessment_id=setup["assessment"].id,
                            item_id=item.id, competency_id=item.mapped_competency_id,
                            grading_period=GradingPeriod.prelim, score=pct, max_score=100))
    db.commit()


def test_snapshot_records_only_changes(db, course_setup):
    add_scores(db, course_setup, "weak", 50)  # 3 gaps -> At-Risk
    add_scores(db, course_setup, "strong", 95)

    first = refresh_course_risk(course_setup["course"].id, db)
    levels = {t.student_id_hash: t.current for t in first}
    assert levels == {"weak": RiskLevel.at_risk, "strong": RiskLevel.excelling}
    assert [t.student_id_hash for t in first if t.became_at_risk] == ["weak"]
    assert db.query(RiskPrediction).count() == 2

    # Nothing changed -> no new snapshot, no transitions
    assert refresh_course_risk(course_setup["course"].id, db) == []
    assert db.query(RiskPrediction).count() == 2
