from sqlalchemy import Column, ForeignKey, Float, String, Integer, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class TableOfSpecifications(Base):
    __tablename__ = "table_of_specifications"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(GUID(), ForeignKey("assessments.id"), nullable=False)
    competency_id = Column(GUID(), ForeignKey("competencies.id"), nullable=False)
    bloom_level = Column(String, nullable=True)
    item_count = Column(Integer, nullable=False, default=0)
    weight_percent = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assessment = relationship("Assessment", back_populates="tos_entries")
    competency = relationship("Competency")
