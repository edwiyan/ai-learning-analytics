from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class Section(Base):
    __tablename__ = "sections"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    curriculum_id = Column(GUID(), ForeignKey("curricula.id"), nullable=False)
    section_name = Column(String, nullable=False)
    year_level = Column(Integer, nullable=False)
    academic_year = Column(String, nullable=False)

    curriculum = relationship("Curriculum", back_populates="sections")
    enrollments = relationship("StudentEnrollment", back_populates="section")
