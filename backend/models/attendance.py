import enum
import uuid
from sqlalchemy import Column, String, Date, ForeignKey, Enum, DateTime, Text
from sqlalchemy.sql import func

from backend.core.database import Base
from backend.core.types import GUID


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    excused = "excused"


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id_hash = Column(String(64), nullable=False, index=True)
    course_id = Column(GUID(), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(Enum(AttendanceStatus), nullable=False)
    recorded_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
