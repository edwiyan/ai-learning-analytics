import uuid
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.sql import func
from backend.core.database import Base
from backend.core.types import GUID


class AcademicStandingLevel(str, enum.Enum):
    good = "good"
    warning = "warning"
    probation = "probation"
    dismissal_risk = "dismissal_risk"


class AcademicStanding(Base):
    __tablename__ = "academic_standings"
    __table_args__ = (
        UniqueConstraint("student_id_hash", "course_id", name="uq_academic_standing_student_course"),
    )

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id_hash = Column(String(64), nullable=False, index=True)
    course_id = Column(GUID(), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_year = Column(String(20), nullable=True)
    semester = Column(String(20), nullable=True)
    standing = Column(Enum(AcademicStandingLevel), nullable=False, default=AcademicStandingLevel.good)
    computed_at = Column(DateTime(timezone=True), server_default=func.now())
