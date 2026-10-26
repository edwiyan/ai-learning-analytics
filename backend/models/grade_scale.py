from sqlalchemy import Column, String, Float
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class GradeScale(Base):
    __tablename__ = "grade_scales"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    min_percent = Column(Float, nullable=False)
    max_percent = Column(Float, nullable=False)
    letter_grade = Column(String, nullable=False)
    grade_points = Column(Float, nullable=False)
    description = Column(String, nullable=True)
