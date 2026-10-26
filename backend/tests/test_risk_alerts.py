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


def test_new_at_risk_student_alerts_instructor_and_student(db, course_setup, instructor_user):
    from backend.core.security import hash_student_id
    from backend.models.notification import Notification
    from backend.models.user import User, UserRole
    from backend.services.analytics_refresh import refresh_course_analytics

    student = User(email="weak@test.com", password_hash="x", full_name="Weak Student",
                   role=UserRole.student, student_number="2024-0099", is_active=True)
    db.add(student)
    db.commit()
    add_scores(db, course_setup, hash_student_id("2024-0099"), 50)

    result = refresh_course_analytics(course_setup["course"].id, db)
    assert result["alerted"] == 1

    notes = {n.type: n for n in db.query(Notification).all()}
    assert set(notes) == {"student_at_risk", "at_risk_alert"}
    assert str(notes["student_at_risk"].user_id) == str(instructor_user.id)
    assert "Weak Student" in notes["student_at_risk"].title
    assert "3 competencies below 75%" in notes["student_at_risk"].message
    assert str(notes["at_risk_alert"].user_id) == str(student.id)

    # Still At-Risk on the next refresh -> no duplicate alerts
    refresh_course_analytics(course_setup["course"].id, db)
    assert db.query(Notification).count() == 2


def test_at_risk_alert_is_emailed_when_smtp_configured(db, course_setup, instructor_user, monkeypatch):
    from backend.core.security import hash_student_id
    from backend.models.user import User, UserRole
    from backend.services import risk_alerts
    from backend.services.analytics_refresh import refresh_course_analytics

    sent = []
    monkeypatch.setattr(risk_alerts, "smtp_configured", lambda: True)
    monkeypatch.setattr(risk_alerts, "send_email", lambda to, subject, html: sent.append((to, subject, html)))

    db.add(User(email="weak@test.com", password_hash="x", full_name="Weak <Student>",
                role=UserRole.student, student_number="2024-0099", is_active=True))
    db.commit()
    add_scores(db, course_setup, hash_student_id("2024-0099"), 50)
    refresh_course_analytics(course_setup["course"].id, db)

    assert sorted(to for to, *_ in sent) == ["instructor@test.com", "weak@test.com"]
    instructor_html = next(h for to, _, h in sent if to == "instructor@test.com")
    assert "Weak &lt;Student&gt;" in instructor_html  # names are HTML-escaped


def test_no_email_without_smtp(db, course_setup, monkeypatch):
    from backend.services import risk_alerts
    from backend.services.analytics_refresh import refresh_course_analytics

    monkeypatch.setattr(risk_alerts, "smtp_configured", lambda: False)
    monkeypatch.setattr(risk_alerts, "send_email", lambda *a: pytest.fail("email sent without SMTP"))
    add_scores(db, course_setup, "weak", 50)
    assert refresh_course_analytics(course_setup["course"].id, db)["alerted"] == 1
