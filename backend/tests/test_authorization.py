"""Authorization / access-control regression suite.

WHY THIS FILE EXISTS
--------------------
The existing functional QA (Playwright journeys + happy-path pytest) logs in as a
single role and checks that the feature works on good input. It never points one
role's token at another role's resource, so it cannot catch *broken access
control* — the most common real-world API vulnerability. This suite does exactly
that: it authenticates as user A and then tries to read/modify user B's data.

HOW TO READ THE RESULTS
-----------------------
Every test asserts the SECURE expected behavior (the wrong user gets 403).

* Tests WITHOUT an xfail marker exercise guards that already work
  (e.g. require_role). They must stay green.

* Tests marked ``pytest.mark.xfail(strict=True)`` document a *known, currently
  unfixed* access-control hole (see the referenced finding). They "xfail" today
  because the endpoint is still vulnerable, so the suite is green overall.
  When you fix the endpoint, the test will start passing — and because the
  marker is ``strict=True``, an unexpected pass (XPASS) makes the run FAIL.
  That failure is the signal to DELETE the xfail marker, turning the test into a
  permanent regression guard. In other words: fix the bug, then remove the
  marker the run tells you to remove.

The findings referenced below come from the 2026-06-03 code review
(AILAS_Code_Review_Findings.docx).
"""
import uuid

import pytest

from backend.models.assessment import (
    Assessment,
    AssessmentApproval,
    AssessmentItem,
    AssessmentType,
    GradingPeriod,
)
from backend.models.course import Course
from backend.models.grade_submission import GradeSubmission, GradeSubmissionStatus


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _seed_course_with_data(db, owner):
    """Create a course owned by ``owner`` plus an assessment, one item, one
    approval record (with sensitive reviewer feedback) and a grade submission.
    Returns the created ORM objects."""
    course = Course(
        title="Data Structures",
        code="CS201",
        academic_period="2025-2026-1",
        instructor_id=owner.id,
    )
    db.add(course)
    db.flush()

    assessment = Assessment(
        course_id=course.id,
        title="Midterm Exam",
        type=AssessmentType.exam,
        grading_period=GradingPeriod.midterm,
    )
    db.add(assessment)
    db.flush()

    item = AssessmentItem(
        assessment_id=assessment.id,
        question_text="Explain the time complexity of binary search.",
        needs_review=True,
    )
    db.add(item)

    approval = AssessmentApproval(
        assessment_id=assessment.id,
        approver_id=owner.id,
        role="program_director",
        status="rejected",
        feedback="Sensitive reviewer note: item 3 is biased; revise before posting.",
    )
    db.add(approval)

    submission = GradeSubmission(
        course_id=course.id,
        instructor_id=owner.id,
        grading_period=GradingPeriod.midterm,
        status=GradeSubmissionStatus.pending_pd,
        notes="Confidential: two students flagged for academic dishonesty.",
    )
    db.add(submission)

    db.commit()
    for obj in (course, assessment, item, approval, submission):
        db.refresh(obj)
    return course, assessment, item, approval, submission


# ---------------------------------------------------------------------------
# Positive controls — guards that already work. These MUST stay green.
# ---------------------------------------------------------------------------

def test_unauthenticated_request_is_rejected(client, db, instructor_user):
    _, assessment, *_ = _seed_course_with_data(db, instructor_user)
    resp = client.get(f"/assessments/{assessment.id}/tos")
    assert resp.status_code == 403


def test_student_cannot_list_users(client, student_token):
    resp = client.get("/users/", headers=_auth(student_token))
    assert resp.status_code == 403


def test_student_cannot_create_assessment(client, student_token, db, instructor_user):
    course, *_ = _seed_course_with_data(db, instructor_user)
    payload = {"title": "Sneaky Quiz", "type": "quiz", "grading_period": "midterm"}
    resp = client.post(f"/assessments/{course.id}", json=payload, headers=_auth(student_token))
    assert resp.status_code == 403


def test_student_cannot_override_tag(client, student_token, db, instructor_user):
    """require_role already blocks non-instructors from retagging, so this
    passes today; it guards against that role check being weakened later."""
    _, _, item, *_ = _seed_course_with_data(db, instructor_user)
    resp = client.put(
        f"/assessments/items/{item.id}/tag",
        params={"competency_id": str(uuid.uuid4())},
        headers=_auth(student_token),
    )
    assert resp.status_code == 403


