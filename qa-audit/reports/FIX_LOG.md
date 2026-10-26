# FIX LOG — AILAS QA Defect Resolution
**Date:** 2026-05-22  
**Fix plan:** FIX_PLAN.md  
**Total fixes applied:** 21 (FX-001 – FX-021)

---

## Batch 1 — Backend Role-Boundary (HIGH risk)

### FX-001 (DEF-01) — Student-only guard on `/analytics/me/*`
**File:** `backend/routers/analytics.py`  
**Change:** 9 endpoints changed from `Depends(get_current_user)` to `Depends(require_role(UserRole.student))`. Endpoints: `/me/risk`, `/me/courses`, `/me/competencies`, `/me/interventions`, `/me/recommendations`, `/me/scores`, `/me/progress`, `/me/attendance`, `/me/grade-summary`.  
**Result:** Non-student roles now receive 403 on all student-only endpoints.

### FX-002 (DEF-02) — Role guard on `GET /assessments/{id}/items`
**File:** `backend/routers/assessments.py`  
**Change:** Dependency changed to `require_role(UserRole.instructor, UserRole.admin)`.  
**Result:** Students can no longer fetch assessment item details.

### FX-003 (DEF-03) — Role guard on `GET /syllabi/{id}`
**File:** `backend/routers/syllabi.py`  
**Change:** Dependency changed to `require_role(UserRole.instructor, UserRole.admin, UserRole.program_director, UserRole.dean, UserRole.vp_academic_affairs)`.  
**Result:** Students can no longer fetch syllabus content directly.

### FX-004 (DEF-05) — UUID type annotations on path params
**Files:** `backend/routers/assessments.py`, `backend/routers/syllabi.py`  
**Change:** `assessment_id: str` and `syllabus_id: str` path params changed to `uuid.UUID`. Added `import uuid` to each file.  
**Result:** FastAPI returns 422 on malformed UUIDs instead of passing them to SQLAlchemy (preventing 500s and potential info leaks).

---

## Batch 2 — Frontend Routing (MED risk)

### FX-005 (DEF-19) — Vite proxy / React Router path conflicts
**Files:** `frontend/src/App.jsx`, `frontend/src/components/Layout.jsx`  
**Change:** Three conflicting frontend routes renamed to avoid collision with Vite proxy prefixes:  
- `/analytics` → `/analytics-page`  
- `/users` → `/user-management`  
- `/resources` → `/resource-library`  
All nav links updated in Layout.jsx accordingly.  
**Result:** Hard navigation (F5 / direct URL) no longer returns API JSON instead of the React SPA.

### FX-006 (DEF-20) — Missing proxy entries for `/surveys` and `/attendance`
**File:** `frontend/vite.config.js`  
**Change:** Added `/surveys` and `/attendance` proxy entries pointing to `BACKEND`.  
**Result:** Survey and attendance API calls work correctly in development.

---

## Batch 3 — Backend Auth & Input Hardening (MED risk)

### FX-007 (DEF-07) — Login rate limit increased
**File:** `backend/routers/auth.py`  
**Change:** `@limiter.limit("10/minute")` → `@limiter.limit("30/minute")`.  
**Result:** Defense demo with multiple concurrent logins will not hit rate limit.

### FX-008 (DEF-08) — HTML injection strip on `full_name`
**File:** `backend/routers/users.py`  
**Change:** Added `import re`. Applied `re.sub(r'<[^>]+>', '', ...)` to `full_name` at both single-create (line ~129) and bulk Excel import (line ~177) paths.  
**Result:** HTML/script tags in full names are stripped before storage.

### FX-009 (DEF-09) — JWT logout with JTI blacklist
**Files:** `backend/routers/auth.py`, `backend/core/deps.py`  
**Changes:**  
- `auth.py`: Added `import uuid as _uuid`, `decode_access_token` import, `_revoked_jtis: set[str] = set()` module-level blacklist. Login now embeds `jti` claim in token. `POST /auth/logout` endpoint revokes the JTI.  
- `deps.py`: `get_current_user` now lazy-imports `_revoked_jtis` from `backend.routers.auth` and rejects tokens whose JTI is in the blacklist with 401.  
**Result:** Logout invalidates the token for the server process lifetime. Zero new dependencies.  
**Known limitation:** JTI set is in-memory; cleared on server restart. Sufficient for single-process defense day.

### FX-010 (DEF-10) — Gate OpenAPI docs behind `settings.debug`
**Files:** `backend/core/config.py`, `backend/main.py`  
**Changes:**  
- `config.py`: Added `debug: bool = True` field to `Settings`.  
- `main.py`: Imported `settings`; passed `docs_url`, `redoc_url`, `openapi_url` as `None` when `settings.debug` is `False`.  
**Result:** Set `DEBUG=false` in `.env` to disable `/docs`, `/redoc`, `/openapi.json` in production.

---

## Batch 4 — Accessibility (LOW risk)

