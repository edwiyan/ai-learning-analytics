"""
Instructor curation of review resources: AI suggestions accepted / declined per
competency, custom resources (links and uploaded files), and their effect on the
student's recommendations.
"""
import pytest

from backend.models.course import Course
from backend.models.resource import CourseResource, Resource, ResourceType
from backend.models.syllabus import Competency, Syllabus, SyllabusStatus
from backend.services.ai import resource_suggester as rs_mod
from backend.services.ai.recommender import get_recommendations


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def course(db, instructor_user):
    c = Course(title="DSA", code="ITC 212", academic_period="AY 2025-2026 S1", instructor_id=instructor_user.id)
    db.add(c)
    db.flush()
    syl = Syllabus(course_id=c.id, file_path="x", status=SyllabusStatus.validated)
    db.add(syl)
    db.flush()
    db.add_all([
        Competency(syllabus_id=syl.id, competency_code="DSA-02", topic_name="Linked Lists",
                   learning_outcomes=["Implement singly and doubly linked lists"]),
        Competency(syllabus_id=syl.id, competency_code="DSA-05", topic_name="Sorting Algorithms",
                   learning_outcomes=["Compare merge sort and quick sort"]),
    ])
    db.add_all([
        Resource(title="Linked List Visualised", type=ResourceType.video, url="https://e.com/ll",
                 competency_tags=["linked lists", "pointers"]),
        Resource(title="Sorting Algorithms Explained", type=ResourceType.reading, url="https://e.com/sort",
                 competency_tags=["sorting", "merge sort", "quick sort"]),
        Resource(title="Intro to Accounting", type=ResourceType.reading, url="https://e.com/acct",
                 competency_tags=["journal entries"]),
    ])
    db.commit()
    return c


@pytest.fixture(autouse=True)
def _no_llm(monkeypatch):
    monkeypatch.setattr(rs_mod, "llm_configured", lambda: False)


