"""Shared pytest fixtures: an isolated SQLite test DB, a TestClient with the DB
dependency overridden, and seeded admin/instructor users + JWT tokens.

The app's GUID/JSON column types fall back to SQLite-compatible forms (see
backend/core/types.py), so tests run without a live Postgres instance.
"""
import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Importing the app loads config from .env and registers every ORM model on
# Base.metadata (routers import all models).
import backend.models  # noqa: F401
from backend.main import app
from backend.core.database import Base, get_db
from backend.core.security import create_access_token, hash_password
from backend.models.user import User, UserRole

_TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "_pytest.db")
_TEST_DB_URL = f"sqlite:///{_TEST_DB_PATH}"
_engine = create_engine(_TEST_DB_URL, connect_args={"check_same_thread": False})
_TestingSessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


@pytest.fixture(autouse=True)
def _no_background_audit(monkeypatch):
    """Neutralize login's background audit write (it opens the real SessionLocal),
    keeping tests hermetic against the isolated SQLite DB."""
    monkeypatch.setattr("backend.routers.auth._bg_log", lambda *args, **kwargs: None)


@pytest.fixture
def db():
    """Fresh schema per test (full isolation); yields a session on the test DB."""
    Base.metadata.create_all(bind=_engine)
    session = _TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=_engine)


@pytest.fixture
def client(db):
    """TestClient whose get_db dependency shares the test's session."""
    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def admin_user(db):
    user = User(
        email="admin@test.com",
        password_hash=hash_password("Admin@1234"),
        full_name="Test Admin",
        role=UserRole.admin,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user):
    return create_access_token(
        {"sub": str(admin_user.id), "role": admin_user.role, "jti": str(uuid.uuid4())}
    )


@pytest.fixture
def instructor_user(db):
    user = User(
        email="instructor@test.com",
        password_hash=hash_password("Instructor@1234"),
        full_name="Test Instructor",
        role=UserRole.instructor,
        is_active=True,
        college="ICS",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def instructor_token(instructor_user):
    return create_access_token(
        {"sub": str(instructor_user.id), "role": instructor_user.role, "jti": str(uuid.uuid4())}
    )


@pytest.fixture
def other_instructor_user(db):
    """A second, unrelated instructor — used to prove cross-tenant isolation
    (one instructor must not read/modify another instructor's data)."""
    user = User(
        email="instructor2@test.com",
        password_hash=hash_password("Instructor@1234"),
        full_name="Other Instructor",
        role=UserRole.instructor,
        is_active=True,
        college="ICS",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def other_instructor_token(other_instructor_user):
    return create_access_token(
        {"sub": str(other_instructor_user.id), "role": other_instructor_user.role, "jti": str(uuid.uuid4())}
    )


@pytest.fixture
def student_user(db):
    user = User(
        email="student@test.com",
        password_hash=hash_password("Student@1234"),
        full_name="Test Student",
        role=UserRole.student,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def student_token(student_user):
    return create_access_token(
        {"sub": str(student_user.id), "role": student_user.role, "jti": str(uuid.uuid4())}
    )