### FX-011 (DEF-14) — `aria-label` on interactive controls without visible text
**Files:**  
- `frontend/src/components/Pagination.jsx`: Added `aria-label="Previous page"` and `aria-label="Next page"` on prev/next buttons.  
- `frontend/src/pages/Login.jsx`: Added `aria-label={showPassword ? "Hide password" : "Show password"}` on toggle button.  
- `frontend/src/pages/StudentDashboard.jsx`: Added `aria-label="Select course"` on the course `<select>`.  
- `frontend/src/pages/AuditLogsPage.jsx`: Added `aria-label="From date"` and `aria-label="To date"` on date inputs.

### FX-012 (DEF-15) — Wrap Chart.js canvases in `<figure aria-label="...">`
**Files:**  
- `frontend/src/pages/StudentDashboard.jsx`: Line chart wrapped in `<figure aria-label="Score trend line chart">`.  
- `frontend/src/pages/InstructorDashboard.jsx`: Bar chart wrapped in `<figure aria-label="Student risk distribution bar chart">`.  
- `frontend/src/pages/MyCoursesPage.jsx`: Line chart and Radar chart each wrapped in `<figure>` with descriptive `aria-label`.  
**Note:** `AdminDashboard.jsx` was intentionally skipped — admin pages are frozen per project constraint.

### FX-013 (DEF-16) — Low-contrast text colour `text-gray-400` → `text-gray-500`
**Files:**  
- `frontend/src/components/Layout.jsx`: Role label and email lines in sidebar footer.  
- `frontend/src/components/Pagination.jsx`: Count text and prev/next button colours.  
- `frontend/src/components/StatCard.jsx`: Sub-label text.

### FX-014 (DEF-17) — Page `<title>` updated
**File:** `frontend/index.html`  
**Change:** `<title>frontend</title>` → `<title>AILAS — Learning Analytics System</title>`.

### FX-015 (DEF-18) — Skip-navigation link
**File:** `frontend/src/components/Layout.jsx`  
**Change:** Added visually hidden "Skip to main content" anchor (`sr-only focus:not-sr-only`) as the first child of the root `<div>`. Added `id="main-content"` to `<main>`.

---

## Batch 5 — Frontend UX Polish (LOW risk)

### FX-016 (DEF-22) — Role display name map in sidebar
**File:** `frontend/src/components/Layout.jsx`  
**Change:** Added `ROLE_LABELS` map. Role display now shows "Program Director", "VP for Academic Affairs", etc. instead of raw snake_case values. Removed `capitalize` CSS class that produced "Program_director".

### FX-017 (DEF-24) — Auto-select first enrolled course on StudentDashboard mount
**File:** `frontend/src/pages/StudentDashboard.jsx`  
**Change:** Added `useEffect` hook: when `courses` loads and `selectedCourse` is still `null`, auto-selects `courses[0]`.

### FX-018 (DEF-04) — Login error message visibility (verified + enhanced)
**File:** `frontend/src/pages/Login.jsx`  
**Change:** Error element was already visually correct (`text-red-600` on `bg-red-50`). Added `role="alert"` for screen reader announcement.

### FX-019 (DEF-23) — Rename "Student ID Hash" → "Student ID" in EnrollmentPage
**File:** `frontend/src/pages/EnrollmentPage.jsx`  
**Change:** Table header array and form label updated. The underlying API field `student_id_hash` is unchanged — only the visible label changes.

---

## Batch 6 — Demo Data (MED risk)

### FX-020 (DEF-12) — Seed grade consultations with `academic_status=failed`
**File:** `backend/seed_demo.py`  
**Change:** Added section `[7] Grade Consultations`. Seeds 2 `GradeConsultation` records for IT 101:  
- Julia Bautista (2023-0009): Prelim failed, remediation + retake recommended.  
- Diana Cruz (2023-0003): Midterm failed, counseling referral.  
Imports `GradeConsultation`, `AcademicStatus`, `AdvisingType` from `backend.models.grade_consultation`.  
Idempotent: skips if any consultations already exist.

### FX-021 (DEF-13) — Demo data cleanup (junk assessment + duplicate course)
**File:** `backend/seed_demo.py`  
**Change:** Added pre-cleanup section `[0] Pre-cleanup` that runs before all seed steps:  
1. Deletes any `Assessment` with `title ILIKE 'wer'`.  
2. For each canonical course code (IT 101, GEC 103, CS 201), if duplicates exist, keeps the one with the most assessments and deletes the rest.  
**Usage:** Re-run `python -m backend.seed_demo` before the defense to apply the cleanup.

---

## Files NOT touched (admin pages frozen)
- `frontend/src/pages/AdminDashboard.jsx`
- `frontend/src/pages/UserManagement.jsx`
- All other `/admin/*` page components

## Deferred to POST_DEFENSE_NOTES.md
- React StrictMode double-invocation of effects (dev-only, not a production bug)
- AdminDashboard chart `<figure>` wrapping (frozen page)
- In-memory JTI blacklist not surviving server restarts (Redis upgrade path documented)
