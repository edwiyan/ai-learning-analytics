from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.core.config import settings
from backend.core.limiter import limiter
from backend.core.security_headers import SecurityHeadersMiddleware
from backend.routers import auth, users, courses, syllabi, assessments, analytics
from backend.routers import programs, curricula, sections, enrollments, grade_submissions, notifications
from backend.routers import attendance, surveys, consent, exam_questions
# Import new models so SQLAlchemy metadata is populated for migrations
import backend.models.grade_weight          # noqa: F401
import backend.models.grade_scale           # noqa: F401
import backend.models.tos                   # noqa: F401
import backend.models.attendance               # noqa: F401
import backend.models.instructor_intervention  # noqa: F401
import backend.models.grade_consultation       # noqa: F401
import backend.models.sus_survey               # noqa: F401
import backend.models.academic_standing        # noqa: F401

app = FastAPI(
    title="AILAS API",
    description="AI-Assisted Learning Analytics System",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(courses.router)
app.include_router(syllabi.router)
app.include_router(assessments.router)
app.include_router(analytics.router)
app.include_router(programs.router)
app.include_router(curricula.router)
app.include_router(sections.router)
app.include_router(enrollments.router)
app.include_router(grade_submissions.router)
app.include_router(notifications.router)
app.include_router(attendance.router)
app.include_router(surveys.router)
app.include_router(consent.router)
app.include_router(exam_questions.router)


@app.get("/health", tags=["health"])
def health_check():
    from backend.core.database import get_db
    from sqlalchemy import text
    db_status = "disconnected"
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        pass
    llm_status = "configured" if settings.openai_api_key else "missing_key"
    return {
        "status": "ok",
        "service": "ailas-backend",
        "db": db_status,
        "llm_api": llm_status,
    }
