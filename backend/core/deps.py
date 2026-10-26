import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.security import decode_access_token
from backend.models.user import User, UserRole

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    # Lazy import avoids circular dependency (auth.py imports get_current_user from here)
    from backend.routers.auth import _revoked_jtis
    jti = payload.get("jti")
    if jti and jti in _revoked_jtis:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
    try:
        user_uuid = uuid.UUID(payload.get("sub"))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_role(*roles: UserRole):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return checker


def require_consent(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    from backend.models.consent import PrivacyConsent
    has_consent = (
        db.query(PrivacyConsent)
        .filter(PrivacyConsent.user_id == current_user.id, PrivacyConsent.accepted == True)
        .first()
    )
    if not has_consent:
        raise HTTPException(
            status_code=451,
            detail="Data privacy consent required before accessing personal analytics.",
        )
