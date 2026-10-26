"""Course review resources: AI suggestions the instructor accepts or declines, and the
instructor's own resources (links, lessons, uploaded PDF / PPT / DOCX files).

Accepted resources are what students see first in their recommendations; declined
ones are never recommended for that course.
"""
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.audit import log_action
from backend.core.database import get_db
from backend.core.deps import get_current_user, require_role
from backend.core.limiter import limiter
from backend.core.security import hash_student_id
from backend.models.assessment import Assessment
from backend.models.course import Course
from backend.models.recommendation_feedback import RecommendationFeedback
from backend.models.resource import CourseResource, CourseResourceStatus, Resource, ResourceType
from backend.models.score import StudentScore
from backend.models.syllabus import Competency, Syllabus, SyllabusStatus
from backend.models.user import User, UserRole
from backend.services.ai.llm_client import llm_configured
from backend.services.ai.resource_suggester import suggest_course_resources

router = APIRouter(prefix="/courses", tags=["course-resources"])

UPLOAD_DIR = "uploads/resources"
MAX_FILE_BYTES = 25 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".mp4": "video/mp4",
}


class DecisionIn(BaseModel):
    status: CourseResourceStatus


def _owned_course(course_id: uuid.UUID, db: Session, user: User) -> Course:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if user.role != UserRole.admin and str(course.instructor_id) != str(user.id):
        raise HTTPException(status_code=403, detail="You do not own this course")
    return course


def _resource_out(r: Resource, feedback: dict) -> dict:
    helpful, not_helpful = feedback.get(str(r.id), (0, 0))
    return {
        "id": str(r.id),
        "title": r.title,
        "type": r.type.value if hasattr(r.type, "value") else str(r.type),
        "url": r.url,
        "description": r.description,
        "competency_tags": r.competency_tags or [],
        "file_name": r.file_name,
        "has_file": bool(r.file_path),
        "source": r.source,
        "helpful_count": helpful,
        "not_helpful_count": not_helpful,
    }


def _course_view(course: Course, db: Session) -> dict:
    from sqlalchemy import case, func as sa_func

    syllabus = (db.query(Syllabus)
                .filter(Syllabus.course_id == course.id, Syllabus.status == SyllabusStatus.validated)
                .first())
    comps = db.query(Competency).filter(Competency.syllabus_id == syllabus.id).all() if syllabus else []
    links = db.query(CourseResource).filter(CourseResource.course_id == course.id).all()
    feedback = {
        str(rid): (int(h or 0), int(n or 0))
        for rid, h, n in db.query(
            RecommendationFeedback.resource_id,
            sa_func.sum(case((RecommendationFeedback.helpful.is_(True), 1), else_=0)),
            sa_func.sum(case((RecommendationFeedback.helpful.is_(False), 1), else_=0)),
        ).filter(RecommendationFeedback.course_id == course.id).group_by(RecommendationFeedback.resource_id).all()
    }
    return {
        "course_id": str(course.id),
        "has_validated_syllabus": syllabus is not None,
        "ai_available": llm_configured(),
        "competencies": [
            {"id": str(c.id), "competency_code": c.competency_code, "topic_name": c.topic_name}
            for c in sorted(comps, key=lambda c: c.competency_code or "")
        ],
        "items": [
            {
                "link_id": str(link.id),
                "competency_id": str(link.competency_id) if link.competency_id else None,
                "status": link.status,
                "source": link.source,
                "score": link.score,
                "reason": link.reason,
                "decided_at": link.decided_at.isoformat() if link.decided_at else None,
                "resource": _resource_out(link.resource, feedback),
            }
            for link in links if link.resource is not None
        ],
    }


