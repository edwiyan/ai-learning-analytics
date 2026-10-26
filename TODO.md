# AILAS — Project TODO

> Agile Iterative SDLC | 14 Sprints across 4 Phases
> Stack: React.js · FastAPI · PostgreSQL · OpenAI GPT-4o-mini · Docker

---

## PHASE 1 — Requirements & Infrastructure (Sprints 1–2)

### EPIC 1.1 — Project Scaffolding ✅
- [x] Initialize proper backend structure: `backend/core/`, `backend/routers/`, `backend/models/`, `backend/schemas/`, `backend/services/`, `backend/tests/`
- [x] Move `venv/main.py` to `backend/main.py`
- [x] Create `backend/requirements.txt` with all dependencies
- [x] Initialize React.js frontend with Vite
- [x] Install frontend dependencies: axios, react-router-dom, chart.js, react-chartjs-2, tailwindcss
- [x] Create `.env.example` with all required environment variable keys
- [x] Create `docker-compose.yml` (services: backend, frontend, postgres, redis)
- [x] Create `Dockerfile` for backend and frontend
- [x] Update `.gitignore`

### EPIC 1.2 — Database Schema Design ✅
- [x] Design all SQLAlchemy models (users, courses, syllabi, competencies, assessments, assessment_items, student_scores, risk_predictions, resources, recommendations, audit_logs)
- [ ] Set up Alembic for migrations: `alembic init database/migrations`
- [ ] Write initial migration from schema

### EPIC 1.3 — Core Backend Setup ✅
- [x] `backend/core/config.py` — Pydantic settings loaded from `.env`
- [x] `backend/core/database.py` — SQLAlchemy engine, session factory, Base
- [x] `backend/core/security.py` — JWT token creation/validation, password hashing (bcrypt), SHA-256 student ID hashing
- [x] Wire up `backend/main.py` — CORS, routers, health check endpoint `GET /health`

---

## PHASE 2 — Design & Core API (Sprints 3–4)

### EPIC 2.1 — Authentication & RBAC
- [ ] `POST /auth/register` — create user (admin-only for instructor accounts)
- [ ] `POST /auth/login` — returns JWT access token
- [ ] `GET /auth/me` — returns current user profile
- [ ] JWT middleware — decode and inject current user into request context
- [ ] RBAC dependency — `require_role(["instructor", "admin"])` FastAPI dependency
- [ ] Protect all non-auth routes with JWT middleware

### EPIC 2.2 — User Management
- [ ] `GET /users` (admin) — list all users with pagination
- [ ] `POST /users` (admin) — create instructor/student accounts
- [ ] `PUT /users/{id}` (admin) — update user details
- [ ] `DELETE /users/{id}` (admin) — deactivate user

### EPIC 2.3 — Frontend Foundation
- [ ] Set up React Router with protected routes (redirect to `/login` if no token)
- [ ] `AuthContext` — stores JWT, user role, expiry; exposes `login()`, `logout()`
- [ ] Axios instance in `frontend/src/services/api.js` — base URL, auto-attach Bearer token, 401 interceptor
- [ ] Shared layout component with role-based sidebar navigation
- [ ] Login page with form validation
- [ ] 404 and unauthorized pages

---

## PHASE 3A — Syllabus & Assessment Ingestion (Sprints 5–7)

### EPIC 3.1 — Syllabus Ingestion (Backend)
- [ ] `backend/services/ocr/extractor.py` — Tesseract wrapper; accepts PDF/DOC file bytes, returns raw text
- [ ] `backend/services/ai/syllabus_parser.py` — sends raw text to GPT-4o-mini with structured prompt; returns JSON `{topics: [], learning_outcomes: [], competencies: [{id, name, outcomes[]}]}`
- [ ] `POST /syllabi/upload` — multipart file upload (PDF/DOC), runs OCR + LLM parse, stores result with `status: pending`
- [ ] `GET /syllabi/{id}` — fetch parsed syllabus with competencies
- [ ] `PUT /syllabi/{id}/validate` — instructor confirms/edits AI-parsed competencies, sets `status: validated`

