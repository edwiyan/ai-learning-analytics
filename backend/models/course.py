from sqlalchemy import Column, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class Course(Base):
    __tablename__ = "courses"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    code = Column(String, nullable=False)
    academic_period = Column(String, nullable=False)
    instructor_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    curriculum_subject_id = Column(GUID(), ForeignKey("curriculum_subjects.id"), nullable=True)
    section_id = Column(GUID(), ForeignKey("sections.id"), nullable=True)
    passing_grade = Column(Float, nullable=False, default=75.0, server_default="75.0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    instructor = relationship("User", back_populates="courses", foreign_keys=[instructor_id])
    syllabi = relationship("Syllabus", back_populates="course")
    assessments = relationship("Assessment", back_populates="course")
    grade_weights = relationship("GradeWeight", back_populates="course", cascade="all, delete-orphan")
