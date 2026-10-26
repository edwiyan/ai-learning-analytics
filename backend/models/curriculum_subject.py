from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class CurriculumSubject(Base):
    __tablename__ = "curriculum_subjects"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    curriculum_id = Column(GUID(), ForeignKey("curricula.id"), nullable=False)
    subject_code = Column(String, nullable=False)
    title = Column(String, nullable=False)
    units = Column(Integer, nullable=False)
    year_level = Column(Integer, nullable=False)
    semester = Column(Integer, nullable=False)
    prerequisite_subject_id = Column(GUID(), ForeignKey("curriculum_subjects.id"), nullable=True)

    curriculum = relationship("Curriculum", back_populates="subjects")
    prerequisite = relationship(
        "CurriculumSubject",
        foreign_keys=[prerequisite_subject_id],
        remote_side=[id],
        uselist=False,
    )
