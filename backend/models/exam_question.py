from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Text, Integer, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class ExamQuestion(Base):
    """A question drafted for an assessment (AI-generated, template-drafted, or typed
    by the instructor). Exported as a printable exam plus a pre-tagged score CSV;
    students answer it outside AILAS."""
    __tablename__ = "exam_questions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(GUID(), ForeignKey("assessments.id"), nullable=False, index=True)
    competency_id = Column(GUID(), ForeignKey("competencies.id"), nullable=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String, nullable=False, default="short_answer")  # multiple_choice | short_answer | problem
    choices = Column(JSON, nullable=True)       # list[str] for multiple_choice
    answer_key = Column(Text, nullable=True)
    points = Column(Float, nullable=False, default=1.0)
    bloom_level = Column(String, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    source = Column(String, nullable=False, default="manual")  # ai | template | manual
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    competency = relationship("Competency")
