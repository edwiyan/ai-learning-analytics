import io
import re
import secrets
import string

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from backend.core.audit import log_action
from backend.core.database import get_db
from backend.core.deps import get_current_user, require_role
from backend.core.security import hash_password, verify_password
from backend.models.user import User, UserRole
from backend.schemas.user import UserCreate, UserUpdate, UserResponse, BulkImportResult

router = APIRouter(prefix="/users", tags=["users"])

admin_only = require_role(UserRole.admin)
admin_or_instructor = require_role(UserRole.admin, UserRole.instructor)

EXCEL_REQUIRED = {"student_number", "full_name", "email"}
EXCEL_OPTIONAL = {"year_level", "program", "section", "password"}


def _random_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(chars) for _ in range(length))


# ── List endpoints ────────────────────────────────────────────────────────────

@router.get("/", response_model=list[UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return db.query(User).offset(skip).limit(limit).all()


@router.get("/students", response_model=list[UserResponse])
def list_students(
    year_level: str = Query(None),
    program: str = Query(None),
    section: str = Query(None),
    search: str = Query(None),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_instructor),
):
    q = db.query(User).filter(User.role == UserRole.student)
    if year_level:
        q = q.filter(User.year_level == year_level)
    if program:
        q = q.filter(User.program == program)
    if section:
        q = q.filter(User.section == section)
    if search:
        like = f"%{search}%"
        q = q.filter(
            User.full_name.ilike(like) |
            User.email.ilike(like) |
            User.student_number.ilike(like)
        )
    return q.offset(skip).limit(limit).all()


@router.get("/instructors", response_model=list[UserResponse])
def list_instructors(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return db.query(User).filter(User.role == UserRole.instructor).all()


@router.get("/admins", response_model=list[UserResponse])
def list_admins(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return db.query(User).filter(User.role == UserRole.admin).all()


@router.get("/program-directors", response_model=list[UserResponse])
def list_program_directors(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return db.query(User).filter(User.role == UserRole.program_director).all()


@router.get("/deans", response_model=list[UserResponse])
def list_deans(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return db.query(User).filter(User.role == UserRole.dean).all()


@router.get("/vp-academic-affairs", response_model=list[UserResponse])
def list_vps(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return db.query(User).filter(User.role == UserRole.vp_academic_affairs).all()


# ── Create / update / deactivate ─────────────────────────────────────────────

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_instructor),
):
    # Instructors may only create student accounts
    if current_user.role == UserRole.instructor and payload.role != UserRole.student:
        raise HTTPException(status_code=403, detail="Instructors can only create student accounts")

    # Students must carry a student_number so the SHA-256 hashed_identifier
    # (capstone §3.4 / RA 10173 pseudonymization) is always populated.
    if payload.role == UserRole.student and not (payload.student_number or "").strip():
        raise HTTPException(status_code=400, detail="student_number is required for student accounts")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=re.sub(r'<[^>]+>', '', payload.full_name),
        role=payload.role,
        college=payload.college if payload.role != UserRole.student else None,
        student_number=payload.student_number if payload.role == UserRole.student else None,
        year_level=payload.year_level if payload.role == UserRole.student else None,
        program=payload.program if payload.role == UserRole.student else None,
        section=payload.section if payload.role == UserRole.student else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, str(current_user.id), "create_user", target_table="users",
               target_id=str(user.id), extra={"email": user.email, "role": str(user.role)})
    return user


@router.post("/bulk-import", response_model=BulkImportResult, status_code=status.HTTP_201_CREATED)
async def bulk_import_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_instructor),
):
    filename = (file.filename or "").lower()
    if not (filename.endswith(".xlsx") or filename.endswith(".csv")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .csv files are accepted")

    file_bytes = await file.read()
    try:
        if filename.endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl", dtype=str)
        else:
            df = pd.read_csv(io.BytesIO(file_bytes), dtype=str)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not read file: {exc}")

    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
    missing_cols = EXCEL_REQUIRED - set(df.columns)
    if missing_cols:
        raise HTTPException(status_code=422, detail=f"Missing required columns: {', '.join(missing_cols)}")

    df = df.where(pd.notna(df), None)

    created, skipped = 0, 0
    errors: list[str] = []

    for idx, row in df.iterrows():
        row_num = idx + 2  # Excel row number (1-indexed + header)
        email = str(row.get("email") or "").strip()
        full_name = re.sub(r'<[^>]+>', '', str(row.get("full_name") or "")).strip()
        student_number = str(row.get("student_number") or "").strip()

        if not email or not full_name or not student_number:
            errors.append(f"Row {row_num}: missing required value (email, full_name, or student_number)")
            skipped += 1
            continue

        if db.query(User).filter(User.email == email).first():
            errors.append(f"Row {row_num}: email '{email}' already exists — skipped")
            skipped += 1
            continue

        password = str(row.get("password") or "").strip() or student_number
        user = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            role=UserRole.student,
            student_number=student_number,
            year_level=str(row.get("year_level") or "").strip() or None,
            program=str(row.get("program") or "").strip() or None,
            section=str(row.get("section") or "").strip() or None,
        )
        db.add(user)
        created += 1

    db.commit()
    log_action(db, str(current_user.id), "bulk_import_students",
               extra={"created": created, "skipped": skipped, "file": file.filename})
    return BulkImportResult(created=created, skipped=skipped, errors=errors)


@router.put("/me/password", status_code=200)
def change_own_password(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.get("current_password", ""), current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    new_pw = payload.get("new_password", "")
    if len(new_pw) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    current_user.password_hash = hash_password(new_pw)
    db.commit()
    return {"status": "ok"}


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.model_dump(exclude_none=True)

    if "email" in data and data["email"] != user.email:
        if db.query(User).filter(User.email == data["email"]).first():
            raise HTTPException(status_code=400, detail="Email already in use")

    if "new_password" in data:
        if len(data["new_password"]) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        user.password_hash = hash_password(data.pop("new_password"))
    else:
        data.pop("new_password", None)

    for field, value in data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    log_action(db, str(current_user.id), "update_user", target_table="users",
               target_id=str(user.id), extra={"fields": list(data.keys())})
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    log_action(db, str(current_user.id), "deactivate_user",
               target_table="users", target_id=str(user.id))
