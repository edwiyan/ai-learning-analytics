from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.sql import func
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class CompetencyMastery(Base):
    """Pre-aggregated per-student, per-competency mastery (capstone Table 9).

    Stores the computed mastery_percentage, the mastery_level label
    (Proficient / Developing / Emerging), and an automated risk_flag
    (True when the competency is in the Emerging band — a learning gap).
    """

    __tablename__ = "competency_mastery"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id_hash = Column(String, nullable=False, index=True)
    course_id = Column(GUID(), ForeignKey("courses.id"), nullable=False)
    competency_id = Column(GUID(), ForeignKey("competencies.id"), nullable=False)
    mastery_percentage = Column(Float, nullable=False)
    mastery_level = Column(String, nullable=False)  # Proficient | Developing | Emerging
    risk_flag = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
