"""
Institution settings (panel comments 1 and 2): thresholds are configurable, audited,
change the risk classification, and the AI-mapping auto-accept switch is off by default.
"""
import pytest

from backend.core.limiter import limiter
from backend.models.assessment import (
    Assessment, AssessmentApprovalStatus, AssessmentItem, AssessmentType, GradingPeriod,
)
from backend.models.audit import AuditLog
from backend.models.course import Course
from backend.models.score import StudentScore
from backend.models.syllabus import Competency, Syllabus, SyllabusStatus
from backend.routers import institution_settings as settings_router
from backend.services.ai.risk_predictor import predict_risk
from backend.services.institution_settings import DEFAULTS, get_settings
from backend.tests.conftest import _TestingSessionLocal


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _background_uses_test_db(monkeypatch):
    monkeypatch.setattr(settings_router, "_session_factory", _TestingSessionLocal)


@pytest.fixture
def course(db, instructor_user):
    """One student with two competencies at 72% (gaps at 75%, not at 70%)."""
    c = Course(title="DSA", code="ITC 212", academic_period="S1", instructor_id=instructor_user.id)
    db.add(c)
    db.flush()
    syl = Syllabus(course_id=c.id, file_path="x", status=SyllabusStatus.validated)
    db.add(syl)
    db.flush()
    a = Assessment(course_id=c.id, title="Prelim", type=AssessmentType.exam, grading_period=GradingPeriod.prelim,
                   approval_status=AssessmentApprovalStatus.approved)
    db.add(a)
    db.flush()
    for i in range(2):
        comp = Competency(syllabus_id=syl.id, competency_code=f"C{i}", topic_name=f"T{i}", learning_outcomes=[])
        db.add(comp)
        db.flush()
        item = AssessmentItem(assessment_id=a.id, question_text=f"Q{i}", mapped_competency_id=comp.id,
                              confidence_score=1.0)
        db.add(item)
        db.flush()
        db.add(StudentScore(student_id_hash="s1", assessment_id=a.id, item_id=item.id, competency_id=comp.id,
                            grading_period=GradingPeriod.prelim, score=72, max_score=100))
    db.commit()
    return {"course": c, "assessment": a}


def test_defaults_and_read_access(client, db, student_token):
    body = client.get("/institution-settings/", headers=_auth(student_token)).json()
    assert body["values"]["mastery_threshold"] == 75.0
    assert body["values"]["mapping_auto_accept"] is False
    assert body["updated_at"] is None
    assert get_settings(db) == DEFAULTS


def test_only_admin_can_change(client, instructor_token):
    r = client.put("/institution-settings/", headers=_auth(instructor_token), json={"at_risk_min_gaps": 2})
    assert r.status_code == 403


def test_validation_rejects_bad_values(client, admin_token):
    for body in ({"mastery_threshold": 120}, {"unknown": 1}, {"early_warning_period": "week3"},
                 {"proficient_threshold": 60}):
        assert client.put("/institution-settings/", headers=_auth(admin_token), json=body).status_code == 422


def test_change_is_audited_and_changes_classification(client, db, admin_token, course):
    cid = str(course["course"].id)
    assert predict_risk("s1", cid, db)["risk_level"].value == "On-Track"  # 2 gaps < 3

    r = client.put("/institution-settings/", headers=_auth(admin_token), json={"at_risk_min_gaps": 2})
    assert r.status_code == 200 and r.json()["changed"] == ["at_risk_min_gaps"] and r.json()["recomputing"]
    result = predict_risk("s1", cid, db)
    assert result["risk_level"].value == "At-Risk" and result["reason"] == "2 competencies below 75%"

    log = db.query(AuditLog).filter(AuditLog.action == "update_institution_settings").one()
    assert log.extra_data == {"at_risk_min_gaps": {"old": 3, "new": 2}}

    # Lower the mastery threshold: 72% is no longer a gap
    client.put("/institution-settings/", headers=_auth(admin_token), json={"mastery_threshold": 70})
    assert predict_risk("s1", cid, db)["risk_level"].value == "On-Track"
    body = client.get("/institution-settings/", headers=_auth(admin_token)).json()
    assert body["updated_by"] == "Test Admin" and body["updated_at"]


