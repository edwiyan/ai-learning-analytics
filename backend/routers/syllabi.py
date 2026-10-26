import os
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from backend.core.limiter import limiter

from backend.core.audit import log_action
from backend.core.ingestion import record_ingestion
from backend.core.database import get_db
from backend.core.deps import get_current_user, require_role
from backend.core.notifications import notify, notify_roles
from backend.models.user import User, UserRole, COLLEGE_SCOPED_ROLES
from backend.models.course import Course
from backend.models.syllabus import Syllabus, SyllabusStatus, Competency, SyllabusApproval, ApprovalStage
from backend.schemas.syllabus import CustomCompetencyCreate, SyllabusResponse, SyllabusWithCourseResponse, SyllabusValidateRequest, SyllabusApprovalCreate, SyllabusApprovalResponse
from backend.services.ocr.extractor import extract_text
from backend.services.ai.syllabus_parser import parse_syllabus

# Maps each approver role to: the stage they act on → the next stage after approval
APPROVAL_CHAIN = {
    UserRole.program_director: (ApprovalStage.pending_pd, ApprovalStage.pending_dean),
    UserRole.dean:             (ApprovalStage.pending_dean, ApprovalStage.pending_vp),
    UserRole.vp_academic_affairs: (ApprovalStage.pending_vp, ApprovalStage.fully_approved),
}

APPROVER_ROLES = {UserRole.program_director, UserRole.dean, UserRole.vp_academic_affairs}

router = APIRouter(prefix="/syllabi", tags=["syllabi"])

