from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class Curriculum(Base):
    __tablename__ = "curricula"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    program_id = Column(GUID(), ForeignKey("programs.id"), nullable=False)
    name = Column(String, nullable=False)
    ched_cmo_reference = Column(String, nullable=True)
    effective_year = Column(Integer, nullable=False)
    total_units = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="active")

    program = relationship("Program", back_populates="curricula")
    subjects = relationship("CurriculumSubject", back_populates="curriculum")
    sections = relationship("Section", back_populates="curriculum")
    enrollments = relationship("StudentEnrollment", back_populates="curriculum")