def _suggest(client, token, course):
    r = client.post(f"/courses/{course.id}/resources/suggest", headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def _comp(db, code):
    return db.query(Competency).filter(Competency.competency_code == code).one()


def test_suggestions_match_competencies_by_keywords(client, instructor_token, course):
    body = _suggest(client, instructor_token, course)
    by_comp = {}
    for item in body["items"]:
        by_comp.setdefault(item["competency_id"], []).append(item["resource"]["title"])
    titles = sorted(t for ts in by_comp.values() for t in ts)
    assert "Linked List Visualised" in titles and "Sorting Algorithms Explained" in titles
    assert "Intro to Accounting" not in titles
    assert all(i["status"] == "suggested" and i["source"] == "ai" for i in body["items"])
    assert body["items"][0]["reason"].startswith("Matches this competency on")


def test_llm_rerank_ignores_invented_ids(client, db, instructor_token, course, monkeypatch):
    monkeypatch.setattr(rs_mod, "llm_configured", lambda: True)
    real = {r.title: str(r.id) for r in db.query(Resource).all()}

    def fake_llm(prompt, purpose):
        return {"ratings": [
            {"resource_id": real["Linked List Visualised"], "relevance": 0.9, "reason": "Covers list operations."},
            {"resource_id": real["Sorting Algorithms Explained"], "relevance": 0.95, "reason": "Explains both sorts."},
            {"resource_id": "made-up-id", "relevance": 1.0, "reason": "Hallucinated"},
        ]}
    monkeypatch.setattr(rs_mod, "complete_json", fake_llm)
    body = _suggest(client, instructor_token, course)
    assert body["summary"]["ai_reranked"] is True
    assert {i["reason"] for i in body["items"]} <= {"Covers list operations.", "Explains both sorts."}


def test_decisions_survive_regeneration(client, db, instructor_token, course):
    body = _suggest(client, instructor_token, course)
    link = body["items"][0]
    r = client.put(f"/courses/{course.id}/resources/{link['link_id']}", headers=_auth(instructor_token),
                   json={"status": "declined"})
    assert r.status_code == 200
    again = _suggest(client, instructor_token, course)
    assert {i["link_id"]: i["status"] for i in again["items"]}[link["link_id"]] == "declined"
    assert again["summary"]["new_suggestions"] == 0


def test_other_instructor_cannot_curate(client, other_instructor_token, course):
    assert client.get(f"/courses/{course.id}/resources", headers=_auth(other_instructor_token)).status_code == 403
    assert client.post(f"/courses/{course.id}/resources/suggest",
                       headers=_auth(other_instructor_token)).status_code == 403


def test_declined_resource_is_not_recommended_and_accepted_ranks_first(client, db, instructor_token, course):
    body = _suggest(client, instructor_token, course)
    ll_comp, sort_comp = _comp(db, "DSA-02"), _comp(db, "DSA-05")
    links = {i["resource"]["title"]: i["link_id"] for i in body["items"]}
    client.put(f"/courses/{course.id}/resources/{links['Linked List Visualised']}",
               headers=_auth(instructor_token), json={"status": "declined"})
    client.put(f"/courses/{course.id}/resources/{links['Sorting Algorithms Explained']}",
               headers=_auth(instructor_token), json={"status": "accepted"})

    recs = get_recommendations([str(ll_comp.id), str(sort_comp.id)], str(course.id), db)
    titles = [r["title"] for r in recs]
    assert "Linked List Visualised" not in titles
    assert titles[0] == "Sorting Algorithms Explained" and recs[0]["instructor_endorsed"] is True


def test_custom_link_and_file_resources(client, db, instructor_token, other_instructor_token, course):
    comp = _comp(db, "DSA-02")
    r = client.post(f"/courses/{course.id}/resources", headers=_auth(instructor_token),
                    data={"title": "My linked list notes", "type": "lesson", "competency_ids": str(comp.id)},
                    files={"file": ("notes.pdf", b"%PDF-1.4 test", "application/pdf")})
    assert r.status_code == 201, r.text
    item = next(i for i in r.json()["items"] if i["resource"]["title"] == "My linked list notes")
    assert item["status"] == "accepted" and item["source"] == "instructor"
    assert item["resource"]["has_file"] and item["resource"]["file_name"] == "notes.pdf"

    rid = item["resource"]["id"]
    dl = client.get(f"/courses/{course.id}/resources/{rid}/file", headers=_auth(instructor_token))
    assert dl.status_code == 200 and dl.content == b"%PDF-1.4 test"
    assert client.get(f"/courses/{course.id}/resources/{rid}/file",
                      headers=_auth(other_instructor_token)).status_code == 403

    # It reaches students weak in that competency, flagged as from their instructor
    recs = get_recommendations([str(comp.id)], str(course.id), db)
    assert recs[0]["title"] == "My linked list notes" and recs[0]["has_file"]

    # Course resources stay out of the shared library
    lib = client.get("/analytics/resources", headers=_auth(instructor_token)).json()
    assert "My linked list notes" not in [x["title"] for x in lib]

    # Removing it deletes the resource and its file
    path = db.query(Resource).filter(Resource.title == "My linked list notes").one().file_path
    assert client.delete(f"/courses/{course.id}/resources/{item['link_id']}",
                         headers=_auth(instructor_token)).status_code == 204
    import os
    assert not os.path.exists(path)
    assert db.query(CourseResource).filter(CourseResource.source == "instructor").count() == 0


def test_custom_resource_validation(client, instructor_token, course):
    no_target = client.post(f"/courses/{course.id}/resources", headers=_auth(instructor_token),
                            data={"title": "Nothing attached"})
    assert no_target.status_code == 422
    bad_ext = client.post(f"/courses/{course.id}/resources", headers=_auth(instructor_token),
                          data={"title": "Script"}, files={"file": ("run.exe", b"MZ", "application/octet-stream")})
    assert bad_ext.status_code == 400
    bad_url = client.post(f"/courses/{course.id}/resources", headers=_auth(instructor_token),
                          data={"title": "Bad link", "url": "javascript:alert(1)"})
    assert bad_url.status_code == 422
