from sqlalchemy import JSON, Column, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from backend.core.database import Base
from backend.core.types import GUID


class InstitutionSetting(Base):
    """One institution-defined operational setting (see services/institution_settings.py)."""
    __tablename__ = "institution_settings"

    key = Column(String(64), primary_key=True)
    value = Column(JSON, nullable=True)
    updated_by = Column(GUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
