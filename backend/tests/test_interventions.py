"""
Interventions log AI feedback and track status (capstone §3.4).
"""
from backend.models.course import Course
from backend.models.instructor_intervention import InstructorIntervention


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _course(db, owner):
    c = Course(title="Data Structures", code="ITC 212", academic_period="AY 2025-2026 S1", instructor_id=owner.id)
    db.add(c)
    db.commit()
    return c


def test_intervention_status_lifecycle(client, db, instructor_token, instructor_user, monkeypatch):
    from backend.routers import analytics
    monkeypatch.setattr(analytics, "_intervention_ai_feedback", lambda *a: "Keep going — review recursion.")
    course = _course(db, instructor_user)

    created = client.post(f"/analytics/courses/{course.id}/interventions",
                          json={"student_id_hash": "abc", "note": "Talked after class"},
                          headers=_auth(instructor_token)).json()
    assert created["status"] == "open"
    assert created["ai_feedback"] == "Keep going — review recursion."

    resp = client.put(f"/analytics/interventions/{created['id']}/status",
                      json={"status": "resolved"}, headers=_auth(instructor_token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved"
    assert resp.json()["status_updated_at"] is not None

    bad = client.put(f"/analytics/interventions/{created['id']}/status",
                     json={"status": "done"}, headers=_auth(instructor_token))
    assert bad.status_code == 422


def test_other_instructor_cannot_change_status(client, db, instructor_user, other_instructor_token):
    course = _course(db, instructor_user)
    iv = InstructorIntervention(instructor_id=instructor_user.id, course_id=course.id, student_id_hash="abc")
    db.add(iv)
    db.commit()
    resp = client.put(f"/analytics/interventions/{iv.id}/status",
                      json={"status": "resolved"}, headers=_auth(other_instructor_token))
    assert resp.status_code == 403