### EPIC 3.2 — Assessment CSV Upload (Backend)
- [ ] Define CSV template schema (columns: student_id, question_text, score, max_score, submission_date)
- [ ] `backend/services/assessment/csv_parser.py` — Pandas validation: schema check, missing values, score range, date format
- [ ] `backend/services/assessment/preprocessor.py` — grade normalization, SHA-256 hash student IDs, handle missing values
- [ ] `POST /assessments/{assessment_id}/upload` — accepts CSV, runs validation + preprocessing, stores normalized scores
- [ ] `GET /assessments/{assessment_id}/items` — return uploaded items with current topic mapping status

### EPIC 3.3 — Processing Interface (Frontend)
- [ ] Syllabus upload form — drag-and-drop PDF/DOC, upload progress indicator
- [ ] Competency review UI — table showing AI-parsed topics/competencies with edit capability; highlight items needing validation
- [ ] CSV upload form — file picker, preview first 10 rows, submit
- [ ] Upload status feedback — success/error toasts, processing spinner

---

## PHASE 3B — AI Analytics Engine (Sprints 7–9)

### EPIC 4.1 — Topic Mapping Engine ✅
- [x] `backend/services/ai/topic_mapper.py`:
  - Primary (and only): send question text + competency list to GPT-4o-mini → parse `competency_code` + `confidence_score` + `bloom_level`. **No TF-IDF / Cosine Similarity** — the design is LLM-semantic-only per the capstone delimitations.
  - Flag items where confidence < 0.75 (`settings.topic_mapping_confidence_threshold`) for manual review
- [x] Background task: run topic mapping on all items after CSV upload (`_run_topic_mapping`)
- [x] `PUT /assessments/items/{item_id}/tag` — instructor overrides AI topic tag
- [x] `GET /assessments/{id}/mapping-queue` — returns all items pending human validation

