from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), nullable=False, index=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    related_id = Column(String, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
