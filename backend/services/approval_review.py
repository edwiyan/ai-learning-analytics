"""Review packets for the PD → Dean → VP approval chains.

Each builder returns everything an approver needs to see before approving or
endorsing a record: the course and instructor it belongs to, the actual content
being approved (syllabus competencies, drafted exam questions + TOS, or the
computed period grades), and the decisions already made earlier in the chain.
"""
import os
from collections import defaultdict

from sqlalchemy.orm import Session

from backend.models.assessment import Assessment
from backend.models.course import Course
from backend.models.exam_question import ExamQuestion
from backend.models.grade_submission import GradeSubmission, GradeSubmissionApproval
from backend.models.grade_weight import GradeWeight
from backend.models.score import StudentScore
from backend.models.syllabus import Syllabus, SyllabusApproval
from backend.models.tos import TableOfSpecifications
from backend.models.user import User, UserRole
from backend.services.grading import get_letter_grade


def _value(v):
    return getattr(v, "value", v)


def _course_info(course: Course | None, db: Session) -> dict | None:
    if not course:
        return None
    instructor = db.get(User, course.instructor_id)
    return {
        "id": str(course.id),
        "code": course.code,
        "title": course.title,
        "academic_period": course.academic_period,
        "passing_grade": course.passing_grade,
        "instructor_name": instructor.full_name if instructor else None,
        "instructor_email": instructor.email if instructor else None,
        "college": instructor.college if instructor else None,
    }


def _history(rows, db: Session) -> list[dict]:
    out = []
    for r in rows:
        approver = db.get(User, r.approver_id)
        out.append({
            "role": r.role,
            "status": r.status,
            "feedback": r.feedback,
            "approver_name": approver.full_name if approver else None,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        })
    return out


def syllabus_review(syllabus: Syllabus, db: Session) -> dict:
    parsed = syllabus.parsed_json if isinstance(syllabus.parsed_json, dict) else {}
    approvals = (
        db.query(SyllabusApproval)
        .filter(SyllabusApproval.syllabus_id == syllabus.id)
        .order_by(SyllabusApproval.reviewed_at)
        .all()
    )
    return {
        "id": str(syllabus.id),
        "approval_stage": _value(syllabus.approval_stage),
        "submitted_title": parsed.get("course_title"),
        "course": _course_info(db.get(Course, syllabus.course_id), db),
        "has_file": bool(syllabus.file_path) and os.path.isfile(syllabus.file_path),
        "file_name": os.path.basename(syllabus.file_path) if syllabus.file_path else None,
        "competencies": [
            {
                "competency_code": c.competency_code,
                "topic_name": c.topic_name,
                "learning_outcomes": c.learning_outcomes or [],
            }
            for c in sorted(syllabus.competencies, key=lambda c: c.competency_code or "")
        ],
        "history": _history(approvals, db),
    }


def assessment_review(assessment: Assessment, db: Session) -> dict:
    questions = (
        db.query(ExamQuestion)
        .filter(ExamQuestion.assessment_id == assessment.id)
        .order_by(ExamQuestion.order_index, ExamQuestion.created_at)
        .all()
    )
    tos = db.query(TableOfSpecifications).filter(TableOfSpecifications.assessment_id == assessment.id).all()
    return {
        "id": str(assessment.id),
        "title": assessment.title,
        "type": _value(assessment.type),
        "grading_period": _value(assessment.grading_period),
        "assessment_category": _value(assessment.assessment_category),
        "date": assessment.date.isoformat() if assessment.date else None,
        "approval_status": _value(assessment.approval_status),
        "course": _course_info(db.get(Course, assessment.course_id), db),
        "total_points": round(sum(q.points or 0 for q in questions), 2),
        "questions": [
            {
                "number": i,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "choices": q.choices or [],
                "answer_key": q.answer_key,
                "points": q.points,
                "bloom_level": q.bloom_level,
                "competency_code": q.competency.competency_code if q.competency else None,
                "topic_name": q.competency.topic_name if q.competency else None,
            }
            for i, q in enumerate(questions, start=1)
        ],
        "tos": [
            {
                "competency_code": e.competency.competency_code if e.competency else None,
                "topic_name": e.competency.topic_name if e.competency else None,
                "bloom_level": e.bloom_level,
                "item_count": e.item_count,
                "weight_percent": e.weight_percent,
            }
            for e in tos
        ],
        "history": _history(assessment.approvals, db),
    }


