"""Shared read-access rule for course-owned records (assessments, ToS, grade
submissions, approval histories).

Allowed: administrators and the VP for Academic Affairs (institution-wide), the
course's own instructor, and the Program Director / Dean of the instructor's college.
Students and other instructors are refused.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.models.user import User, UserRole


def assert_course_read_access(instructor_id, current_user: User, db: Session) -> None:
    if current_user.role in (UserRole.admin, UserRole.vp_academic_affairs):
        return
    if current_user.role == UserRole.instructor and str(instructor_id) == str(current_user.id):
        return
    if current_user.role in (UserRole.program_director, UserRole.dean) and current_user.college:
        owner = db.get(User, instructor_id)
        if owner and owner.college == current_user.college:
            return
    raise HTTPException(status_code=403, detail="You do not have access to this record")