UPLOAD_DIR = "uploads/syllabi"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def _assert_course_access(course: Course, current_user: User):
    """Raise 403 if instructor does not own this course."""
    if current_user.role == UserRole.admin:
        return
    if str(course.instructor_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course")


@router.post("/upload", response_model=SyllabusResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def upload_syllabus(
    request: Request,
    course_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    _assert_course_access(course, current_user)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if file.content_type not in ALLOWED_MIME_TYPES or ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are allowed")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    file_path = f"{UPLOAD_DIR}/{course_id}_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    started = time.perf_counter()
    try:
        raw_text = extract_text(file_bytes, file.filename)
    except ValueError as exc:
        record_ingestion(db, str(current_user.id), "syllabus", False,
                         (time.perf_counter() - started) * 1000, file.filename, error=str(exc)[:200])
        raise HTTPException(status_code=422, detail=str(exc))
    extract_ms = (time.perf_counter() - started) * 1000

    if not raw_text.strip():
        record_ingestion(db, str(current_user.id), "syllabus", False, extract_ms, file.filename,
                         error="no extractable text")
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted from this file. Make sure it is a text-based PDF or DOCX (not a scanned image)."
        )

    parse_started = time.perf_counter()
    parsed = parse_syllabus(raw_text)
    parse_ms = (time.perf_counter() - parse_started) * 1000
    competency_count = len(parsed.get("competencies", []))

    syllabus = Syllabus(
        course_id=course_id,
        file_path=file_path,
        raw_text=raw_text,
        parsed_json=parsed,
        status=SyllabusStatus.pending,
    )
    db.add(syllabus)
    db.flush()

    for comp in parsed.get("competencies", []):
        competency = Competency(
            syllabus_id=syllabus.id,
            competency_code=comp.get("competency_code", ""),
            topic_name=comp.get("topic_name", ""),
            learning_outcomes=comp.get("learning_outcomes", []),
            bloom_level=comp.get("bloom_level"),
        )
        db.add(competency)

    db.commit()
    db.refresh(syllabus)
    log_action(db, str(current_user.id), "upload_syllabus", target_table="syllabi",
               target_id=str(syllabus.id), extra={"course_id": course_id, "filename": file.filename})
    record_ingestion(db, str(current_user.id), "syllabus", competency_count > 0,
                     (time.perf_counter() - started) * 1000, file.filename,
                     extract_ms=round(extract_ms, 1), parse_ms=round(parse_ms, 1),
                     competencies=competency_count)
    return syllabus


@router.get("/courses/{course_id}/competencies")
def get_course_competencies(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from backend.models.syllabus import SyllabusStatus
    syllabus = (
        db.query(Syllabus)
        .filter(Syllabus.course_id == course_id, Syllabus.status == SyllabusStatus.validated)
        .first()
    )
    if not syllabus:
        return []
    comps = db.query(Competency).filter(Competency.syllabus_id == syllabus.id).all()
    return [
        {"id": str(c.id), "competency_code": c.competency_code, "topic_name": c.topic_name,
         "source": c.source}
        for c in comps
    ]


@router.post("/courses/{course_id}/competencies", status_code=status.HTTP_201_CREATED)
def create_custom_competency(
    course_id: uuid.UUID,
    payload: CustomCompetencyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    """Create a custom topic tag on the course's validated syllabus, for questions
    no syllabus competency fits (capstone §3.6.2 Faculty Override UI)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    _assert_course_access(course, current_user)

    syllabus = (
        db.query(Syllabus)
        .filter(Syllabus.course_id == course_id, Syllabus.status == SyllabusStatus.validated)
        .first()
    )
    if not syllabus:
        raise HTTPException(status_code=422, detail="This course has no validated syllabus to add a tag to")

    existing = {c.competency_code.strip().upper() for c in syllabus.competencies}
    code = (payload.competency_code or "").strip().upper()
    if code:
        if code in existing:
            raise HTTPException(status_code=409, detail=f"Competency code {code} already exists")
    else:
        n = 1
        while f"FAC-{n:02d}" in existing:
            n += 1
        code = f"FAC-{n:02d}"

    topic = payload.topic_name.strip()
    competency = Competency(
        syllabus_id=syllabus.id,
        competency_code=code,
        topic_name=topic,
        learning_outcomes=[payload.learning_outcome.strip()] if payload.learning_outcome else [topic],
        source="faculty",
    )
    db.add(competency)
    db.commit()
    db.refresh(competency)
    log_action(db, str(current_user.id), "create_custom_competency", target_table="competencies",
               target_id=str(competency.id), extra={"course_id": str(course_id), "code": code})
    return {"id": str(competency.id), "competency_code": competency.competency_code,
            "topic_name": competency.topic_name, "source": competency.source}


@router.get("/pending-approval", response_model=list[SyllabusResponse])
def get_pending_approval(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in APPROVER_ROLES:
        raise HTTPException(status_code=403, detail="Only approvers can view the approval queue")
    required_stage, _ = APPROVAL_CHAIN[current_user.role]

    # VP sees all colleges; PD and Dean see only their own college
    if current_user.role == UserRole.vp_academic_affairs:
        return db.query(Syllabus).filter(Syllabus.approval_stage == required_stage).all()

    if not current_user.college:
        raise HTTPException(
            status_code=403,
            detail="Your account has no college assigned. Contact an administrator."
        )

    return (
        db.query(Syllabus)
        .join(Course, Syllabus.course_id == Course.id)
        .join(User, Course.instructor_id == User.id)
        .filter(
            Syllabus.approval_stage == required_stage,
            User.college == current_user.college,
        )
        .all()
    )


@router.get("/mine", response_model=list[SyllabusWithCourseResponse])
def get_my_syllabi(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    """All syllabi belonging to the current instructor's courses, with course info embedded."""
    rows = (
        db.query(Syllabus, Course)
        .join(Course, Syllabus.course_id == Course.id)
        .filter(Course.instructor_id == current_user.id)
        .all()
    )
    results = []
    for syllabus, course in rows:
        comps = [
            {"id": str(c.id), "competency_code": c.competency_code, "topic_name": c.topic_name, "learning_outcomes": c.learning_outcomes or []}
            for c in syllabus.competencies
        ]
        results.append({
            "id": syllabus.id,
            "course_id": syllabus.course_id,
            "status": syllabus.status.value if hasattr(syllabus.status, "value") else str(syllabus.status),
            "approval_stage": syllabus.approval_stage.value if hasattr(syllabus.approval_stage, "value") else str(syllabus.approval_stage),
            "parsed_json": syllabus.parsed_json,
            "competencies": comps,
            "course_title": course.title,
            "course_code": course.code,
            "course_academic_period": course.academic_period,
        })
    return results


@router.get("/by-course/{course_id}", response_model=SyllabusResponse)
def get_syllabus_by_course(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the most recent syllabus for a course (used to restore instructor session)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    _assert_course_access(course, current_user)
    syllabus = db.query(Syllabus).filter(Syllabus.course_id == course_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="No syllabus for this course")
    return syllabus


@router.get("/{syllabus_id}", response_model=SyllabusResponse)
def get_syllabus(
    syllabus_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.instructor, UserRole.admin,
        UserRole.program_director, UserRole.dean, UserRole.vp_academic_affairs,
    )),
):
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    return syllabus


@router.get("/{syllabus_id}/approval-history", response_model=list[SyllabusApprovalResponse])
def get_approval_history(
    syllabus_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    return db.query(SyllabusApproval).filter(SyllabusApproval.syllabus_id == syllabus_id).order_by(SyllabusApproval.reviewed_at).all()


@router.post("/{syllabus_id}/submit-for-review", response_model=SyllabusResponse)
def submit_for_review(
    syllabus_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    if syllabus.approval_stage not in (ApprovalStage.draft, ApprovalStage.rejected):
        raise HTTPException(status_code=400, detail=f"Cannot submit from stage '{syllabus.approval_stage}'")
    course = db.query(Course).filter(Course.id == syllabus.course_id).first()
    if course:
        _assert_course_access(course, current_user)
    syllabus.approval_stage = ApprovalStage.pending_pd
    notify_roles(db, [UserRole.program_director], current_user.college,
                 "syllabus_submitted", "Syllabus Pending Review",
                 f"A syllabus has been submitted for review by {current_user.full_name}.",
                 related_id=syllabus_id)
    db.commit()
    db.refresh(syllabus)
    log_action(db, str(current_user.id), "submit_syllabus_for_review", target_table="syllabi", target_id=syllabus_id)
    return syllabus


@router.post("/{syllabus_id}/approve", response_model=SyllabusResponse)
def approve_syllabus(
    syllabus_id: uuid.UUID,
    payload: SyllabusApprovalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in APPROVER_ROLES:
        raise HTTPException(status_code=403, detail="Only approvers can approve syllabi")
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    required_stage, next_stage = APPROVAL_CHAIN[current_user.role]
    if syllabus.approval_stage != required_stage:
        raise HTTPException(status_code=400, detail=f"Your role can only approve syllabi in '{required_stage}' stage; this syllabus is '{syllabus.approval_stage}'")
    approval = SyllabusApproval(
        syllabus_id=syllabus.id,
        approver_id=current_user.id,
        role=current_user.role.value,
        status="approved",
        feedback=payload.feedback,
    )
    db.add(approval)
    syllabus.approval_stage = next_stage
    # Notify instructor that stage advanced
    course = db.query(Course).filter(Course.id == syllabus.course_id).first()
    if course:
        from backend.models.user import User as UserModel
        instructor = db.query(UserModel).filter(UserModel.id == course.instructor_id).first()
        if instructor:
            if next_stage == ApprovalStage.fully_approved:
                notify(db, str(instructor.id), "syllabus_approved",
                       "Syllabus Fully Approved",
                       "Your syllabus has been fully approved. You can now validate topics.",
                       related_id=syllabus_id)
            else:
                notify(db, str(instructor.id), "syllabus_approved",
                       "Syllabus Approval Progress",
                       f"Your syllabus has been approved by the {current_user.role.value.replace('_', ' ').title()} and is advancing to the next stage.",
                       related_id=syllabus_id)
        # Notify next approver
        if next_stage == ApprovalStage.pending_dean:
            notify_roles(db, [UserRole.dean], instructor.college if instructor else None,
                         "syllabus_submitted", "Syllabus Pending Your Endorsement",
                         "A syllabus is ready for your endorsement.", related_id=syllabus_id)
        elif next_stage == ApprovalStage.pending_vp:
            notify_roles(db, [UserRole.vp_academic_affairs], None,
                         "syllabus_submitted", "Syllabus Pending Final Approval",
                         "A syllabus is ready for your final approval.", related_id=syllabus_id)
    db.commit()
    db.refresh(syllabus)
    log_action(db, str(current_user.id), "approve_syllabus", target_table="syllabi", target_id=syllabus_id,
               extra={"next_stage": next_stage.value})
    return syllabus


@router.post("/{syllabus_id}/reject", response_model=SyllabusResponse)
def reject_syllabus(
    syllabus_id: uuid.UUID,
    payload: SyllabusApprovalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in APPROVER_ROLES:
        raise HTTPException(status_code=403, detail="Only approvers can reject syllabi")
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    required_stage, _ = APPROVAL_CHAIN[current_user.role]
    if syllabus.approval_stage != required_stage:
        raise HTTPException(status_code=400, detail=f"Your role can only act on syllabi in '{required_stage}' stage")
    approval = SyllabusApproval(
        syllabus_id=syllabus.id,
        approver_id=current_user.id,
        role=current_user.role.value,
        status="rejected",
        feedback=payload.feedback,
    )
    db.add(approval)
    syllabus.approval_stage = ApprovalStage.rejected
    course = db.query(Course).filter(Course.id == syllabus.course_id).first()
    if course:
        from backend.models.user import User as UserModel
        instructor = db.query(UserModel).filter(UserModel.id == course.instructor_id).first()
        if instructor:
            notify(db, str(instructor.id), "syllabus_rejected",
                   "Syllabus Rejected",
                   f"Your syllabus was rejected by the {current_user.role.value.replace('_', ' ').title()}. Reason: {payload.feedback or 'No reason provided.'}",
                   related_id=syllabus_id)
    db.commit()
    db.refresh(syllabus)
    log_action(db, str(current_user.id), "reject_syllabus", target_table="syllabi", target_id=syllabus_id,
               extra={"feedback": payload.feedback})
    return syllabus


@router.post("/{syllabus_id}/resubmit", response_model=SyllabusResponse)
def resubmit_syllabus(
    syllabus_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    if syllabus.approval_stage != ApprovalStage.rejected:
        raise HTTPException(status_code=400, detail="Can only resubmit a rejected syllabus")
    course = db.query(Course).filter(Course.id == syllabus.course_id).first()
    if course:
        _assert_course_access(course, current_user)
    syllabus.approval_stage = ApprovalStage.pending_pd
    db.commit()
    db.refresh(syllabus)
    log_action(db, str(current_user.id), "resubmit_syllabus", target_table="syllabi", target_id=syllabus_id)
    return syllabus


@router.put("/{syllabus_id}/validate", response_model=SyllabusResponse)
def validate_syllabus(
    syllabus_id: uuid.UUID,
    payload: SyllabusValidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")

    if syllabus.approval_stage != ApprovalStage.fully_approved:
        raise HTTPException(
            status_code=403,
            detail=f"Syllabus must be fully approved before validation. Current stage: {syllabus.approval_stage}"
        )

    course = db.query(Course).filter(Course.id == syllabus.course_id).first()
    if course:
        _assert_course_access(course, current_user)

    db.query(Competency).filter(Competency.syllabus_id == syllabus_id).delete()

    for comp in payload.competencies:
        competency = Competency(
            syllabus_id=syllabus.id,
            **comp.model_dump(),
        )
        db.add(competency)

    syllabus.status = SyllabusStatus.validated
    syllabus.validated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(syllabus)
    log_action(db, str(current_user.id), "validate_syllabus", target_table="syllabi",
               target_id=syllabus_id)
    return syllabus
