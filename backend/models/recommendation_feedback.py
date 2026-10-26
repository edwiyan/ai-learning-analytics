from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, UniqueConstraint
from sqlalchemy.sql import func
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class RecommendationFeedback(Base):
    """A student's rating of a recommended resource (capstone §2.3 Feedback Loop).
    One row per student per resource; re-rating updates it."""
    __tablename__ = "recommendation_feedback"
    __table_args__ = (UniqueConstraint("student_id_hash", "resource_id", name="uq_rec_feedback_student_resource"),)

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id_hash = Column(String(64), nullable=False, index=True)
    resource_id = Column(GUID(), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(GUID(), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    helpful = Column(Boolean, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
