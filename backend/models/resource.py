from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Enum, JSON, Text, UniqueConstraint
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
    lesson = "lesson"
    link = "link"
    file = "file"


class Resource(Base):
    __tablename__ = "resources"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    type = Column(Enum(ResourceType), nullable=False)
    url = Column(String, nullable=False)
    competency_tags = Column(JSON)
    description = Column(Text, nullable=True)
    # Uploaded learning material (PDF, PPT, DOCX, ...); url then points at the download endpoint.
    file_path = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    # NULL = shared repository resource; set = an instructor's custom resource for one course.
    course_id = Column(GUID(), ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True)
    created_by = Column(GUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    source = Column(String, nullable=False, default="repository", server_default="repository")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    recommendations = relationship("Recommendation", back_populates="resource")


class CourseResourceStatus(str, enum.Enum):
    suggested = "suggested"
    accepted = "accepted"
    declined = "declined"


class CourseResource(Base):
    """A resource put forward for one course competency, by the AI suggester or by the
    instructor, and the instructor's accept / decline decision on it."""
    __tablename__ = "course_resources"
    __table_args__ = (UniqueConstraint("course_id", "resource_id", "competency_id", name="uq_course_resource_competency"),)

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    course_id = Column(GUID(), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_id = Column(GUID(), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    competency_id = Column(GUID(), ForeignKey("competencies.id", ondelete="CASCADE"), nullable=True)
    status = Column(String, nullable=False, default=CourseResourceStatus.suggested.value)
    source = Column(String, nullable=False, default="ai")  # "ai" | "instructor"
    score = Column(Float, nullable=True)
    reason = Column(Text, nullable=True)
    decided_by = Column(GUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resource = relationship("Resource")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id_hash = Column(String, nullable=False, index=True)
    resource_id = Column(GUID(), ForeignKey("resources.id"), nullable=False)
    relevance_score = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resource = relationship("Resource", back_populates="recommendations")
