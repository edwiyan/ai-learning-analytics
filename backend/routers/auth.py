import uuid as _uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.core.audit import log_action
from backend.core.database import get_db, SessionLocal
from backend.core.deps import get_current_user
from backend.core.limiter import make_rate_limiter
from backend.core.security import verify_password, create_access_token, decode_access_token
from backend.models.user import User, UserRole
from backend.schemas.auth import LoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory JTI blacklist — sufficient for a single server session (defense day).
# Cleared on restart; no Redis dependency required.
_revoked_jtis: set[str] = set()

_login_rate_limit = make_rate_limiter(max_calls=30, window_seconds=60)


def _bg_log(user_id: str, action: str, extra: dict):
    db = SessionLocal()
    try:
        log_action(db, user_id, action, extra=extra)
    finally:
        db.close()


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    payload: LoginRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    _login_rate_limit(request)
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        uid = str(user.id) if user else "anonymous"
        background_tasks.add_task(_bg_log, uid, "login_failed", {"email": payload.email})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    jti = str(_uuid.uuid4())
    token = create_access_token({"sub": str(user.id), "role": user.role, "jti": jti})
    background_tasks.add_task(_bg_log, str(user.id), "login", {"email": user.email})
    return TokenResponse(access_token=token)


@router.post("/logout", status_code=204)
async def logout(request: Request, current_user: User = Depends(get_current_user)):
    auth = request.headers.get("authorization", "")
    token = auth.removeprefix("Bearer ").strip()
    if token:
        payload = decode_access_token(token)
        jti = payload.get("jti") if payload else None
        if jti:
            _revoked_jtis.add(jti)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    resp = UserResponse.model_validate(current_user)
    # RA 10173: never expose a raw student_number in a student-facing response.
    # Performance data is keyed by the SHA-256 hashed_identifier, not this number.
    if current_user.role == UserRole.student:
        resp.student_number = None
    return resp
