from uuid import UUID
from pydantic import BaseModel, field_validator


class GradeWeightCreate(BaseModel):
    grading_period: str
    assessment_category: str
    weight_percent: float

    @field_validator("weight_percent")
    @classmethod
    def validate_weight(cls, v):
        if not (0 < v <= 100):
            raise ValueError("weight_percent must be between 0 and 100")
        return v


class GradeWeightResponse(BaseModel):
    id: UUID
    course_id: UUID
    grading_period: str
    assessment_category: str
    weight_percent: float

    model_config = {"from_attributes": True}