def _period_percent(by_assessment: dict, categories: dict, weights: dict) -> float:
    """by_assessment: assessment_id → percent. Uses the course's period×category
    weights when configured, otherwise a plain mean of the assessment percents."""
    by_cat: dict[str, list[float]] = defaultdict(list)
    for aid, pct in by_assessment.items():
        by_cat[categories.get(aid) or "formative"].append(pct)
    weighted = [(sum(v) / len(v), weights[c]) for c, v in by_cat.items() if weights.get(c)]
    total_w = sum(w for _, w in weighted)
    if total_w > 0:
        return sum(avg * w for avg, w in weighted) / total_w
    vals = list(by_assessment.values())
    return sum(vals) / len(vals) if vals else 0.0


def grade_submission_review(submission: GradeSubmission, db: Session) -> dict:
    course = db.get(Course, submission.course_id)
    period = submission.grading_period
    assessments = (
        db.query(Assessment)
        .filter(Assessment.course_id == submission.course_id, Assessment.grading_period == period)
        .order_by(Assessment.date, Assessment.created_at)
        .all()
    )
    categories = {str(a.id): _value(a.assessment_category) for a in assessments}
    weights = {
        _value(w.assessment_category): w.weight_percent
        for w in db.query(GradeWeight).filter(
            GradeWeight.course_id == submission.course_id, GradeWeight.grading_period == period
        )
    }

    # student → assessment → [score, max]
    totals: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))
    if assessments:
        for s in db.query(StudentScore).filter(StudentScore.assessment_id.in_([a.id for a in assessments])):
            t = totals[s.student_id_hash][str(s.assessment_id)]
            t[0] += s.score
            t[1] += s.max_score

    students = {
        u.hashed_identifier: u
        for u in db.query(User).filter(
            User.role == UserRole.student, User.hashed_identifier.in_(list(totals.keys()))
        )
    } if totals else {}

    passing = course.passing_grade if course else 75.0
    assessment_sums: dict[str, list[float]] = defaultdict(list)
    roster = []
    for h, per_a in totals.items():
        pcts = {aid: (sc / mx * 100 if mx > 0 else 0.0) for aid, (sc, mx) in per_a.items()}
        for aid, pct in pcts.items():
            assessment_sums[aid].append(pct)
        pct = round(_period_percent(pcts, categories, weights), 2)
        u = students.get(h)
        roster.append({
            "student_name": u.full_name if u else None,
            "student_number": u.student_number if u else None,
            "student_ref": h[:8],
            "section": u.section if u else None,
            "assessments_taken": len(pcts),
            "percent": pct,
            "grade": get_letter_grade(pct, db),
            "passed": pct >= passing,
        })
    roster.sort(key=lambda r: ((r["student_name"] or "~").lower(), r["student_ref"]))

    pcts = [r["percent"] for r in roster]
    approvals = (
        db.query(GradeSubmissionApproval)
        .filter(GradeSubmissionApproval.submission_id == submission.id)
        .order_by(GradeSubmissionApproval.reviewed_at)
        .all()
    )
    return {
        "id": str(submission.id),
        "grading_period": _value(period),
        "status": _value(submission.status),
        "notes": submission.notes,
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "course": _course_info(course, db),
        "weights": weights,
        "summary": {
            "students": len(roster),
            "passed": sum(1 for r in roster if r["passed"]),
            "failed": sum(1 for r in roster if not r["passed"]),
            "class_average": round(sum(pcts) / len(pcts), 2) if pcts else None,
            "highest": max(pcts) if pcts else None,
            "lowest": min(pcts) if pcts else None,
        },
        "assessments": [
            {
                "title": a.title,
                "type": _value(a.type),
                "category": _value(a.assessment_category),
                "approval_status": _value(a.approval_status),
                "students_scored": len(assessment_sums.get(str(a.id), [])),
                "class_average": (
                    round(sum(assessment_sums[str(a.id)]) / len(assessment_sums[str(a.id)]), 2)
                    if assessment_sums.get(str(a.id)) else None
                ),
            }
            for a in assessments
        ],
        "roster": roster,
        "history": _history(approvals, db),
    }
