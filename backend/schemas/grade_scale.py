from uuid import UUID
from pydantic import BaseModel


class GradeScaleResponse(BaseModel):
    id: UUID
    min_percent: float
    max_percent: float
    letter_grade: str
    grade_points: float
    description: str | None = None

    model_config = {"from_attributes": True}
