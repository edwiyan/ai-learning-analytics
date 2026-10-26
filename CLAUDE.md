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

Three-tier architecture (use this term, not MVC — panel comment 8), with an external AI service:

- **Presentation tier** (`frontend/src/`): React.js SPA, role-based routing, Chart.js dashboards
- **Application tier** (`backend/routers/`, `backend/services/`): FastAPI REST API, JWT + RBAC, ingestion, rule-based analytics, all calls to the AI provider
- **Data tier** (`backend/models/`, `database/`): PostgreSQL via SQLAlchemy ORM + Alembic migrations
- **External AI service**: OpenAI GPT-4o-mini (optional Gemini fallback), called only from `services/ai/llm_client.py`; Nginx is the TLS reverse proxy

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
3. **Topic Mapping** — question text + syllabus topics sent to GPT-4o-mini → returns `topic_id` + a self-reported `confidence_score`. The confidence only orders review: with the `mapping_auto_accept` institution setting off (pilot default) every AI mapping is provisional until faculty confirm it; items below `mapping_review_threshold` (0.75) are listed first. Mapping accuracy is measured only by the blind Mapping Validation module (`routers/mapping_validation.py`), never from the confidence score
4. **Risk Classification** — Rule-Based Engine (deterministic, capstone Table 3): a student is `At-Risk` when they have ≥ 3 learning gaps (competencies below the 75% mastery threshold) OR a > 15% grade decline between the two most recent grading periods; `Excelling` requires ≥ 85% average mastery and no gaps; otherwise `On-Track`. No custom ML model is trained, and no behavioral/attendance signals drive the flag (per the capstone delimitations).
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
- **Notifications** ship as in-app + SMTP email (At-Risk alerts fire once when a student becomes At-Risk); Web Push / Twilio SMS (listed in the doc's tech table) are deferred as future work.
- **LLM calls** all go through `services/ai/llm_client.py` (PostgreSQL `llm_cache`, retry + circuit breaker, optional Gemini fallback via `GEMINI_API_KEY`); prompts live in `services/ai/prompts.py` and must keep JSON braces escaped (`{{ }}`) — `test_prompts.py` guards this.
- **Student IDs** are hashed as SHA-256(id + `STUDENT_ID_SALT`); never change the salt without `python -m backend.scripts.rehash_student_ids --old-salt ...`.
- **Capstone alignment** work and decisions are tracked in `CAPSTONE_ALIGNMENT_PLAN.md`; doc wording changes are drafted in `CAPSTONE_DOC_EDITS.md`.
- **Stack equivalents:** FastAPI (the doc permits Flask/FastAPI), pdfplumber (vs PyPDF2), python-jose + bcrypt (vs PyJWT) — same standards/roles, equivalent libraries.
- **Attendance / submission timeliness** are captured as descriptive features but, per Delimitation #2 (no behavioral tracking), do **not** drive the rule-based risk flag.
- **DB schema** uses the §3.4 column names (`hashed_identifier`, `mapping_confidence`, `requires_review`, `llm_structured_output`, `competency_mastery` table). Some ORM attributes keep prior names via SQLAlchemy column mapping.
- **Syllabus approval:** instructors edit AI-extracted competencies only while the syllabus is a draft or rejected (`PUT /syllabi/{id}/competencies`); they are read-only under review, and the VP's final action is labelled **Endorse** — it validates and locks the competencies.
- **Course review resources:** `course_resources` links AI-suggested (keyword-ranked, LLM re-rated when configured) or instructor-added resources (links, lessons, uploaded files) to competencies with an accept/decline decision; the recommender skips declined ones and ranks accepted ones first (`routers/course_resources.py`, `services/ai/resource_suggester.py`).
- **Reports:** `/reports` builds the Academic Performance & Early Intervention report (role-scoped; by college, program, curriculum, year level, section, course; competency gaps; At-Risk / Excelling rosters; interventions) and exports PDF (reportlab) and Excel (`services/reports/`).
- **Panel revisions (Oct 2026, `PANEL_REVISION_PLAN.md`):** thresholds (75 / 3 / 15 / 85, 0.75 review, early-warning period, intervention target) are institution settings (`services/institution_settings.py`, `/institution-settings/`) — read them with `get_settings(db)`, never hard-code; the frontend uses `useThresholds()`. The risk engine returns a `reason`, not a confidence. Every LLM prompt passes `guard_prompt` (blocks student numbers/names, strips emails; `store=False`); student scores are never sent. Early-warning timeliness lives in `services/early_warning.py`. Avoid "predict"/"real-time" wording for AILAS.
- **Roles:** the `instructor` role is the document's primary-user "Faculty" (the capstone uses both terms interchangeably).
