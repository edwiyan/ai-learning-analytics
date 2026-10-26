from uuid import UUID
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from backend.models.assessment import GradingPeriod


class GradeSubmissionCreate(BaseModel):
    course_id: UUID
    grading_period: GradingPeriod
    notes: Optional[str] = None


class GradeSubmissionResponse(BaseModel):
    id: UUID
    course_id: UUID
    instructor_id: UUID
    grading_period: str
    status: str
    notes: Optional[str] = None
    submitted_at: Optional[datetime] = None
    posted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class GradeSubmissionApprovalCreate(BaseModel):
    feedback: Optional[str] = None


class GradeSubmissionApprovalResponse(BaseModel):
    id: UUID
    submission_id: UUID
    approver_id: UUID
    role: str
    status: str
    feedback: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
