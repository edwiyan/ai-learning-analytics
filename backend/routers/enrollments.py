import csv
import io
import re
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.deps import require_role
from backend.core.email import send_enrollment_welcome
from backend.core.security import hash_student_id, hash_password, generate_otp_password
from backend.models.user import User, UserRole
from backend.models.enrollment import StudentEnrollment
from backend.models.section import Section
from backend.models.curriculum import Curriculum
from backend.schemas.curriculum import (
    AddCurriculumPayload,
    BulkAddCurriculumPayload,
    StudentEnrollmentCreate,
    StudentEnrollmentResponse,
)

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_student_number(db: Session) -> str:
    """Return next sequential student number (numeric max + 1)."""
    numbers = [
        int(u.student_number)
        for u in db.query(User).filter(User.student_number.isnot(None)).all()
        if u.student_number and u.student_number.isdigit()
    ]
    return str(max(numbers) + 1) if numbers else f"{datetime.now().year}000001"


def _ensure_student_account(
    db: Session,
    student_number: str | None,
    full_name: str,
    email: str,
) -> tuple[User, str | None]:
    """
    Return (user, plain_password).
    - If student_number is blank/None, auto-generate one (T11 new-student mode).
    - plain_password is None when the account already existed (no email needed).
    """
    if not student_number:
        student_number = _generate_student_number(db)

    existing = db.query(User).filter(User.student_number == student_number).first()
    if existing:
        return existing, None

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail=f"Email '{email}' is already registered to another user.")

    plain_pw = generate_otp_password()
    user = User(
        email=email,
        full_name=re.sub(r"<[^>]+>", "", full_name),
        student_number=student_number,
        role=UserRole.student,
        password_hash=hash_password(plain_pw),
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user, plain_pw


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/", response_model=StudentEnrollmentResponse, status_code=status.HTTP_201_CREATED)
def enroll_student(
    payload: StudentEnrollmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.instructor)),
):
    data = payload.model_dump()
    # empty string → None so _ensure_student_account auto-generates (T9/T11)
    student_number = data.pop("student_number") or None
    student_name = data.pop("student_name")
    email = data.pop("email")

    user, plain_pw = _ensure_student_account(db, student_number, student_name, email)
    data["student_id_hash"] = hash_student_id(user.student_number)

    enrollment = StudentEnrollment(**data)
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    if plain_pw is not None:
        section = db.query(Section).filter(Section.id == enrollment.section_id).first()
        curriculum = db.query(Curriculum).filter(Curriculum.id == enrollment.curriculum_id).first()
        background_tasks.add_task(
            send_enrollment_welcome,
            student_name=student_name,
            student_number=user.student_number,
            student_email=email,
            section_name=section.section_name if section else "—",
            curriculum_name=curriculum.name if curriculum else "—",
            password=plain_pw,
        )

    response = StudentEnrollmentResponse.model_validate(enrollment)
    response.student_number = user.student_number
    response.student_name = user.full_name
    return response


@router.post("/add-curriculum", response_model=StudentEnrollmentResponse, status_code=status.HTTP_201_CREATED)
def add_curriculum(
    payload: AddCurriculumPayload,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.instructor)),
):
    """Enroll an already-existing student in an additional curriculum (T6/T7)."""
    enrollment = StudentEnrollment(**payload.model_dump())
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    # Resolve student_number and name from hash for the response
    students = db.query(User).filter(User.student_number.isnot(None)).all()
    matched = next(
        (u for u in students if hash_student_id(u.student_number) == enrollment.student_id_hash),
        None,
    )
    response = StudentEnrollmentResponse.model_validate(enrollment)
    if matched:
        response.student_number = matched.student_number
        response.student_name = matched.full_name
    return response


