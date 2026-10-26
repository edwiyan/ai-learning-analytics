"""At-Risk alerts (capstone §3.8.2): when a student newly becomes At-Risk, notify
the course instructor (faculty alert) and the student (student notification).

Alerts fire only on the transition into At-Risk, so a student who stays At-Risk
is not alerted again on every recompute. Alerts are advisory; they never change
grades or academic standing.
"""
import html
import logging

from sqlalchemy.orm import Session

from backend.core.email import send_email, smtp_configured
from backend.core.notifications import notify
from backend.models.course import Course
from backend.models.user import User, UserRole
from backend.services.ai.risk_snapshot import RiskTransition
from backend.services.institution_settings import DEFAULTS, get_settings

logger = logging.getLogger(__name__)


def risk_reason(t: RiskTransition, settings=DEFAULTS) -> str:
    """Plain-language reason matching the Table 3.8.2 At-Risk rule."""
    reasons = []
    if t.learning_gap_count >= settings.at_risk_min_gaps:
        reasons.append(f"{t.learning_gap_count} competencies below {settings.mastery_threshold:g}% mastery")
    if t.grade_decline_pct > settings.grade_decline_pct:
        reasons.append(f"a {t.grade_decline_pct:.1f}% grade decline from the previous grading period")
    return " and ".join(reasons) or "the At-Risk criteria"


def _alert_email_html(heading: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
    <p style="margin:0 0 4px;font-size:12px;color:#64748b;letter-spacing:.05em;text-transform:uppercase;">AILAS – BTECH</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">{html.escape(heading)}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">{html.escape(body)}</p>
    <p style="margin:0;font-size:12px;color:#94a3b8;">This alert is advisory. Log in to AILAS for details.</p>
  </div>
</body></html>"""


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
    instructor = db.query(User).filter(User.id == course.instructor_id).first() if course.instructor_id else None
    emails = []  # (to, subject, heading, body), sent after the notifications are committed

    for t in newly_at_risk:
        student = students.get(t.student_id_hash)
        name = student.full_name if student else f"Student {t.student_id_hash[:8]}"
        reason = risk_reason(t, get_settings(db))
        if instructor:
            title = f"{name} is now At-Risk in {course.code}"
            body = (f"{name} was flagged At-Risk because of {reason}. "
                    f"Review the student's profile and consider an intervention.")
            notify(db, str(instructor.id), "student_at_risk", title, body, related_id=str(course.id))
            if instructor.email:
                emails.append((instructor.email, f"[AILAS] {title}", title, body))
        if student:
            title = f"Academic alert for {course.code}"
            body = (f"Your results in {course.title} show {reason}. "
                    f"Check your recommended resources and reach out to your instructor for support.")
            notify(db, str(student.id), "at_risk_alert", title, body, related_id=str(course.id))
            if student.email:
                emails.append((student.email, f"[AILAS] {title}", title, body))
        else:
            logger.info("At-Risk student %s has no account; instructor alerted only", t.student_id_hash[:8])
    db.commit()

    if smtp_configured():
        for to, subject, heading, body in emails:
            send_email(to, subject, _alert_email_html(heading, body))
    return len(newly_at_risk)
