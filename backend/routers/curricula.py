from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.deps import require_role, get_current_user
from backend.models.user import User, UserRole
from backend.models.curriculum import Curriculum
from backend.models.curriculum_subject import CurriculumSubject
from backend.schemas.curriculum import (
    CurriculumCreate,
    CurriculumResponse,
    CurriculumSubjectCreate,
    CurriculumSubjectResponse,
)

router = APIRouter(prefix="/curricula", tags=["curricula"])


@router.post("/", response_model=CurriculumResponse, status_code=status.HTTP_201_CREATED)
def create_curriculum(
    payload: CurriculumCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    curriculum = Curriculum(**payload.model_dump())
    db.add(curriculum)
    db.commit()
    db.refresh(curriculum)
    return curriculum


@router.get("/", response_model=list[CurriculumResponse])
def list_curricula(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Curriculum).all()


@router.get("/{curriculum_id}", response_model=CurriculumResponse)
def get_curriculum(
    curriculum_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    curriculum = db.query(Curriculum).filter(Curriculum.id == curriculum_id).first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    return curriculum


@router.put("/{curriculum_id}", response_model=CurriculumResponse)
def update_curriculum(
    curriculum_id: str,
    payload: CurriculumCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    curriculum = db.query(Curriculum).filter(Curriculum.id == curriculum_id).first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    for field, value in payload.model_dump().items():
        setattr(curriculum, field, value)
    db.commit()
    db.refresh(curriculum)
    return curriculum


@router.post("/{curriculum_id}/subjects", response_model=CurriculumSubjectResponse, status_code=status.HTTP_201_CREATED)
def add_subject(
    curriculum_id: str,
    payload: CurriculumSubjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    curriculum = db.query(Curriculum).filter(Curriculum.id == curriculum_id).first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    subject = CurriculumSubject(**payload.model_dump(), curriculum_id=curriculum_id)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.get("/{curriculum_id}/subjects", response_model=list[CurriculumSubjectResponse])
def list_subjects(
    curriculum_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    curriculum = db.query(Curriculum).filter(Curriculum.id == curriculum_id).first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    return db.query(CurriculumSubject).filter(CurriculumSubject.curriculum_id == curriculum_id).all()
