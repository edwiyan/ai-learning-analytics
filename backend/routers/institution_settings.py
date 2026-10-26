"""Institution settings: the operational thresholds BTECH validates (panel comment 2),
the AI-mapping review rules (comment 1) and the early-warning targets (comment 3).

Anyone signed in can read them (the UI labels use them); only administrators change
them. Every change is audit-logged with old and new values, and analytics are
recomputed for all courses when a risk threshold changes.
"""
import logging
from dataclasses import asdict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.audit import log_action
from backend.core.database import SessionLocal, get_db
from backend.core.deps import get_current_user, require_role
from backend.models.course import Course
from backend.models.user import User, UserRole
from backend.services.institution_settings import RISK_KEYS, SPEC, get_settings, last_updated, update_settings
from backend.services.threshold_sensitivity import sensitivity_table

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/institution-settings", tags=["institution-settings"])

# Patched in tests so the background recompute uses the test database.
_session_factory = SessionLocal


def _view(db: Session) -> dict:
    updated_at, updated_by = last_updated(db)
    who = db.get(User, updated_by) if updated_by else None
    return {
        "values": asdict(get_settings(db)),
        "spec": {k: {"label": v[0], "description": v[1], "min": v[2], "max": v[3]} for k, v in SPEC.items()},
        "updated_at": updated_at.isoformat() if updated_at else None,
        "updated_by": who.full_name if who else None,
    }


@router.get("/")
def read_settings(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _view(db)


def _recompute_all_courses():
    from backend.services.analytics_refresh import refresh_course_analytics
    db = _session_factory()
    try:
        for (course_id,) in db.query(Course.id).all():
            try:
                refresh_course_analytics(course_id, db)
            except Exception as exc:  # one bad course must not stop the rest
                db.rollback()
                logger.warning("Analytics refresh failed for course %s: %s", course_id, exc)
    finally:
        db.close()


@router.put("/")
def change_settings(
    changes: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    try:
        _, changed = update_settings(db, changes, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if changed:
        log_action(db, str(current_user.id), "update_institution_settings", target_table="institution_settings",
                   extra={k: {"old": old, "new": new} for k, (old, new) in changed.items()})
        if RISK_KEYS & set(changed):
            background_tasks.add_task(_recompute_all_courses)
    return {**_view(db), "changed": sorted(changed), "recomputing": bool(RISK_KEYS & set(changed))}


@router.get("/sensitivity")
def threshold_sensitivity(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.vp_academic_affairs,
                                              UserRole.dean, UserRole.program_director)),
):
    """How many enrolments would be flagged At-Risk under alternative thresholds, to
    support BTECH's threshold validation meeting."""
    return sensitivity_table(db, current_user)