@router.get("/{course_id}/resources")
def list_course_resources(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    return _course_view(_owned_course(course_id, db, current_user), db)


@router.post("/{course_id}/resources/suggest")
def generate_suggestions(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    """Ask the AI suggester for review resources for every competency of the course."""
    course = _owned_course(course_id, db, current_user)
    summary = suggest_course_resources(course.id, db)
    if summary["competencies"] == 0:
        raise HTTPException(status_code=422, detail="The course needs an endorsed syllabus before resources can be suggested")
    log_action(db, str(current_user.id), "suggest_course_resources", target_table="courses",
               target_id=course.id, extra=summary)
    return {**_course_view(course, db), "summary": summary}


@router.put("/{course_id}/resources/{link_id}")
def decide_resource(
    course_id: uuid.UUID,
    link_id: uuid.UUID,
    payload: DecisionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    """Accept or decline a suggested resource (or reset it to suggested)."""
    course = _owned_course(course_id, db, current_user)
    link = db.query(CourseResource).filter(CourseResource.id == link_id,
                                           CourseResource.course_id == course.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Course resource not found")
    previous = link.status
    link.status = payload.status.value
    link.decided_by = current_user.id if payload.status != CourseResourceStatus.suggested else None
    link.decided_at = datetime.now(timezone.utc) if payload.status != CourseResourceStatus.suggested else None
    db.commit()
    log_action(db, str(current_user.id), f"resource_{payload.status.value}", target_table="course_resources",
               target_id=link.id, extra={"course_id": str(course.id), "resource_id": str(link.resource_id),
                                         "from": previous, "source": link.source})
    return {"link_id": str(link.id), "status": link.status}


@router.post("/{course_id}/resources", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def add_custom_resource(
    request: Request,
    course_id: uuid.UUID,
    title: str = Form(..., min_length=3, max_length=200),
    type: ResourceType = Form(ResourceType.link),
    competency_ids: str = Form(""),
    url: str = Form(""),
    description: str = Form("", max_length=2000),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    """Instructor's own resource for this course: a link, a lesson, or an uploaded file."""
    course = _owned_course(course_id, db, current_user)

    comp_ids = []
    if competency_ids.strip():
        valid = {str(c.id) for c in db.query(Competency).join(Syllabus)
                 .filter(Syllabus.course_id == course.id, Syllabus.status == SyllabusStatus.validated).all()}
        for cid in (x.strip() for x in competency_ids.split(",") if x.strip()):
            if cid not in valid:
                raise HTTPException(status_code=422, detail="A selected competency does not belong to this course")
            comp_ids.append(uuid.UUID(cid))

    url = url.strip()
    has_file = file is not None and bool(file.filename)
    if not has_file and not url:
        raise HTTPException(status_code=422, detail="Provide a link or upload a file")
    if url and not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="Links must start with http:// or https://")

    resource_id = uuid.uuid4()
    file_path = file_name = mime = None
    if has_file:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Allowed files: PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, TXT, PNG/JPG, MP4")
        data = await file.read()
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(status_code=400, detail="File too large (max 25 MB)")
        if not data:
            raise HTTPException(status_code=400, detail="The uploaded file is empty")
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        file_path = f"{UPLOAD_DIR}/{resource_id}{ext}"
        with open(file_path, "wb") as fh:
            fh.write(data)
        file_name = os.path.basename(file.filename)[:200]
        mime = ALLOWED_EXTENSIONS[ext]
        if type == ResourceType.link:
            type = ResourceType.file
        url = url or f"/courses/{course.id}/resources/{resource_id}/file"

    resource = Resource(
        id=resource_id, title=title.strip(), type=type, url=url,
        description=description.strip() or None,
        competency_tags=[c.topic_name for c in db.query(Competency).filter(Competency.id.in_(comp_ids)).all()],
        file_path=file_path, file_name=file_name, mime_type=mime,
        course_id=course.id, created_by=current_user.id, source="instructor",
    )
    db.add(resource)
    now = datetime.now(timezone.utc)
    for cid in comp_ids or [None]:
        db.add(CourseResource(course_id=course.id, resource_id=resource_id, competency_id=cid,
                              status=CourseResourceStatus.accepted.value, source="instructor",
                              decided_by=current_user.id, decided_at=now))
    db.commit()
    log_action(db, str(current_user.id), "add_custom_resource", target_table="resources",
               target_id=resource_id, extra={"course_id": str(course.id), "type": type.value,
                                             "file": file_name, "competencies": len(comp_ids)})
    return _course_view(course, db)


@router.delete("/{course_id}/resources/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_custom_resource(
    course_id: uuid.UUID,
    link_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.instructor, UserRole.admin)),
):
    """Remove an instructor-added resource. AI suggestions are declined, not deleted."""
    course = _owned_course(course_id, db, current_user)
    link = db.query(CourseResource).filter(CourseResource.id == link_id,
                                           CourseResource.course_id == course.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Course resource not found")
    if link.source != "instructor":
        raise HTTPException(status_code=400, detail="Decline AI suggestions instead of deleting them")
    resource = link.resource
    db.delete(link)
    db.flush()
    if resource is not None and resource.course_id == course.id and \
            not db.query(CourseResource).filter(CourseResource.resource_id == resource.id).count():
        if resource.file_path and os.path.isfile(resource.file_path):
            os.remove(resource.file_path)
        db.delete(resource)
    db.commit()
    log_action(db, str(current_user.id), "remove_custom_resource", target_table="course_resources",
               target_id=link_id, extra={"course_id": str(course.id)})


def _student_in_course(user: User, course_id, db: Session) -> bool:
    if not user.student_number:
        return False
    sid_hash = hash_student_id(user.student_number)
    return db.query(StudentScore).join(Assessment, StudentScore.assessment_id == Assessment.id).filter(
        Assessment.course_id == course_id, StudentScore.student_id_hash == sid_hash).first() is not None


@router.get("/{course_id}/resources/{resource_id}/file")
def download_resource_file(
    course_id: uuid.UUID,
    resource_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource or not resource.file_path or str(resource.course_id) != str(course_id):
        raise HTTPException(status_code=404, detail="File not found")
    if current_user.role == UserRole.student:
        if not _student_in_course(current_user, course_id, db):
            raise HTTPException(status_code=403, detail="You are not in this course")
    elif current_user.role in (UserRole.instructor, UserRole.admin):
        _owned_course(course_id, db, current_user)
    if not os.path.isfile(resource.file_path):
        raise HTTPException(status_code=404, detail="File is missing on the server")
    return FileResponse(resource.file_path, media_type=resource.mime_type or "application/octet-stream",
                        filename=resource.file_name or os.path.basename(resource.file_path))
