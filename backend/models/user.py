from sqlalchemy import Column, String, Boolean, DateTime, Enum, event
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import hashlib
import uuid
import enum

from backend.core.database import Base
from backend.core.types import GUID


class UserRole(str, enum.Enum):
    student = "student"
    instructor = "instructor"
    admin = "admin"
    program_director = "program_director"
    dean = "dean"
    vp_academic_affairs = "vp_academic_affairs"


# NOTE (BTECH alignment / PLACEHOLDER pending proponent confirmation):
# Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH) is a city polytechnic.
# These academic units are inferred from the programs the capstone document
# explicitly names (BSIT, BS Accountancy, BEEd, BSEd). Confirm the official
# college/department structure with the proponent before final defense.
class College(str, enum.Enum):
    ICS  = "ICS"   # Institute of Computer Studies (BSIT, BSCS)
    CBA  = "CBA"   # College of Business and Accountancy (BS Accountancy, BSBA)
    CoEd = "CoEd"  # College of Education (BEEd, BSEd)


# Roles that require a college assignment
COLLEGE_SCOPED_ROLES = {UserRole.instructor, UserRole.program_director, UserRole.dean}


class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    college = Column(String, nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    student_number = Column(String, nullable=True, index=True)
    # SHA-256 of the student number (capstone §3.4). Decouples the identifier from
    # performance data and matches the student_id_hash used on scores/enrollments.
    hashed_identifier = Column(String, nullable=True, index=True)
    year_level = Column(String, nullable=True)
    program = Column(String, nullable=True)
    section = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    courses = relationship("Course", back_populates="instructor", foreign_keys="Course.instructor_id")


def _sync_hashed_identifier(mapper, connection, target):
    """Keep hashed_identifier in sync with student_number on every insert/update,
    so all account-creation paths (enrollment, admin, bulk import, seed) populate it
    without per-call-site changes."""
    if target.student_number:
        target.hashed_identifier = hashlib.sha256(
            target.student_number.encode()
        ).hexdigest()


event.listen(User, "before_insert", _sync_hashed_identifier)
event.listen(User, "before_update", _sync_hashed_identifier)
