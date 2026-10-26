"""
Early-warning timeliness (panel comment 3): first flag period, school days to the
intervention, overdue follow-ups and their one-time reminder.
"""
from datetime import date, datetime, timezone

import pytest

from backend.models.course import Course
from backend.models.instructor_intervention import InstructorIntervention
from backend.models.notification import Notification
from backend.models.prediction import RiskLevel, RiskPrediction
from backend.services.early_warning import remind_overdue, school_days_between, timeliness


def _snap(db, course, sid, level, period, when):
    db.add(RiskPrediction(student_id_hash=sid, course_id=course.id, grading_period=period, risk_level=level,
                          predicted_at=when, weak_competencies=[]))


@pytest.fixture
def course(db, instructor_user):
    c = Course(title="DSA", code="ITC 212", academic_period="S1", instructor_id=instructor_user.id)
    db.add(c)
    db.commit()
    return c


def test_school_days_skip_weekends():
    assert school_days_between(date(2026, 10, 23), date(2026, 10, 26)) == 1   # Fri -> Mon
    assert school_days_between(date(2026, 10, 26), date(2026, 10, 26)) == 0
    assert school_days_between(date(2026, 10, 26), date(2026, 11, 2)) == 5


def test_timeliness_rows_and_summary(db, course, instructor_user):
    d = lambda day: datetime(2026, 10, day, 8, tzinfo=timezone.utc)
    # early flag (prelim) with an intervention 2 school days later
    _snap(db, course, "a", RiskLevel.at_risk, "prelim", d(19))
    db.add(InstructorIntervention(instructor_id=instructor_user.id, course_id=course.id, student_id_hash="a",
                                  created_at=datetime(2026, 10, 21, 9)))
    # late flag (midterm), still At-Risk, no intervention
    _snap(db, course, "b", RiskLevel.on_track, "prelim", d(5))
    _snap(db, course, "b", RiskLevel.at_risk, "midterm", d(12))
    # never At-Risk
    _snap(db, course, "c", RiskLevel.excelling, "prelim", d(5))
    db.commit()

    data = timeliness([course.id], db, today=date(2026, 10, 27))
    rows = {r["student_id_hash"]: r for r in data["rows"]}
    assert set(rows) == {"a", "b"}
    assert rows["a"]["early"] and rows["a"]["school_days_to_intervention"] == 2 and rows["a"]["within_target"]
    assert not rows["b"]["early"] and rows["b"]["overdue"] and rows["b"]["school_days_waiting"] == 11
    s = data["summary"]
    assert (s["flagged"], s["flagged_early"], s["within_target"], s["overdue"]) == (2, 1, 1, 1)
    assert s["median_school_days_to_intervention"] == 2 and s["early_period"] == "Prelim"


def test_overdue_reminder_sent_once(db, course, instructor_user):
    _snap(db, course, "b", RiskLevel.at_risk, "prelim", datetime(2026, 1, 5, tzinfo=timezone.utc))
    db.commit()
    assert remind_overdue([course.id], db) == 1
    assert remind_overdue([course.id], db) == 0
    note = db.query(Notification).filter(Notification.type == "intervention_overdue").one()
    assert str(note.user_id) == str(instructor_user.id) and "ITC 212" in note.title


def test_endpoint_and_at_risk_list(client, db, course, instructor_token):
    _snap(db, course, "zz", RiskLevel.at_risk, "prelim", datetime(2026, 1, 5, tzinfo=timezone.utc))
    db.commit()
    body = client.get("/analytics/early-warning", headers={"Authorization": f"Bearer {instructor_token}"}).json()
    assert body["summary"]["flagged"] == 1 and body["rows"][0]["course_code"] == "ITC 212"
    assert body["rows"][0]["overdue"] is True