@router.post("/bulk-add-curriculum", status_code=status.HTTP_200_OK)
def bulk_add_curriculum(
    payload: BulkAddCurriculumPayload,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.instructor)),
):
    """Bulk-enroll a list of existing students in a new curriculum, each keeping their source section."""
    added = 0
    skipped = 0
    for item in payload.students:
        already = db.query(StudentEnrollment).filter(
            StudentEnrollment.student_id_hash == item.student_id_hash,
            StudentEnrollment.curriculum_id == payload.curriculum_id,
        ).first()
        if already:
            skipped += 1
            continue
        db.add(StudentEnrollment(
            student_id_hash=item.student_id_hash,
            section_id=item.section_id,
            curriculum_id=payload.curriculum_id,
            status=payload.status,
        ))
        added += 1
    db.commit()
    return {"added": added, "skipped": skipped}


@router.get("/", response_model=list[StudentEnrollmentResponse])
def list_enrollments(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.instructor)),
):
    students = db.query(User).filter(User.student_number.isnot(None)).all()
    hash_map = {hash_student_id(u.student_number): u for u in students}

    result = []
    for e in db.query(StudentEnrollment).order_by(StudentEnrollment.enrollment_date.asc()).all():
        row = StudentEnrollmentResponse.model_validate(e)
        matched = hash_map.get(e.student_id_hash)
        row.student_number = matched.student_number if matched else None
        row.student_name = matched.full_name if matched else None
        result.append(row)
    return result


@router.delete("/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def unenroll_student(
    enrollment_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.instructor)),
):
    enrollment = db.query(StudentEnrollment).filter(StudentEnrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    db.delete(enrollment)
    db.commit()


@router.post("/bulk-csv", status_code=status.HTTP_201_CREATED)
def bulk_enroll_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    """
    Bulk-enroll students via CSV.

    Migration mode  (CSV has student_number column): student_number required per row.
    New-student mode (no student_number column):      system auto-assigns student numbers.

    Required in both modes: student_name, email, section_name, curriculum_name.
    Optional: status (defaults to 'active').
    Creates a student account when one does not already exist (T3).
    Existing accounts are skipped — just a new enrollment is added (T7 multi-curriculum).
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = file.file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    fieldnames = set(reader.fieldnames or [])

    # T10: detect migration vs new-student mode from presence of student_number column
    is_migration = "student_number" in fieldnames

    base_required = {"student_name", "email", "section_name", "curriculum_name"}
    if not base_required.issubset(fieldnames):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain columns: {', '.join(sorted(base_required))}",
        )

    rows = list(reader)
    errors: list[str] = []
    enrolled = 0
    accounts_created = 0

    for i, row in enumerate(rows, start=2):
        student_number = row.get("student_number", "").strip() if is_migration else None
        student_name = row.get("student_name", "").strip()
        email = row.get("email", "").strip()
        section_name = row.get("section_name", "").strip()
        curriculum_name = row.get("curriculum_name", "").strip()
        row_status = row.get("status", "active").strip() or "active"

        if is_migration and not student_number:
            errors.append(f"Row {i}: student_number is required in migration mode")
            continue
        if not all([student_name, email, section_name, curriculum_name]):
            errors.append(f"Row {i}: missing required value")
            continue

        section = db.query(Section).filter(Section.section_name == section_name).first()
        if not section:
            errors.append(f"Row {i}: section '{section_name}' not found")
            continue

        curriculum = db.query(Curriculum).filter(Curriculum.name == curriculum_name).first()
        if not curriculum:
            errors.append(f"Row {i}: curriculum '{curriculum_name}' not found")
            continue

        user, plain_pw = _ensure_student_account(db, student_number, student_name, email)
        if plain_pw is not None:
            accounts_created += 1
            background_tasks.add_task(
                send_enrollment_welcome,
                student_name=student_name,
                student_number=user.student_number,
                student_email=email,
                section_name=section_name,
                curriculum_name=curriculum_name,
                password=plain_pw,
            )

        enrollment = StudentEnrollment(
            student_id_hash=hash_student_id(user.student_number),
            section_id=section.id,
            curriculum_id=curriculum.id,
            status=row_status,
        )
        db.add(enrollment)
        enrolled += 1

    db.commit()
    return {"enrolled": enrolled, "accounts_created": accounts_created, "errors": errors}
