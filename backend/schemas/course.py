from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class CourseCreate(BaseModel):
    title: str
    code: str
    academic_period: str
    curriculum_subject_id: Optional[UUID] = None
    section_id: Optional[UUID] = None


class CourseResponse(BaseModel):
    id: UUID
    title: str
    code: str
    academic_period: str
    instructor_id: UUID
    curriculum_subject_id: Optional[UUID] = None
    section_id: Optional[UUID] = None
    passing_grade: float = 75.0

    model_config = {"from_attributes": True}
