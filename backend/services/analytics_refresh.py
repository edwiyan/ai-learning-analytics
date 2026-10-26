"""Recompute a course's derived analytics after its scores or mappings change.

Called after topic mapping finishes and after a faculty override/revert, so the
pre-aggregated tables stay current without running the seed script.
"""
import threading
from collections import defaultdict

from sqlalchemy.orm import Session

from backend.services.ai.feature_engineering import recompute_competency_mastery

# Recompute deletes and re-inserts a course's rows; serialize per course so two
# overlapping refreshes (e.g. a bulk accept in the UI) cannot interleave.
_course_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)


def refresh_course_analytics(course_id, db: Session) -> dict:
    course_id = str(course_id)
    with _course_locks[course_id]:
        mastery_rows = recompute_competency_mastery(course_id, db)
    return {"mastery_rows": mastery_rows}
