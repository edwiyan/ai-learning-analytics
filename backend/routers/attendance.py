from collections import defaultdict
from datetime import date as DateType
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.deps import require_role, get_current_user
from backend.core.security import hash_student_id
from backend.models.attendance import AttendanceRecord, AttendanceStatus
from backend.models.course import Course
from backend.models.user import User, UserRole
from backend.schemas.attendance import (
    AttendanceBulkCreate,
    AttendanceCreate,
    AttendanceResponse,
    AttendanceSummaryItem,
)

router = APIRouter(prefix="/attendance", tags=["attendance"])


def _assert_course_access(course: Course, current_user: User):
    if current_user.role == UserRole.instructor and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your course")


def _parse_date(date_str: str) -> DateType:
    try:
        return DateType.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format — use YYYY-MM-DD")


def _record_to_dict(r: AttendanceRecord) -> dict:
    return {
        "id": str(r.id),
        "student_id_hash": r.student_id_hash,
        "course_id": str(r.course_id),
        "date": str(r.date),
        "status": r.status.value,
        "notes": r.notes,
    }


@router.post("/{course_id}/bulk", status_code=201)
def bulk_create_records(
    course_id: str,
    body: AttendanceBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    _assert_course_access(course, current_user)

    record_date = _parse_date(body.date)

    existing_map = {
        r.student_id_hash: r
        for r in db.query(AttendanceRecord).filter(
            AttendanceRecord.course_id == course_id,
            AttendanceRecord.date == record_date,
        ).all()
    }

    for item in body.records:
        if item.student_id_hash in existing_map:
            rec = existing_map[item.student_id_hash]
            rec.status = AttendanceStatus(item.status)
            rec.notes = item.notes
            rec.recorded_by = current_user.id
        else:
            db.add(AttendanceRecord(
                student_id_hash=item.student_id_hash,
                course_id=course_id,
                date=record_date,
                status=AttendanceStatus(item.status),
                recorded_by=current_user.id,
                notes=item.notes,
            ))

    db.commit()
    return {"saved": len(body.records), "date": body.date}


@router.post("/{course_id}", status_code=201)
def create_record(
    course_id: str,
    body: AttendanceCreate,
    date: str = Query(..., description="ISO date YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    _assert_course_access(course, current_user)

    record_date = _parse_date(date)

    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.course_id == course_id,
        AttendanceRecord.student_id_hash == body.student_id_hash,
        AttendanceRecord.date == record_date,
    ).first()

    if existing:
        existing.status = AttendanceStatus(body.status)
        existing.notes = body.notes
        existing.recorded_by = current_user.id
        db.commit()
        return _record_to_dict(existing)

    rec = AttendanceRecord(
        student_id_hash=body.student_id_hash,
        course_id=course_id,
        date=record_date,
        status=AttendanceStatus(body.status),
        recorded_by=current_user.id,
        notes=body.notes,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return _record_to_dict(rec)


@router.get("/{course_id}/summary")
def get_summary(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    _assert_course_access(course, current_user)

    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.course_id == course_id
    ).all()
    if not records:
        return []

    student_records: dict = defaultdict(list)
    for r in records:
        student_records[r.student_id_hash].append(r)

    all_students = db.query(User).filter(
        User.role == UserRole.student,
        User.student_number.isnot(None),
    ).all()
    hash_to_user = {hash_student_id(s.student_number): s for s in all_students}

    result = []
    for sid_hash, recs in student_records.items():
        user = hash_to_user.get(sid_hash)
        dates = set(r.date for r in recs)
        total_sessions = len(dates)
        absent = sum(1 for r in recs if r.status == AttendanceStatus.absent)
        present = sum(1 for r in recs if r.status == AttendanceStatus.present)
        late = sum(1 for r in recs if r.status == AttendanceStatus.late)
        excused = sum(1 for r in recs if r.status == AttendanceStatus.excused)
        result.append(AttendanceSummaryItem(
            student_id_hash=sid_hash,
            full_name=user.full_name if user else None,
            student_number=user.student_number if user else None,
            total_sessions=total_sessions,
            present_count=present,
            absent_count=absent,
            late_count=late,
            excused_count=excused,
            absence_rate=round(absent / total_sessions, 3) if total_sessions > 0 else 0.0,
        ))

    return sorted(result, key=lambda x: x.absence_rate, reverse=True)


@router.get("/{course_id}")
def list_records(
    course_id: str,
    date: Optional[str] = Query(None, description="Filter by ISO date YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    _assert_course_access(course, current_user)

    q = db.query(AttendanceRecord).filter(AttendanceRecord.course_id == course_id)
    if date:
        q = q.filter(AttendanceRecord.date == _parse_date(date))

    records = q.order_by(AttendanceRecord.date.desc()).all()
    return [_record_to_dict(r) for r in records]
