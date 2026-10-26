from uuid import UUID
from typing import Optional
from pydantic import BaseModel, EmailStr
from backend.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole
    college: Optional[str] = None
    student_number: Optional[str] = None
    year_level: Optional[str] = None
    program: Optional[str] = None
    section: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    college: Optional[str] = None
    year_level: Optional[str] = None
    program: Optional[str] = None
    section: Optional[str] = None
    new_password: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    college: Optional[str] = None
    is_active: bool
    student_number: Optional[str] = None
    year_level: Optional[str] = None
    program: Optional[str] = None
    section: Optional[str] = None

    model_config = {"from_attributes": True}


class BulkImportResult(BaseModel):
    created: int
    skipped: int
    errors: list[str]
