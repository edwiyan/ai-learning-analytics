"""
Advisory syllabus alignment check (capstone §3.11.2 Phase 1).
"""
import pytest

from backend.models.course import Course
from backend.models.curriculum import Curriculum
from backend.models.curriculum_subject import CurriculumSubject
from backend.models.program import Program
from backend.models.syllabus import Competency, Syllabus, SyllabusStatus
from backend.services.ai import syllabus_alignment as sa_mod
from backend.services.ai.prompts import build_syllabus_alignment_prompt


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def syllabus(db, instructor_user):
    program = Program(program_name="BSIT", degree_type="BS", total_units=150,
                      program_outcomes=["Apply computing knowledge", "Design computing solutions"])
    db.add(program)
    db.flush()
    cur = Curriculum(program_id=program.id, name="BSIT 2024", effective_year=2024, total_units=150)
    db.add(cur)
    db.flush()
    subj = CurriculumSubject(curriculum_id=cur.id, subject_code="ITC 212", title="DSA", units=3,
                             year_level=2, semester=1)
    db.add(subj)
    db.flush()
    course = Course(title="DSA", code="ITC 212", academic_period="AY 2025-2026 S1",
                    instructor_id=instructor_user.id, curriculum_subject_id=subj.id)
    db.add(course)
    db.flush()
    syl = Syllabus(course_id=course.id, file_path="x", status=SyllabusStatus.pending)
    db.add(syl)
    db.flush()
    db.add_all([
        Competency(syllabus_id=syl.id, competency_code="CLO1", topic_name="Analysis",
                   learning_outcomes=["Analyze the running time of algorithms"]),
        Competency(syllabus_id=syl.id, competency_code="CLO2", topic_name="Lists",
                   learning_outcomes=["Understand linked lists"]),
    ])
    db.commit()
    return syl


def test_vague_outcome_verbs_are_flagged(client, instructor_token, syllabus, monkeypatch):
    monkeypatch.setattr(sa_mod, "llm_configured", lambda: False)
    body = client.get(f"/syllabi/{syllabus.id}/alignment-check", headers=_auth(instructor_token)).json()
    rows = {r["competency_code"]: r for r in body["measurability"]}
    assert rows["CLO1"]["measurable"] is True
    assert rows["CLO2"]["measurable"] is False
    assert "understand" in rows["CLO2"]["issues"][0]
    assert body["program_name"] == "BSIT"
    assert "not checked" in body["alignment_status"]


def test_program_alignment_uses_llm_and_drops_hallucinations(client, instructor_token, syllabus, monkeypatch):
    monkeypatch.setattr(sa_mod, "llm_configured", lambda: True)
    monkeypatch.setattr(sa_mod, "complete_json", lambda prompt, **kw: {"clo_alignment": [
        {"competency_code": "CLO1", "program_outcomes": ["PO1", "PO9"], "note": "applies analysis"},
        {"competency_code": "CLO2", "program_outcomes": [], "note": "no direct support"},
        {"competency_code": "CLO99", "program_outcomes": ["PO2"], "note": "made up"},
    ]})
    body = client.get(f"/syllabi/{syllabus.id}/alignment-check", headers=_auth(instructor_token)).json()
    pa = body["program_alignment"]
    assert body["alignment_status"] == "checked"
    assert [m["competency_code"] for m in pa["clo_alignment"]] == ["CLO1", "CLO2"]
    assert pa["clo_alignment"][0]["program_outcomes"] == ["PO1"]  # PO9 is not a real PO
    assert pa["unaligned_clos"] == ["CLO2"]
    assert pa["uncovered_program_outcomes"] == ["PO2"]


def test_alignment_prompt_formats():
    prompt = build_syllabus_alignment_prompt(
        [{"competency_code": "CLO1", "topic_name": "Analysis", "learning_outcomes": ["Analyze"]}],
        [("PO1", "Apply computing knowledge")],
    )
    assert "- PO1: Apply computing knowledge" in prompt and "CLO1" in prompt


def test_other_instructor_cannot_view(client, other_instructor_token, syllabus):
    resp = client.get(f"/syllabi/{syllabus.id}/alignment-check", headers=_auth(other_instructor_token))
    assert resp.status_code == 403
