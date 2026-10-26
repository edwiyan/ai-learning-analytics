"""
Student feedback on recommendations (capstone §2.3 Feedback Loop).
"""
import pytest

from backend.models.consent import PrivacyConsent
from backend.models.recommendation_feedback import RecommendationFeedback
from backend.models.resource import Resource, ResourceType


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def consenting_student(db, student_user):
    student_user.student_number = "2024-0001"
    db.add(PrivacyConsent(user_id=student_user.id, student_id_hash="x", accepted=True))
    db.commit()
    return student_user


@pytest.fixture
def resource(db):
    r = Resource(title="Big-O video", type=ResourceType.video, url="https://example.com/v",
                 competency_tags=["DSA-01"])
    db.add(r)
    db.commit()
    return r


def test_student_rates_and_rerates_resource(client, db, student_token, consenting_student, resource):
    url = f"/analytics/me/recommendations/{resource.id}/feedback"
    assert client.post(url, json={"helpful": True}, headers=_auth(student_token)).status_code == 200
    resp = client.post(url, json={"helpful": False, "comment": "too advanced"}, headers=_auth(student_token))
    assert resp.status_code == 200

    rows = db.query(RecommendationFeedback).all()
    assert len(rows) == 1
    assert rows[0].helpful is False and rows[0].comment == "too advanced"


def test_faculty_sees_helpfulness_counts(client, db, student_token, instructor_token, consenting_student, resource):
    client.post(f"/analytics/me/recommendations/{resource.id}/feedback",
                json={"helpful": True}, headers=_auth(student_token))
    db.add(RecommendationFeedback(student_id_hash="other", resource_id=resource.id, helpful=False))
    db.commit()

    listed = client.get("/analytics/resources", headers=_auth(instructor_token)).json()
    row = next(r for r in listed if r["id"] == str(resource.id))
    assert (row["helpful_count"], row["not_helpful_count"]) == (1, 1)


def test_instructor_cannot_rate(client, instructor_token, resource):
    resp = client.post(f"/analytics/me/recommendations/{resource.id}/feedback",
                       json={"helpful": True}, headers=_auth(instructor_token))
    assert resp.status_code == 403
