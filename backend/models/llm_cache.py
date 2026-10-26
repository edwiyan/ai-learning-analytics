from sqlalchemy import Column, String, DateTime, Text, Integer
from sqlalchemy.sql import func
import uuid

from backend.core.database import Base
from backend.core.types import GUID


class LLMCache(Base):
    """Deterministic response cache for LLM calls (capstone §3.9.2 Inconsistent
    Output row): an identical prompt returns the stored answer instead of a new,
    possibly different, completion."""
    __tablename__ = "llm_cache"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    cache_key = Column(String(64), nullable=False, unique=True, index=True)
    purpose = Column(String(50), nullable=True)
    model = Column(String(100), nullable=False)
    provider = Column(String(20), nullable=False)
    response = Column(Text, nullable=False)
    hit_count = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_hit_at = Column(DateTime(timezone=True), nullable=True)
