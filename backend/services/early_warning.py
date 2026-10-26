"""Early-warning timeliness (panel comment 3: show that intervention is actually early).

An At-Risk *episode* starts at the risk snapshot where a student's level changes to
At-Risk (snapshots are written whenever results are uploaded or a mapping changes).
For each student-course this module reports:
  * when the student was first flagged and in which grading period; a flag in the
    institution's early-warning period (default Prelim, i.e. before the Midterm) is "early";
  * how many school days (weekdays) passed until the instructor logged an intervention;
  * whether a current episode is overdue (no intervention within the target).
"""
from datetime import date, datetime, timedelta, timezone
from statistics import median

from sqlalchemy.orm import Session

from backend.models.instructor_intervention import InstructorIntervention
from backend.models.prediction import RiskLevel, RiskPrediction
from backend.services.institution_settings import get_settings

PERIOD_ORDER = ["prelim", "midterm", "semi_final", "final"]
PERIOD_LABELS = {"prelim": "Prelim", "midterm": "Midterm", "semi_final": "Semi-Final", "final": "Final"}


def _utc_date(dt) -> date | None:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).date()
    return dt


def school_days_between(start: date, end: date) -> int:
    """Weekdays after `start` up to and including `end` (same day = 0)."""
    if end <= start:
        return 0
    days, d = 0, start
    while d < end:
        d += timedelta(days=1)
        if d.weekday() < 5:
            days += 1
    return days


def _level(v):
    return getattr(v, "value", v)


def episodes(course_ids, db: Session) -> dict:
    """{(course_id, student_hash): {"first": snapshot, "latest_start": snapshot, "current": level}}"""
    if not course_ids:
        return {}
    snaps = (db.query(RiskPrediction)
             .filter(RiskPrediction.course_id.in_(course_ids))
             .order_by(RiskPrediction.predicted_at, RiskPrediction.id).all())
    out: dict = {}
    for s in snaps:
        key = (str(s.course_id), s.student_id_hash)
        state = out.setdefault(key, {"first": None, "latest_start": None, "current": None})
        level = _level(s.risk_level)
        if level == RiskLevel.at_risk.value and state["current"] != RiskLevel.at_risk.value:
            state["latest_start"] = s
            if state["first"] is None:
                state["first"] = s
        state["current"] = level
    return {k: v for k, v in out.items() if v["first"] is not None}


def timeliness(course_ids, db: Session, today: date | None = None) -> dict:
    """Per-enrolment rows for every student ever flagged At-Risk, plus a summary."""
    settings = get_settings(db)
    today = today or datetime.now(timezone.utc).date()
    early_cut = PERIOD_ORDER.index(settings.early_warning_period) if settings.early_warning_period in PERIOD_ORDER else 0
    target = settings.intervention_target_school_days

    eps = episodes(course_ids, db)
    interventions: dict = {}
    if eps:
        for iv in (db.query(InstructorIntervention)
                   .filter(InstructorIntervention.course_id.in_(course_ids))
                   .order_by(InstructorIntervention.created_at).all()):
            interventions.setdefault((str(iv.course_id), iv.student_id_hash), []).append(iv)

    rows = []
    for (course_id, sid), ep in eps.items():
        first, start = ep["first"], ep["latest_start"]
        period = (first.grading_period or "").lower()
        flagged_on = _utc_date(first.predicted_at)
        ivs = interventions.get((course_id, sid), [])
        # first intervention logged on or after the day of the first flag
        first_iv = next((iv for iv in ivs if _utc_date(iv.created_at) >= flagged_on), None)
        days_to_iv = school_days_between(flagged_on, _utc_date(first_iv.created_at)) if first_iv else None

        current_at_risk = ep["current"] == RiskLevel.at_risk.value
        episode_on = _utc_date(start.predicted_at)
        episode_iv = next((iv for iv in ivs if _utc_date(iv.created_at) >= episode_on), None)
        waiting = school_days_between(episode_on, today) if current_at_risk and not episode_iv else None
        rows.append({
            "course_id": course_id,
            "student_id_hash": sid,
            "first_flagged_on": flagged_on.isoformat() if flagged_on else None,
            "first_flagged_period": PERIOD_LABELS.get(period, period or "Unknown"),
            "early": period in PERIOD_ORDER and PERIOD_ORDER.index(period) <= early_cut,
            "intervention_on": _utc_date(first_iv.created_at).isoformat() if first_iv else None,
            "school_days_to_intervention": days_to_iv,
            "within_target": days_to_iv is not None and days_to_iv <= target,
            "currently_at_risk": current_at_risk,
            "current_episode_started": episode_on.isoformat() if episode_on else None,
            "current_episode_snapshot_id": str(start.id),
            "school_days_waiting": waiting,
            "overdue": waiting is not None and waiting > target,
        })

    n = len(rows)
    days = [r["school_days_to_intervention"] for r in rows if r["school_days_to_intervention"] is not None]
    summary = {
        "flagged": n,
        "flagged_early": sum(1 for r in rows if r["early"]),
        "flagged_early_pct": round(sum(1 for r in rows if r["early"]) / n * 100, 1) if n else None,
        "with_intervention": len(days),
        "median_school_days_to_intervention": median(days) if days else None,
        "within_target": sum(1 for r in rows if r["within_target"]),
        "within_target_pct": round(sum(1 for r in rows if r["within_target"]) / n * 100, 1) if n else None,
        "overdue": sum(1 for r in rows if r["overdue"]),
        "early_period": PERIOD_LABELS.get(settings.early_warning_period, settings.early_warning_period),
        "target_school_days": target,
    }
    return {"summary": summary, "rows": rows}


def remind_overdue(course_ids, db: Session) -> int:
    """One in-app reminder per At-Risk episode that passed the intervention target
    without a logged intervention. Returns the number of reminders created."""
    from backend.core.notifications import notify
    from backend.models.course import Course
    from backend.models.notification import Notification

    data = timeliness(course_ids, db)
    overdue = [r for r in data["rows"] if r["overdue"]]
    if not overdue:
        return 0
    already = {n.related_id for n in db.query(Notification.related_id)
               .filter(Notification.type == "intervention_overdue").all()}
    courses = {str(c.id): c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    created = 0
    for r in overdue:
        if r["current_episode_snapshot_id"] in already:
            continue
        course = courses.get(r["course_id"])
        if not course:
            continue
        notify(db, str(course.instructor_id), "intervention_overdue",
               f"Follow-up overdue in {course.code}",
               f"A student flagged At-Risk on {r['current_episode_started']} has no logged intervention after "
               f"{r['school_days_waiting']} school days (target: {data['summary']['target_school_days']}). "
               "Open Intervention Alerts to follow up.",
               related_id=r["current_episode_snapshot_id"])
        created += 1
    if created:
        db.commit()
    return created
