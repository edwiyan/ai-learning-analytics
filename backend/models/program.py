from sqlalchemy import Column, String, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy import DateTime
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class Program(Base):
    __tablename__ = "programs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    program_name = Column(String, nullable=False)
    degree_type = Column(String, nullable=False)
    ched_cmo_reference = Column(String, nullable=True)
    total_units = Column(Integer, nullable=False, default=0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    curricula = relationship("Curriculum", back_populates="program", cascade="all, delete-orphan")
