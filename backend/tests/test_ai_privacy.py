"""
Data minimization for the external AI provider (panel comments 6 and 7): no student
identifiers or scores in any prompt, contact details stripped from syllabus text,
OpenAI asked not to store requests, Gemini off unless explicitly enabled.
"""
import pytest

from backend.core.limiter import limiter
from backend.models.assessment import Assessment, AssessmentApprovalStatus, AssessmentType, GradingPeriod
from backend.models.course import Course
from backend.models.syllabus import Competency, Syllabus, SyllabusStatus
from backend.models.user import User, UserRole
from backend.services.ai import llm_client
from backend.services.ai.prompts import build_syllabus_prompt, redact_contact
from backend.tests.conftest import _TestingSessionLocal


@pytest.fixture(autouse=True)
def _fresh_identifier_cache(monkeypatch):
    monkeypatch.setattr(llm_client, "_identifiers_cache", {"at": 0.0, "numbers": set(), "names": set()})
    monkeypatch.setattr(llm_client, "_session_factory", _TestingSessionLocal)
    monkeypatch.setattr(llm_client, "_cache_get", lambda key: None)
    monkeypatch.setattr(llm_client, "_cache_put", lambda *a, **k: None)
    monkeypatch.setattr(llm_client, "RETRY_DELAYS", ())


@pytest.fixture
def students(db):
    for number, name in [("2024-0001", "Ana Reyes"), ("2024-0002", "Ben Cruz")]:
        db.add(User(email=f"{number}@s.test", password_hash="x", full_name=name, role=UserRole.student,
                    student_number=number, is_active=True))
    db.commit()


@pytest.fixture
def capture(monkeypatch):
    """Pretend OpenAI is configured and record every prompt it receives."""
    sent = []
    monkeypatch.setattr(llm_client, "_providers", lambda: [("openai", "gpt-4o-mini")])

    def fake_json(prompt, temperature):
        sent.append(prompt)
        return {"competency_code": "DSA-01", "confidence_score": 0.9, "bloom_level": None}
    monkeypatch.setattr(llm_client, "_openai_json", fake_json)
    return sent


def test_guard_blocks_student_number_and_name(db, students, capture):
    with pytest.raises(llm_client.PromptBlocked):
        llm_client.complete_json("Map this: student 2024-0001 answered", purpose="topic_mapping")
    with pytest.raises(llm_client.PromptBlocked):
        llm_client.complete_json("Ana   Reyes wrote this essay", purpose="topic_mapping")
    assert capture == []


def test_guard_allows_ordinary_text_and_strips_emails(db, students, capture):
    llm_client.complete_json("AY 2025-2026 syllabus; contact prof@btech.edu.ph; Week 1-18",
                             purpose="syllabus_parse")
    assert capture and "prof@btech.edu.ph" not in capture[0] and "[email removed]" in capture[0]
    assert "2025-2026" in capture[0]


def test_syllabus_prompt_has_no_contact_details():
    text = "Instructor: J. Cruz, jcruz@btech.edu.ph, 0917 123 4567, (044) 791-0123\nCLO1: Analyze algorithms"
    prompt = build_syllabus_prompt(text)
    assert "jcruz@" not in prompt and "0917" not in prompt and "791-0123" not in prompt
    assert "Analyze algorithms" in prompt
    assert redact_contact("+63 917-123-4567") == "[phone removed]"


def test_csv_upload_sends_no_student_ids_names_or_scores(client, db, instructor_token, students, capture, monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)
    course = Course(title="DSA", code="ITC 212", academic_period="AY 2025-2026 S1",
                    instructor_id=db.query(User).filter(User.role == UserRole.instructor).one().id)
    db.add(course)
    db.flush()
    syl = Syllabus(course_id=course.id, file_path="x", status=SyllabusStatus.validated)
    db.add(syl)
    db.flush()
    db.add(Competency(syllabus_id=syl.id, competency_code="DSA-01", topic_name="Algorithm Analysis", learning_outcomes=[]))
    a = Assessment(course_id=course.id, title="Prelim", type=AssessmentType.exam,
                   grading_period=GradingPeriod.prelim, approval_status=AssessmentApprovalStatus.approved)
    db.add(a)
    db.commit()

    body = ("student_id,question_text,score,max_score\n"
            "2024-0001,What is the time complexity of binary search?,13.37,17.71\n"
            "2024-0002,What is the time complexity of binary search?,11.93,17.71\n")
    r = client.post(f"/assessments/{a.id}/upload", headers={"Authorization": f"Bearer {instructor_token}"},
                    files={"file": ("scores.csv", body.encode(), "text/csv")})
    assert r.status_code == 200, r.text
    assert capture, "the question should have been sent for mapping"
    for prompt in capture:
        assert "binary search" in prompt
        for forbidden in ("2024-0001", "2024-0002", "Ana Reyes", "Ben Cruz", "13.37", "11.93", "17.71"):
            assert forbidden not in prompt


def test_openai_requests_are_not_stored(monkeypatch):
    calls = []

    class FakeCompletions:
        def create(self, **kwargs):
            calls.append(kwargs)

            class R:
                choices = [type("C", (), {"message": type("M", (), {"content": '{"ok": 1}'})()})()]
            return R()

    fake = type("Client", (), {"chat": type("Chat", (), {"completions": FakeCompletions()})()})()
    monkeypatch.setattr(llm_client, "_client", lambda: fake)
    llm_client._openai_json("x", 0.0)
    llm_client._openai_text("x", 0.0, 10)
    assert all(c["store"] is False for c in calls) and len(calls) == 2


def test_gemini_needs_explicit_enable(monkeypatch):
    monkeypatch.setattr(llm_client.settings, "gemini_api_key", "key")
    monkeypatch.setattr(llm_client.settings, "gemini_enabled", False)
    assert llm_client.gemini_configured() is False
    monkeypatch.setattr(llm_client.settings, "gemini_enabled", True)
    assert llm_client.gemini_configured() is True
    assert llm_client.llm_status()["data_handling"]["gemini_fallback_enabled"] is True
