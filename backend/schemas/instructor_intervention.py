from datetime import datetime, date as DateType
from typing import Literal, Optional
from uuid import UUID
from pydantic import BaseModel


class InterventionCreate(BaseModel):
    student_id_hash: str
    action_type: str = "flag"
    intervention_type: Optional[str] = None
    note: Optional[str] = None
    # T4-B: Improvement plan fields
    goal_description: Optional[str] = None
    target_score: Optional[float] = None
    target_period: Optional[str] = None
    follow_up_date: Optional[str] = None  # ISO date "YYYY-MM-DD"


class InterventionStatusUpdate(BaseModel):
    status: Literal["open", "in_progress", "resolved"]


class InterventionOut(BaseModel):
    id: UUID
    instructor_id: UUID
    course_id: UUID
    student_id_hash: str
    action_type: str
    intervention_type: Optional[str] = None
    note: Optional[str] = None
    # T4-B: Improvement plan fields
    goal_description: Optional[str] = None
    target_score: Optional[float] = None
    target_period: Optional[str] = None
    follow_up_date: Optional[DateType] = None
    plan_accepted_by_student: bool = False
    ai_feedback: Optional[str] = None
    status: str = "open"
    status_updated_at: Optional[datetime] = None
    created_at: datetime
    model_config = {"from_attributes": True}
