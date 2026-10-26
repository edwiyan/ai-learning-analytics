import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from backend.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def hash_student_id(student_id: str) -> str:
    """SHA-256(Student_ID + Salt) per capstone §3.9.1."""
    return hashlib.sha256((str(student_id) + settings.student_id_salt).encode()).hexdigest()


def generate_otp_password() -> str:
    """
    Generate a unique, policy-compliant initial password.
    Format: 3 uppercase + 2 digits + 3 lowercase + 1 special, shuffled.
    Example: mK3!rN2xP  (always meets uppercase/lowercase/digit/special requirements)
    """
    parts = (
        [secrets.choice(string.ascii_uppercase) for _ in range(3)]
        + [secrets.choice(string.digits) for _ in range(2)]
        + [secrets.choice(string.ascii_lowercase) for _ in range(3)]
        + [secrets.choice("!@#$")]
    )
    secrets.SystemRandom().shuffle(parts)
    return "".join(parts)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
