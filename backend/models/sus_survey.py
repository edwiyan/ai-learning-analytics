import uuid
from sqlalchemy import Column, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from backend.core.database import Base
from backend.core.types import GUID


class SusSurveyResponse(Base):
    __tablename__ = "sus_survey_responses"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    responses = Column(JSON, nullable=False)  # {"q1": 3, "q2": 4, ..., "q10": 2}
    sus_score = Column(Float, nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
