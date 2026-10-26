# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AILAS** — AI-Assisted Learning Analytics System for Student Performance Monitoring and Early Academic Intervention. Built for BTECH (Dalubhasaang Politekniko ng Lungsod ng Baliwag, Baliwag, Bulacan), it maps student assessment results to course competencies using LLM-based semantic analysis, flags academic risk using a deterministic rule-based engine (no custom ML model is trained), and delivers personalized remedial recommendations through role-based dashboards.

Three user roles: **Student**, **Instructor**, **Administrator**.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Chart.js + Responsive UI |
| Backend | Python + FastAPI + Uvicorn |
| Database | PostgreSQL (structured) |
| AI/ML | OpenAI GPT-4o-mini (LLM API), Rule-Based Risk Engine, Competency Tag-Match Recommender |
| OCR | Tesseract |
| Security | JWT, SHA-256 hashing (student IDs), RBAC |
| Deployment | Docker + Docker Compose |

## Development Commands

### Backend
```bash
# Activate venv (Windows)
.\backend\venv\Scripts\Activate.ps1

# Run dev server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Install dependencies
pip install -r backend/requirements.txt

# Run tests
pytest backend/tests/

# Run single test
pytest backend/tests/test_topic_mapping.py::test_confidence_threshold -v
```

### Frontend
```bash
cd frontend
npm install
npm run dev       # Vite dev server
npm run build
npm test
```

### Database
```bash
# Start via Docker
docker-compose up -d postgres redis

# Run migrations
alembic upgrade head

# New migration
alembic revision --autogenerate -m "description"
```

### Full Stack
```bash
docker-compose up --build   # start all services
docker-compose down
docker-compose logs -f
```

## Architecture

MVC with three layers:

- **View Layer** (`frontend/src/`): React.js SPA, role-based routing, Chart.js dashboards
- **Controller Layer** (`backend/routers/`): FastAPI REST endpoints, JWT middleware, RBAC guards, CSV parsers, OCR integration
- **Model Layer** (`backend/models/`, `database/`): SQLAlchemy ORM, AI/ML pipeline, LLM API integration

### Backend Layout
```
backend/
├── main.py
├── core/           # config, DB connection, security utilities
├── routers/        # auth, syllabus, assessment, analytics, users
├── models/         # SQLAlchemy ORM models
├── schemas/        # Pydantic request/response schemas
├── services/
│   ├── ai/         # topic mapping, risk prediction, recommendation engine
│   ├── ocr/        # Tesseract PDF/DOC extraction
│   └── auth/       # JWT, RBAC, SHA-256 hashing
└── tests/
```

### Frontend Layout
```
frontend/src/
├── pages/          # Login, StudentDashboard, InstructorDashboard, AdminDashboard, Analytics
├── components/     # Shared UI + Chart.js wrappers
├── hooks/          # Custom React hooks
├── services/       # Axios API client
├── context/        # AuthContext (role-based rendering)
└── utils/
```

## AI Pipeline

1. **Syllabus Ingestion** — PDF/DOC upload → text extraction (pdfplumber for digital PDFs, python-docx for DOC/DOCX; if a PDF yields no embedded text, an optional Tesseract OCR fallback rasterizes the pages — it degrades gracefully to empty text when the Tesseract binary is not installed) → GPT-4o-mini parses into structured JSON (topics, learning outcomes, competency IDs) → instructor validates; items with confidence < 0.75 are flagged for mandatory manual review
2. **Assessment Upload** — CSV → Pandas schema validation → grade normalization → student IDs SHA-256 hashed before storage
3. **Topic Mapping** — question text + syllabus topics sent to GPT-4o-mini → returns `topic_id` + `confidence_score`; items below the 0.75 threshold queued for human-in-the-loop correction
4. **Risk Prediction** — Rule-Based Engine (deterministic, capstone Table 3): a student is `At-Risk` when they have ≥ 3 learning gaps (competencies below the 75% mastery threshold) OR a > 15% grade decline between the two most recent grading periods; `Excelling` requires ≥ 85% average mastery and no gaps; otherwise `On-Track`. No custom ML model is trained, and no behavioral/attendance signals drive the flag (per the capstone delimitations).
5. **Recommendations** — weak competencies → competency tag-match query against pre-curated resource repository → ranked remedial resources (videos, readings, exercises) surfaced on student dashboard; optional GPT-4o-mini call generates a personalized encouragement message for the top result

## Environment Variables

Copy `.env.example` to `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/ailas
OPENAI_API_KEY=
SECRET_KEY=
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

## Quality Targets (ISO/IEC 25010)

Per the capstone evaluation design, the **primary** measures are usability and functional
suitability — not algorithmic accuracy.

- SUS usability score ≥ 68 (primary)
- 100% critical-task completion (functional suitability)
- Topic mapping accuracy ≥ 85% vs. faculty-validated ground truth
- Dashboard load < 3 seconds
- API response < 5 seconds
- System uptime ≥ 99% during academic windows (internal target)

The rule-based risk classifier has an internal regression guard (`test_risk_f1.py`); its
F1 is a QA check, not a headline evaluation metric.

## Capstone-Document Alignment Notes

The system targets **Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH)**. A few deliberate, documented choices:

- **OCR (Tesseract)** supplements structured PDF/DOC parsing (pdfplumber/python-docx) as a fallback for scanned/image syllabi — additive, not a scope change. The fallback is wired in `services/ocr/extractor.py` (triggered only when a PDF has no embedded text) and requires the Tesseract + Poppler binaries on the host; it degrades gracefully (returns empty text) when they are absent.
- **Bloom's-taxonomy tagging** in topic mapping is scaffolded but is a Phase-2 (post-pilot) capability per the document's workflow integration; advisory only.
- **Notifications** ship with SMTP email; Web Push / Twilio SMS (listed in the doc's tech table) are deferred as future work.
- **Stack equivalents:** FastAPI (the doc permits Flask/FastAPI), pdfplumber (vs PyPDF2), python-jose + bcrypt (vs PyJWT) — same standards/roles, equivalent libraries.
- **Attendance / submission timeliness** are captured as descriptive features but, per Delimitation #2 (no behavioral tracking), do **not** drive the rule-based risk flag.
- **DB schema** uses the §3.4 column names (`hashed_identifier`, `mapping_confidence`, `requires_review`, `llm_structured_output`, `competency_mastery` table). Some ORM attributes keep prior names via SQLAlchemy column mapping.
- **Roles:** the `instructor` role is the document's primary-user "Faculty" (the capstone uses both terms interchangeably).
