import uuid
from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.sql import func

from backend.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), index=True)
    action = Column(String, nullable=False, index=True)
    target_table = Column(String)
    target_id = Column(String)
    extra_data = Column(JSON)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
