from datetime import date as DateType
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel


class AttendanceCreate(BaseModel):
    student_id_hash: str
    status: str  # "present" | "absent" | "late" | "excused"
    notes: Optional[str] = None


class AttendanceBulkCreate(BaseModel):
    date: str  # "YYYY-MM-DD"
    records: List[AttendanceCreate]


class AttendanceResponse(BaseModel):
    id: UUID
    student_id_hash: str
    course_id: UUID
    date: DateType
    status: str
    notes: Optional[str] = None
    model_config = {"from_attributes": True}


class AttendanceSummaryItem(BaseModel):
    student_id_hash: str
    full_name: Optional[str] = None
    student_number: Optional[str] = None
    total_sessions: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    absence_rate: float