### EPIC 4.2 — Risk Prediction Engine ✅
- [x] `backend/services/ai/risk_predictor.py`:
  - Feature engineering: competency scores per period, score progression (Prelim → Midterm → Semi). Attendance/timeliness are computed as descriptive features but do **not** drive the flag (Delimitation #2).
  - **Deterministic rule-based engine — no Random Forest, no scikit-learn model is trained or serialized**, per capstone Table 3: `At-Risk` when learning_gap_count ≥ 3 OR grade_decline > 15%; `Excelling` when avg ≥ 85% with no gaps; else `On-Track`.
  - Output: `{student_id_hash, course_id, risk_level: At-Risk|On-Track|Excelling, weak_competencies[]}`
  - QA: `backend/tests/test_risk_f1.py` is an internal macro-F1 regression guard (not a headline metric).
- [x] Trigger prediction after each grading period's CSV upload is validated
- [x] Store predictions in `risk_predictions` table

### EPIC 4.3 — Recommendation Engine
- [ ] Seed `resources` table with sample remedial materials (videos, readings, exercises) tagged by competency
- [ ] `backend/services/ai/recommender.py` — Content-Based Filtering: match student's weak competencies to resource tags, rank by relevance score
- [ ] `GET /recommendations/{student_id_hash}` — returns ranked resource list
- [ ] `POST /resources` (admin/instructor) — add new remedial resource with competency tags

---

## PHASE 3C — Dashboards (Sprints 9–10)

### EPIC 5.1 — Student Dashboard (Frontend)
- [ ] Competency radar/bar chart — scores per competency using Chart.js
- [ ] Learning gap panel — list of competencies below passing threshold, color-coded severity
- [ ] Risk status badge — `At-Risk` (red) / `On-Track` (green) / `Excelling` (blue)
- [ ] Personalized remedial materials list — title, type icon, relevance score, external link
- [ ] Progress tracker — line chart of period-over-period score progression (Prelim → Midterm → Semi → Final)
- [ ] Connect all components to backend API endpoints

### EPIC 5.2 — Instructor Dashboard (Frontend)
- [ ] Risk alert panel — list of at-risk students with risk level and flagged competencies
- [ ] Class analytics — aggregate competency scores, class average vs. passing threshold (bar chart)
- [ ] Topic mapping validation queue — pending AI tags awaiting instructor confirmation
- [ ] Per-student drill-down — click student row → open competency breakdown modal
- [ ] Reports export — download class analytics as CSV

### EPIC 5.3 — Admin Dashboard (Frontend)
- [ ] Institutional overview — enrollment counts, active courses, overall pass/fail rates
- [ ] Risk distribution chart — how many students are At-Risk / On-Track / Excelling across all courses
- [ ] Bias distribution panel — demographic breakdown of risk predictions
- [ ] Curriculum effectiveness — competency mastery rates per course
- [ ] User management table — CRUD interface for users

### EPIC 5.4 — Analytics Page (Frontend)
- [ ] Performance trends over time (line chart, filterable by course/period)
- [ ] AI topic mapping visualization — competency map with confidence scores
- [ ] Competency heatmap — students × competencies grid, color by score

---

## PHASE 4 — Security, Testing & Deployment (Sprints 11–14)

### EPIC 6.1 — Security Hardening ✅
- [x] Verify SHA-256 hashing is applied to all student identifiers before DB insert (never store raw IDs)
- [x] Add rate limiting to auth endpoints (`slowapi` — 10 req/min on POST /auth/login)
- [x] Implement tamper-evident audit logging for all critical actions (login, upload, user create/deactivate)
- [x] Role guard: instructors can only access their own courses' data (`_assert_course_access`)
- [x] Add security header middleware (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy)
- [ ] WCAG 2.1 Level AA pass on all dashboard pages (color contrast, keyboard navigation, ARIA labels)
- [x] Input sanitization on all file upload endpoints (MIME type validation, file size limits)

### EPIC 6.2 — Data Privacy Compliance (RA 10173)
- [ ] Add digital consent form flow for student participants during onboarding
- [ ] Data retention policy: document and implement auto-anonymization schedule
- [x] Privacy policy page in frontend (`/privacy` — covers RA 10173, SHA-256 hashing, data retention, OpenAI usage)
- [x] Confirm no raw student PII is logged anywhere in application logs (audit logs store user_id hash, not email/name)

### EPIC 6.3 — Testing ✅ (core test suite)
- [x] Backend unit tests — `pytest` for csv_parser, risk_predictor (22 tests, all passing)
- [x] Backend integration tests — auth + users full API flow with test DB
- [ ] Frontend component tests — React Testing Library for all dashboard components
- [ ] AI model validation — holdout test set for topic mapping (target ≥85% accuracy) and risk prediction (target F1 ≥0.80)
- [ ] Load test — simulate 100 concurrent users during grade submission (target p95 ≤ 3s API, ≤ 2s dashboard)
- [ ] Security test — OWASP ZAP scan for common vulnerabilities
- [ ] SUS survey instrument — prepare questionnaire for pilot with 5–8 faculty and 50–100 students

### EPIC 6.4 — Deployment ✅ (core infra)
- [x] Finalize `docker-compose.prod.yml` for production (backend, frontend nginx, postgres) with nginx reverse proxy
- [x] Confirm all migrations run cleanly: 4 migrations applied (initial schema, student_number, audit_logs String type, needs_review Boolean)
- [x] GUID TypeDecorator: all models now work with both PostgreSQL (production) and SQLite (testing)
- [x] Set up CI: GitHub Actions `.github/workflows/ci.yml` — lint + test + frontend build on every push
- [ ] Document deployment runbook in `docs/deployment.md`
- [ ] Faculty training guide in `docs/user-guide-instructor.md`

---

## Backlog / Post-MVP

- [ ] Vector database integration for semantic syllabus search (pgvector or Pinecone)
- [ ] Prompt-refinement pipeline — refine GPT-4o-mini prompts as faculty validation feedback accumulates (the capstone's feedback loop; **no model retraining** — the risk engine is rule-based)
- [ ] GPT-4o-mini prompt versioning and A/B testing framework
- [ ] Mobile-responsive PWA enhancements
- [ ] LMS integration (Canvas/Moodle) for automated grade sync
- [ ] Expanded reporting: PDF export of student performance reports