def test_owner_instructor_can_read_own_tos(client, instructor_token, db, instructor_user):
    """Positive control: the legitimate owner must still get their own data."""
    _, assessment, *_ = _seed_course_with_data(db, instructor_user)
    resp = client.get(f"/assessments/{assessment.id}/tos", headers=_auth(instructor_token))
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Known unfixed holes — assert the secure behavior; xfail until the endpoint
# is fixed. See module docstring for what to do when these start passing.
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="Finding 1: GET /assessments/{id}/approval-history has no "
                          "ownership/role check (assessments.py:264)", strict=True)
def test_student_cannot_read_assessment_approval_history(client, student_token, db, instructor_user):
    _, assessment, *_ = _seed_course_with_data(db, instructor_user)
    resp = client.get(
        f"/assessments/{assessment.id}/approval-history", headers=_auth(student_token)
    )
    assert resp.status_code == 403


@pytest.mark.xfail(reason="Finding 1: GET /assessments/{id}/tos has no ownership/role "
                          "check (assessments.py:278)", strict=True)
def test_student_cannot_read_assessment_tos(client, student_token, db, instructor_user):
    _, assessment, *_ = _seed_course_with_data(db, instructor_user)
    resp = client.get(f"/assessments/{assessment.id}/tos", headers=_auth(student_token))
    assert resp.status_code == 403


@pytest.mark.xfail(reason="Finding 1: assessment reads are not scoped to the owning "
                          "instructor (assessments.py:278)", strict=True)
def test_foreign_instructor_cannot_read_assessment_tos(
    client, other_instructor_token, db, instructor_user
):
    _, assessment, *_ = _seed_course_with_data(db, instructor_user)
    resp = client.get(
        f"/assessments/{assessment.id}/tos", headers=_auth(other_instructor_token)
    )
    assert resp.status_code == 403


@pytest.mark.xfail(reason="Finding 2: GET /grade-submissions/{id} has no ownership/role "
                          "check (grade_submissions.py:212)", strict=True)
def test_student_cannot_read_grade_submission(client, student_token, db, instructor_user):
    *_, submission = _seed_course_with_data(db, instructor_user)
    resp = client.get(f"/grade-submissions/{submission.id}", headers=_auth(student_token))
    assert resp.status_code == 403


@pytest.mark.xfail(reason="Finding 2: grade submissions are not scoped to the owning "
                          "instructor (grade_submissions.py:212)", strict=True)
def test_foreign_instructor_cannot_read_grade_submission(
    client, other_instructor_token, db, instructor_user
):
    *_, submission = _seed_course_with_data(db, instructor_user)
    resp = client.get(
        f"/grade-submissions/{submission.id}", headers=_auth(other_instructor_token)
    )
    assert resp.status_code == 403


def test_foreign_instructor_cannot_override_tag(
    client, other_instructor_token, db, instructor_user
):
    _, _, item, *_ = _seed_course_with_data(db, instructor_user)
    resp = client.put(
        f"/assessments/items/{item.id}/tag",
        params={"competency_id": str(uuid.uuid4())},
        headers=_auth(other_instructor_token),
    )
    assert resp.status_code == 403


def test_foreign_instructor_cannot_revert_item(
    client, other_instructor_token, db, instructor_user
):
    _, _, item, *_ = _seed_course_with_data(db, instructor_user)
    resp = client.put(
        f"/assessments/items/{item.id}/revert", headers=_auth(other_instructor_token)
    )
    assert resp.status_code == 403


def test_override_rejects_competency_from_another_course(
    client, instructor_token, db, instructor_user
):
    """The owner may only tag items with competencies from this course's
    validated syllabus, not an arbitrary competency id."""
    _, _, item, *_ = _seed_course_with_data(db, instructor_user)
    resp = client.put(
        f"/assessments/items/{item.id}/tag",
        params={"competency_id": str(uuid.uuid4())},
        headers=_auth(instructor_token),
    )
    assert resp.status_code == 422
