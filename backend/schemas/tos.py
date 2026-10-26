from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator


class TosCreate(BaseModel):
    competency_id: UUID
    bloom_level: Optional[str] = None
    item_count: int = 0
    weight_percent: float = 0.0

    @field_validator("weight_percent")
    @classmethod
    def validate_weight(cls, v):
        if v < 0 or v > 100:
            raise ValueError("weight_percent must be between 0 and 100")
        return v


class TosResponse(BaseModel):
    id: UUID
    assessment_id: UUID
    competency_id: UUID
    bloom_level: Optional[str] = None
    item_count: int
    weight_percent: float
    competency_code: Optional[str] = None
    topic_name: Optional[str] = None

    model_config = {"from_attributes": True}
