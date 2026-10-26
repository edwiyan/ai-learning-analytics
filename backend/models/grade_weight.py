from sqlalchemy import Column, ForeignKey, Float, Enum, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from backend.core.database import Base
from backend.core.types import GUID
from backend.models.assessment import GradingPeriod, AssessmentCategory


class GradeWeight(Base):
    __tablename__ = "grade_weights"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    course_id = Column(GUID(), ForeignKey("courses.id"), nullable=False)
    grading_period = Column(Enum(GradingPeriod), nullable=False)
    assessment_category = Column(Enum(AssessmentCategory), nullable=False)
    weight_percent = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("course_id", "grading_period", "assessment_category", name="uq_grade_weight"),
    )

    course = relationship("Course", back_populates="grade_weights")
