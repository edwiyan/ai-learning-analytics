"""
Approvers (PD, Dean, VP) get a review packet showing what they are approving:
the syllabus competencies, the drafted assessment, or the computed period grades.
"""
import uuid

import pytest

from backend.core.security import create_access_token, hash_password
from backend.models.assessment import Assessment, AssessmentApprovalStatus, AssessmentType, GradingPeriod
from backend.models.course import Course
from backend.models.exam_question import ExamQuestion
from backend.models.grade_submission import GradeSubmission, GradeSubmissionStatus
from backend.models.score import StudentScore
from backend.models.syllabus import ApprovalStage, Competency, Syllabus, SyllabusStatus
from backend.models.user import User, UserRole


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _user(db, role, email, college="ICS", **extra):
    user = User(email=email, password_hash=hash_password("Pass@12345"), full_name=email.split("@")[0],
                role=role, is_active=True, college=college, **extra)
    db.add(user)
    db.commit()
    return user


def _token(user):
    return create_access_token({"sub": str(user.id), "role": user.role, "jti": str(uuid.uuid4())})


@pytest.fixture
def course(db, instructor_user):
    c = Course(title="Data Structures", code="ITC 212", academic_period="AY 2025-2026 S1",
               instructor_id=instructor_user.id)
    db.add(c)
    db.commit()
    return c


@pytest.fixture
def syllabus(db, course):
    syl = Syllabus(course_id=course.id, file_path="missing.pdf", status=SyllabusStatus.pending,
                   approval_stage=ApprovalStage.pending_pd, parsed_json={"course_title": "Data Structures"})
    db.add(syl)
    db.flush()
    db.add(Competency(syllabus_id=syl.id, competency_code="DSA-01", topic_name="Big-O",
                      learning_outcomes=["Analyze running time"]))
    db.commit()
    return syl


def test_pd_sees_syllabus_content(client, db, syllabus):
    pd = _user(db, UserRole.program_director, "pd@test.com")
    r = client.get(f"/syllabi/{syllabus.id}/review", headers=_auth(_token(pd)))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["course"]["code"] == "ITC 212"
    assert body["course"]["instructor_name"] == "Test Instructor"
    assert body["competencies"] == [
        {"competency_code": "DSA-01", "topic_name": "Big-O", "learning_outcomes": ["Analyze running time"]}
    ]
    assert body["has_file"] is False
    assert client.get(f"/syllabi/{syllabus.id}/file", headers=_auth(_token(pd))).status_code == 404


def test_review_shows_earlier_decisions(client, db, syllabus):
    pd = _user(db, UserRole.program_director, "pd@test.com")
    assert client.post(f"/syllabi/{syllabus.id}/approve", headers=_auth(_token(pd)),
                       json={"feedback": "Looks complete"}).status_code == 200
    dean = _user(db, UserRole.dean, "dean@test.com")
    body = client.get(f"/syllabi/{syllabus.id}/review", headers=_auth(_token(dean))).json()
    assert body["approval_stage"] == "pending_dean"
    assert body["history"][0]["role"] == "program_director"
    assert body["history"][0]["approver_name"] == "pd"
    assert body["history"][0]["feedback"] == "Looks complete"


def test_other_college_cannot_review(client, db, syllabus):
    dean = _user(db, UserRole.dean, "dean-cba@test.com", college="CBA")
    assert client.get(f"/syllabi/{syllabus.id}/review", headers=_auth(_token(dean))).status_code == 403


def test_student_cannot_review(client, syllabus, student_token):
    assert client.get(f"/syllabi/{syllabus.id}/review", headers=_auth(student_token)).status_code == 403


def test_pd_sees_assessment_questions(client, db, course):
    a = Assessment(course_id=course.id, title="Prelim Exam", type=AssessmentType.exam,
                   grading_period=GradingPeriod.prelim, approval_status=AssessmentApprovalStatus.pending_pd)
    db.add(a)
    db.flush()
    db.add(ExamQuestion(assessment_id=a.id, question_text="What is O(n log n)?", question_type="multiple_choice",
                        choices=["Linear", "Linearithmic"], answer_key="Linearithmic", points=2, order_index=0))
    db.commit()
    pd = _user(db, UserRole.program_director, "pd@test.com")
    r = client.get(f"/assessments/{a.id}/review", headers=_auth(_token(pd)))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_points"] == 2
    q = body["questions"][0]
    assert q["number"] == 1 and q["answer_key"] == "Linearithmic" and q["choices"] == ["Linear", "Linearithmic"]


def test_vp_sees_computed_grades(client, db, course):
    s1 = _user(db, UserRole.student, "ana@test.com", college=None, student_number="2025-0001")
    s2 = _user(db, UserRole.student, "ben@test.com", college=None, student_number="2025-0002")
    a = Assessment(course_id=course.id, title="Prelim Exam", type=AssessmentType.exam,
                   grading_period=GradingPeriod.prelim, approval_status=AssessmentApprovalStatus.approved)
    db.add(a)
    db.flush()
    for student, score in [(s1, 45), (s2, 30)]:
        db.add(StudentScore(student_id_hash=student.hashed_identifier, assessment_id=a.id,
                            grading_period=GradingPeriod.prelim, score=score, max_score=50))
    sub = GradeSubmission(course_id=course.id, instructor_id=course.instructor_id,
                          grading_period=GradingPeriod.prelim, status=GradeSubmissionStatus.pending_vp)
    db.add(sub)
    db.commit()

    vp = _user(db, UserRole.vp_academic_affairs, "vp@test.com", college=None)
    r = client.get(f"/grade-submissions/{sub.id}/review", headers=_auth(_token(vp)))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["summary"]["students"] == 2
    assert body["summary"]["passed"] == 1 and body["summary"]["failed"] == 1
    assert body["summary"]["class_average"] == 75.0
    roster = {row["student_number"]: row for row in body["roster"]}
    assert roster["2025-0001"]["percent"] == 90.0 and roster["2025-0001"]["passed"] is True
    assert roster["2025-0002"]["percent"] == 60.0 and roster["2025-0002"]["passed"] is False
    assert body["assessments"][0]["students_scored"] == 2
