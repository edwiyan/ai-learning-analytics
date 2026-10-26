from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from backend.core.database import Base
from backend.core.types import GUID
from backend.models.assessment import GradingPeriod


class StudentScore(Base):
    __tablename__ = "student_scores"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id_hash = Column(String, nullable=False, index=True)
    assessment_id = Column(GUID(), ForeignKey("assessments.id"), nullable=False)
    item_id = Column(GUID(), ForeignKey("assessment_items.id"), nullable=True)
    competency_id = Column(GUID(), ForeignKey("competencies.id"))
    grading_period = Column(Enum(GradingPeriod), nullable=False)
    score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)
    submission_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assessment = relationship("Assessment", back_populates="scores")
    item = relationship("AssessmentItem", back_populates="scores")
    competency = relationship("Competency", back_populates="student_scores")
