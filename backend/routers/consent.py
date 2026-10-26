from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.deps import get_current_user
from backend.core.audit import log_action
from backend.core.security import hash_student_id
from backend.models.user import User, UserRole
from backend.models.consent import PrivacyConsent, CONSENT_VERSION
from backend.schemas.consent import ConsentResponse, ConsentStatusResponse

router = APIRouter(prefix="/consent", tags=["consent"])


@router.get("/status", response_model=ConsentStatusResponse)
def get_consent_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = (
        db.query(PrivacyConsent)
        .filter(PrivacyConsent.user_id == current_user.id, PrivacyConsent.accepted == True)
        .order_by(PrivacyConsent.timestamp.desc())
        .first()
    )
    if not record:
        return ConsentStatusResponse(accepted=False)
    return ConsentStatusResponse(
        accepted=True,
        version=record.version,
        timestamp=record.timestamp,
    )


@router.post("/accept", response_model=ConsentResponse)
def accept_consent(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student_id_hash = ""
    if current_user.role == UserRole.student and current_user.student_number:
        student_id_hash = hash_student_id(current_user.student_number)

    ip = request.client.host if request.client else None

    record = PrivacyConsent(
        user_id=current_user.id,
        student_id_hash=student_id_hash,
        accepted=True,
        version=CONSENT_VERSION,
        ip_address=ip,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    log_action(db, str(current_user.id), "consent_accept",
               target_table="privacy_consents", target_id=str(record.id),
               extra={"version": CONSENT_VERSION})

    return ConsentResponse(
        id=str(record.id),
        user_id=str(record.user_id),
        accepted=record.accepted,
        version=record.version,
        timestamp=record.timestamp,
    )
