from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from backend.core.database import Base
from backend.core.types import GUID


class ResourceType(str, enum.Enum):
    video = "video"
    reading = "reading"
    exercise = "exercise"


class Resource(Base):
    __tablename__ = "resources"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    type = Column(Enum(ResourceType), nullable=False)
    url = Column(String, nullable=False)
    competency_tags = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    recommendations = relationship("Recommendation", back_populates="resource")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id_hash = Column(String, nullable=False, index=True)
    resource_id = Column(GUID(), ForeignKey("resources.id"), nullable=False)
    relevance_score = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resource = relationship("Resource", back_populates="recommendations")
