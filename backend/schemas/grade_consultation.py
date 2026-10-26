from datetime import datetime, date as DateType
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class GradeConsultationCreate(BaseModel):
    student_id_hash: str
    grading_period: Optional[str] = None
    conducted_at: Optional[str] = None
    academic_status: Optional[str] = None
    notes: Optional[str] = None
    next_steps: Optional[str] = None
    incomplete_reason: Optional[str] = None
    completion_deadline: Optional[str] = None
    # T5-C: advising fields
    advising_type: Optional[str] = None
    advising_content: Optional[str] = None
    retake_recommended: bool = False
    retake_notes: Optional[str] = None


class GradeConsultationResponse(BaseModel):
    id: UUID
    instructor_id: UUID
    course_id: UUID
    student_id_hash: str
    full_name: Optional[str] = None
    student_number: Optional[str] = None
    grading_period: Optional[str] = None
    conducted_at: Optional[datetime] = None
    academic_status: Optional[str] = None
    notes: Optional[str] = None
    next_steps: Optional[str] = None
    incomplete_reason: Optional[str] = None
    completion_deadline: Optional[DateType] = None
    advising_type: Optional[str] = None
    advising_content: Optional[str] = None
    retake_recommended: bool = False
    retake_notes: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}
