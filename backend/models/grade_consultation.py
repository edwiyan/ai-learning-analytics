import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, String, DateTime, Text, ForeignKey, Enum, Date
from sqlalchemy.sql import func

from backend.core.database import Base
from backend.core.types import GUID
from backend.models.assessment import GradingPeriod


class AdvisingType(str, enum.Enum):
    remediation = "remediation"
    enrichment = "enrichment"
    counseling_referral = "counseling_referral"
    retake_guidance = "retake_guidance"
    no_action_needed = "no_action_needed"


class AcademicStatus(str, enum.Enum):
    passed = "passed"
    failed = "failed"
    incomplete = "incomplete"
    dropped = "dropped"


class GradeConsultation(Base):
    __tablename__ = "grade_consultations"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    instructor_id = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(GUID(), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id_hash = Column(String(64), nullable=False, index=True)
    grading_period = Column(Enum(GradingPeriod), nullable=True)
    conducted_at = Column(DateTime(timezone=True), nullable=True)
    academic_status = Column(Enum(AcademicStatus), nullable=True)
    notes = Column(Text, nullable=True)
    next_steps = Column(Text, nullable=True)
    # T5-B: Incomplete grade fields
    incomplete_reason = Column(Text, nullable=True)
    completion_deadline = Column(Date, nullable=True)
    # T5-C: Post-grade advising fields
    advising_type = Column(Enum(AdvisingType), nullable=True)
    advising_content = Column(Text, nullable=True)
    retake_recommended = Column(Boolean, nullable=False, default=False, server_default="false")
    retake_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
