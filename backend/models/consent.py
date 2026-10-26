from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
import uuid

from backend.core.database import Base
from backend.core.types import GUID

CONSENT_VERSION = "1.0"


class PrivacyConsent(Base):
    __tablename__ = "privacy_consents"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id_hash = Column(String(64), nullable=False, index=True)
    accepted = Column(Boolean, nullable=False)
    version = Column(String(10), nullable=False, default=CONSENT_VERSION)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
