"""Threshold sensitivity: how many enrolments the At-Risk rule would flag under
alternative mastery / gap-count / grade-decline values (panel comment 2). Gives the
BTECH validation meeting concrete numbers to choose thresholds with."""
from sqlalchemy.orm import Session

from backend.models.user import User
from backend.services.ai.feature_engineering import build_student_features, get_all_students_in_course
from backend.services.institution_settings import get_settings
from backend.services.reports.data import scope_label, scoped_courses

MASTERY_OPTIONS = (70.0, 75.0, 80.0)
GAP_OPTIONS = (2, 3, 4)
DECLINE_OPTIONS = (10.0, 15.0, 20.0)


def sensitivity_table(db: Session, user: User) -> dict:
    current = get_settings(db)
    mastery_opts = sorted(set(MASTERY_OPTIONS) | {current.mastery_threshold})
    gap_opts = sorted(set(GAP_OPTIONS) | {current.at_risk_min_gaps})
    decline_opts = sorted(set(DECLINE_OPTIONS) | {current.grade_decline_pct})

    # (competency averages, grade decline) for every enrolment in scope
    enrolments = []
    for course in scoped_courses(db, user):
        for sid in get_all_students_in_course(str(course.id), db):
            f = build_student_features(sid, str(course.id), db)
            if f:
                enrolments.append((list(f["competency_avgs"].values()), f.get("grade_decline_pct", 0.0) or 0.0))

    rows = []
    for mastery in mastery_opts:
        for gaps in gap_opts:
            row = {"mastery_threshold": mastery, "min_gaps": gaps, "flagged": {}}
            for decline in decline_opts:
                n = sum(1 for avgs, d in enrolments
                        if sum(1 for a in avgs if a < mastery) >= gaps or d > decline)
                row["flagged"][str(decline)] = n
            rows.append(row)
    return {
        "scope": scope_label(user),
        "enrolments": len(enrolments),
        "current": {"mastery_threshold": current.mastery_threshold, "min_gaps": current.at_risk_min_gaps,
                    "grade_decline_pct": current.grade_decline_pct},
        "decline_options": [str(d) for d in decline_opts],
        "rows": rows,
    }
