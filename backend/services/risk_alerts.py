"""At-Risk alerts (capstone §3.8.2): when a student newly becomes At-Risk, notify
the course instructor (faculty alert) and the student (student notification).

Alerts fire only on the transition into At-Risk, so a student who stays At-Risk
is not alerted again on every recompute. Alerts are advisory; they never change
grades or academic standing.
"""
import logging

from sqlalchemy.orm import Session

from backend.core.notifications import notify
from backend.models.course import Course
from backend.models.user import User, UserRole
from backend.services.ai.risk_snapshot import RiskTransition

logger = logging.getLogger(__name__)


def risk_reason(t: RiskTransition) -> str:
    """Plain-language reason matching the Table 3.8.2 At-Risk rule."""
    reasons = []
    if t.learning_gap_count >= 3:
        reasons.append(f"{t.learning_gap_count} competencies below 75% mastery")
    if t.grade_decline_pct > 15:
        reasons.append(f"a {t.grade_decline_pct:.1f}% grade decline from the previous grading period")
    return " and ".join(reasons) or "the At-Risk criteria"


def dispatch_risk_alerts(course_id, transitions: list[RiskTransition], db: Session) -> int:
    """Create in-app notifications for students who just became At-Risk.
    Returns the number of students alerted. Caller commits."""
    newly_at_risk = [t for t in transitions if t.became_at_risk]
    if not newly_at_risk:
        return 0
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return 0

    hashes = [t.student_id_hash for t in newly_at_risk]
    students = {
        u.hashed_identifier: u
        for u in db.query(User).filter(User.role == UserRole.student, User.hashed_identifier.in_(hashes)).all()
    }

    for t in newly_at_risk:
        student = students.get(t.student_id_hash)
        name = student.full_name if student else f"Student {t.student_id_hash[:8]}"
        reason = risk_reason(t)
        if course.instructor_id:
            notify(db, str(course.instructor_id), "student_at_risk",
                   f"{name} is now At-Risk in {course.code}",
                   f"{name} was flagged At-Risk because of {reason}. "
                   f"Review the student's profile and consider an intervention.",
                   related_id=str(course.id))
        if student:
            notify(db, str(student.id), "at_risk_alert",
                   f"Academic alert for {course.code}",
                   f"Your results in {course.title} show {reason}. "
                   f"Check your recommended resources and reach out to your instructor for support.",
                   related_id=str(course.id))
        else:
            logger.info("At-Risk student %s has no account; instructor alerted only", t.student_id_hash[:8])
    db.commit()
    return len(newly_at_risk)
