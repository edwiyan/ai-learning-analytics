from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, field_validator


class ProgramCreate(BaseModel):
    program_name: str
    degree_type: str
    ched_cmo_reference: Optional[str] = None
    total_units: int
    description: Optional[str] = None
    program_outcomes: list[str] = []


class ProgramResponse(BaseModel):
    id: UUID
    program_name: str
    degree_type: str
    ched_cmo_reference: Optional[str]
    total_units: int
    description: Optional[str]
    program_outcomes: list[str] = []

    @field_validator("program_outcomes", mode="before")
    @classmethod
    def _none_to_list(cls, v):
        return v or []

    model_config = {"from_attributes": True}


class CurriculumCreate(BaseModel):
    program_id: UUID
    name: str
    ched_cmo_reference: Optional[str] = None
    effective_year: int
    total_units: int
    status: str = "active"


class CurriculumResponse(BaseModel):
    id: UUID
    program_id: UUID
    name: str
    ched_cmo_reference: Optional[str]
    effective_year: int
    total_units: int
    status: str

    model_config = {"from_attributes": True}


class CurriculumSubjectCreate(BaseModel):
    subject_code: str
    title: str
    units: int
    year_level: int
    semester: int
    prerequisite_subject_id: Optional[UUID] = None


class CurriculumSubjectResponse(BaseModel):
    id: UUID
    curriculum_id: UUID
    subject_code: str
    title: str
    units: int
    year_level: int
    semester: int
    prerequisite_subject_id: Optional[UUID]

    model_config = {"from_attributes": True}


class SectionCreate(BaseModel):
    curriculum_id: UUID
    section_name: str
    year_level: int
    academic_year: str


class SectionResponse(BaseModel):
    id: UUID
    curriculum_id: UUID
    section_name: str
    year_level: int
    academic_year: str

    model_config = {"from_attributes": True}


class StudentEnrollmentCreate(BaseModel):
    student_number: str = ""   # empty = new student, backend auto-assigns
    student_name: str
    email: str
    section_id: UUID
    curriculum_id: UUID
    status: str = "active"


class AddCurriculumPayload(BaseModel):
    student_id_hash: str
    section_id: UUID
    curriculum_id: UUID
    status: str = "active"


class StudentHashSection(BaseModel):
    student_id_hash: str
    section_id: UUID


class BulkAddCurriculumPayload(BaseModel):
    students: list[StudentHashSection]
    curriculum_id: UUID
    status: str = "active"


class StudentEnrollmentResponse(BaseModel):
    id: UUID
    student_id_hash: str
    student_number: str | None = None
    student_name: str | None = None
    enrollment_date: datetime | None = None
    section_id: UUID
    curriculum_id: UUID
    status: str

    model_config = {"from_attributes": True}
