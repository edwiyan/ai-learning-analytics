from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class StudentEnrollment(Base):
    __tablename__ = "student_enrollments"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id_hash = Column(String(64), nullable=False)
    section_id = Column(GUID(), ForeignKey("sections.id"), nullable=False)
    curriculum_id = Column(GUID(), ForeignKey("curricula.id"), nullable=False)
    enrollment_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, nullable=False, default="active")

    section = relationship("Section", back_populates="enrollments")
    curriculum = relationship("Curriculum", back_populates="enrollments")
