from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Enum, JSON
from sqlalchemy.sql import func
import uuid
import enum

from backend.core.database import Base
from backend.core.types import GUID


class RiskLevel(str, enum.Enum):
    at_risk = "At-Risk"
    on_track = "On-Track"
    excelling = "Excelling"


class RiskPrediction(Base):
    __tablename__ = "risk_predictions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id_hash = Column(String, nullable=False, index=True)
    course_id = Column(GUID(), ForeignKey("courses.id"), nullable=False)
    grading_period = Column(String, nullable=False)
    risk_level = Column(Enum(RiskLevel), nullable=False)
    confidence = Column(Float)
    weak_competencies = Column(JSON)
    predicted_at = Column(DateTime(timezone=True), server_default=func.now())