def test_sensitivity_table(client, admin_token, course):
    body = client.get("/institution-settings/sensitivity", headers=_auth(admin_token)).json()
    assert body["enrolments"] == 1
    by_key = {(r["mastery_threshold"], r["min_gaps"]): r["flagged"] for r in body["rows"]}
    assert by_key[(75.0, 2)]["15.0"] == 1   # two gaps at 75%
    assert by_key[(75.0, 3)]["15.0"] == 0
    assert by_key[(70.0, 2)]["15.0"] == 0   # 72% is not a gap at 70%


def test_auto_accept_off_keeps_every_ai_mapping_pending(client, db, instructor_token, admin_token, course, monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)
    calls = {"n": 0}

    def fake_map(question_text, competencies):
        calls["n"] += 1
        confidence = 0.95 if "stack" in question_text else 0.40
        return {"competency_code": "C0", "confidence_score": confidence, "bloom_level": None}
    monkeypatch.setattr("backend.routers.assessments.map_question_to_competency", fake_map)

    a = course["assessment"]
    body = ("student_id,question_text,score,max_score\n"
            "2024-0001,Define a stack.,4,5\n2024-0001,Explain hashing.,3,5\n")
    r = client.post(f"/assessments/{a.id}/upload", headers=_auth(instructor_token),
                    files={"file": ("s.csv", body.encode(), "text/csv")})
    assert r.status_code == 200, r.text
    new_items = db.query(AssessmentItem).filter(AssessmentItem.question_text.in_(["Define a stack.", "Explain hashing."])).all()
    assert len(new_items) == 2 and all(i.needs_review for i in new_items)   # both pending confirmation

    # Bulk-confirm confirms only the confident one, records who confirmed it
    r = client.put(f"/assessments/{a.id}/confirm-confident", headers=_auth(instructor_token))
    assert r.json()["confirmed"] == 1
    db.expire_all()
    confident = next(i for i in new_items if i.question_text == "Define a stack.")
    weak = next(i for i in new_items if i.question_text == "Explain hashing.")
    assert not confident.needs_review and confident.validated_by is not None
    assert weak.needs_review and weak.validated_by is None


def test_auto_accept_on_restores_threshold_behaviour(client, db, instructor_token, admin_token, course, monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)
    monkeypatch.setattr("backend.routers.assessments.map_question_to_competency",
                        lambda q, c: {"competency_code": "C1", "confidence_score": 0.9, "bloom_level": None})
    client.put("/institution-settings/", headers=_auth(admin_token), json={"mapping_auto_accept": True})
    a = course["assessment"]
    client.post(f"/assessments/{a.id}/upload", headers=_auth(instructor_token),
                files={"file": ("s.csv", b"student_id,question_text,score,max_score\n2024-0001,Define a queue.,4,5\n",
                                "text/csv")})
    item = db.query(AssessmentItem).filter(AssessmentItem.question_text == "Define a queue.").one()
    assert item.needs_review is False


def test_report_methodology_uses_settings(client, db, admin_token, course):
    from backend.services.reports.data import ReportFilters, build_report
    from backend.models.user import User, UserRole
    client.put("/institution-settings/", headers=_auth(admin_token), json={"at_risk_min_gaps": 2})
    admin = db.query(User).filter(User.role == UserRole.admin).one()
    data = build_report(db, admin, ReportFilters())
    assert data["thresholds"].at_risk_min_gaps == 2 and data["thresholds_updated_at"] is not None
    pdf = client.get("/reports/academic-performance/export", params={"format": "pdf"}, headers=_auth(admin_token))
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
