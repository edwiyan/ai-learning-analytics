# Fix Plan — Pre-Defense

## Summary
- Findings in scope: 21 (P1: 5, P2: 11, P3: 5)
- Batches: 6
- Estimated total effort: ~7.5 hours
- High-risk batches: 1 (Batch 1 — role boundaries touch auth)
- Out-of-scope items deferred: 3 (see end)
- Open questions for user: 2 (see end)

---

## Batch 1 — Backend Role-Boundary Hardening
**Goal:** Close every missing `require_role` guard so non-student roles cannot call student analytics, and students cannot read assessment items or arbitrary syllabi.  
**Severity profile:** P1 × 2, P2 × 2  
**Risk:** high — touches auth dependency chain used by every authenticated request  
**Effort:** ~2h  
**Files (anticipated):**
- `backend/routers/analytics.py` (lines 72, 101, 118, 146, 180 — five `me/*` endpoints)
- `backend/routers/assessments.py` (line 439 — `get_items`)
- `backend/routers/syllabi.py` (lines 218–219 — `get_syllabus`, plus all `/{syllabus_id}` routes that use bare `str` path param)

| ID | Sev | Description | Effort |
|----|-----|-------------|--------|
| FX-001 | P1 | Add `require_role(UserRole.student)` to all 9 `/analytics/me/*` endpoints in analytics.py | M |
| FX-002 | P1 | Add `require_role(UserRole.instructor, UserRole.admin)` to `GET /assessments/{id}/items` in assessments.py | S |
| FX-003 | P2 | Add `require_role(UserRole.instructor, UserRole.admin, UserRole.program_director, UserRole.dean, UserRole.vp_academic_affairs)` to `GET /syllabi/{id}` in syllabi.py | S |
| FX-004 | P2 | Change `syllabus_id: str` → `syllabus_id: uuid.UUID` on all `/{syllabus_id}` routes in syllabi.py; mirror for any bare-string params in assessments.py | M |

**Test plan:**
- Re-run the role authorization matrix probe from Phase 2 (curl with each of the 6 role tokens) against `GET /analytics/me/courses`, `GET /assessments/{id}/items`, `GET /syllabi/{id}` after the fix.
- Playwright spec `02-security.spec.js` (if it exists) or the curl probe script from the audit.
- Regression risk: any page that currently calls a `me/*` endpoint while logged in as a non-student role will break — but audit confirms only students legitimately call those; non-student roles returning empty arrays is already silently wrong, not functional.

**Risk annotation:**  
FX-001 is the most consequential change. The nine `me/*` endpoints are called by the student dashboard and my-courses page. Adding `require_role(UserRole.student)` means any token that isn't a student JWT gets 403. Before the audit, instructors hitting `/analytics/me/courses` got `[]` (empty) — after the fix they'll get 403, which is correct but a behavior change. The student-facing E2E specs must pass after this.  
FX-004 changing `str → uuid.UUID` changes FastAPI's routing behavior: invalid UUIDs now return 422 (Pydantic validation error) instead of reaching the handler and triggering a SQLAlchemy exception (500). This is strictly safer — but verify that the frontend never passes bare strings to these routes (it doesn't; it always passes IDs from API responses).  
Rollback: revert `analytics.py`, `assessments.py`, `syllabi.py` to the pre-fix state. No DB changes, no migration.

---

## Batch 2 — Frontend Routing Fixes
**Goal:** Fix page refresh breaking on `/users`, `/analytics`, `/resources`; add missing proxy entries for `/surveys` and `/attendance`.  
**Severity profile:** P1 × 1, P2 × 1  
**Risk:** med — `vite.config.js` changes require dev server restart and affect all API calls from the frontend  
**Effort:** ~30min  
**Files (anticipated):**
- `frontend/vite.config.js`

| ID | Sev | Description | Effort |
|----|-----|-------------|--------|
| FX-005 | P1 | Remove `/users`, `/analytics`, `/resources` from Vite proxy (or rename conflicting frontend routes — proxy wins over React Router on hard navigation) | S |
| FX-006 | P2 | Add `/surveys` and `/attendance` to Vite proxy | S |

**Implementation note for FX-005:**  
Two approaches. Approach A (recommended): remove the three paths from the proxy and prefix them with `/api/` on the backend instead — but that changes API URLs and requires updating all axios calls in the frontend. Too broad for this fix.  
Approach B (simpler, zero backend change): keep the proxy entries but rename the frontend React Router routes:
- `/users` → `/user-management` (update `App.jsx` route + `Layout.jsx` navlink)
- `/analytics` → `/analytics-page` (update `App.jsx` + navlinks)
- `/resources` → `/resource-library` (update `App.jsx` + navlinks)

Approach B touches 3 files but has zero backend risk. Approach A requires backend URL changes everywhere. **Recommend Approach B.**

**Test plan:**
- After fix, navigate to each renamed route via URL bar and verify React app renders.
- Navigate in-app via sidebar to same pages and verify.
- Confirm `/api/analytics/*` (or existing `/analytics/*`) API calls still work.
- Regression risk: sidebar links for Users, Analytics, Resources must be updated to new paths.

**Rollback:** Revert `vite.config.js` and `App.jsx` + navlink files.

---

## Batch 3 — Backend Auth & Input Hardening
**Goal:** Raise rate limit, strip XSS from user creation, add logout endpoint, gate docs in non-debug mode.  
**Severity profile:** P2 × 3, P3 × 1  
**Risk:** med — DEF-09 touches `deps.py` and token creation  
**Effort:** ~2h  
**Files (anticipated):**
- `backend/routers/auth.py` (rate limit + logout)
- `backend/core/security.py` (add JTI to token — see note)
- `backend/core/deps.py` (blacklist check — see note)
- `backend/routers/users.py` (full_name sanitization)
- `backend/main.py` (docs gating)

| ID | Sev | Description | Effort |
|----|-----|-------------|--------|
| FX-007 | P2 | Change `@limiter.limit("10/minute")` → `"30/minute"` on the login endpoint in `auth.py:16` | S |
| FX-008 | P2 | Strip HTML tags from `full_name` before saving in `users.py:128`. Use `re.sub(r'<[^>]+>', '', value)` — no new dependency | S |
| FX-009 | P2 | Add `POST /auth/logout` endpoint with in-memory JTI blacklist (see note below) | M |
| FX-010 | P3 | Gate `/docs`, `/redoc`, `/openapi.json` behind `settings.debug` in `main.py` | S |

**FX-009 implementation note (DEF-09 — logout):**  
The `redis` Python package is not in `requirements.txt` and Redis is not wired into the app code (slowapi uses in-memory storage). A proper Redis JTI blacklist requires a new dependency + wiring a Redis client.  
**Proposed approach (no new deps, no migration, sufficient for defense):** In-memory module-level set in `auth.py`:
```python
_revoked_jtis: set[str] = set()
```
Token creation in `security.py` gets a `jti` claim (UUID). `get_current_user` in `deps.py` checks `payload.get("jti") in _revoked_jtis`. Logout endpoint adds the JTI to the set. Revocations are lost on server restart, which is acceptable for a defense-day server session.  
This is strictly cleaner than no logout at all and adds zero dependencies. See open question #1 for whether you want the Redis version instead.

**Test plan:**
- Login, grab token, POST `/auth/logout`, verify that the same token returns 401 on next request.
- Verify login still works at 31 requests/minute (should pass; blocked at 31st only if within the window).
- Verify HTML in `full_name` is stripped in the response from `POST /users/`.
- With `DEBUG=False`, confirm `/docs` returns 404.

**Rollback:** Revert `auth.py`, `security.py`, `deps.py`, `users.py`, `main.py`.

---

## Batch 4 — Accessibility: Critical + Serious
**Goal:** Zero axe `critical` violations; fix WCAG AA color contrast; update page title.  
**Severity profile:** P1 × 2, P2 × 2, P3 × 1  
**Risk:** low — all frontend-only changes to JSX and one HTML file  
**Effort:** ~1.5h  
**Files (anticipated):**
- `frontend/src/components/Pagination.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/StudentDashboard.jsx`
- `frontend/src/pages/AuditLogsPage.jsx`
- All chart-containing pages: `AdminDashboard.jsx`, `InstructorDashboard.jsx`, `MyCoursesPage.jsx`, `StudentDashboard.jsx`
- `frontend/src/components/Layout.jsx`
- `frontend/src/components/StatCard.jsx`
- `frontend/index.html`

| ID | Sev | Description | Effort |
|----|-----|-------------|--------|
| FX-011 | P1 | Add `aria-label` to 5 unlabeled interactive elements: Pagination prev/next buttons, Login password toggle, StudentDashboard course `<select>`, AuditLogsPage date inputs | S |
| FX-012 | P1 | Wrap each Chart.js `<canvas>` in `<figure aria-label="...">` on all 4 chart pages | M |
| FX-013 | P2 | Replace `text-gray-400` with `text-gray-500` on informational text in Layout.jsx (lines 126, 176), Pagination.jsx (line 20), StatCard.jsx (line 13) | S |
| FX-014 | P2 | Change `<title>frontend</title>` → `<title>AILAS — Learning Analytics System</title>` in `frontend/index.html` | S |
| FX-015 | P3 | Add visually-hidden skip-navigation link as first element in Layout.jsx | S |

**Test plan:**
- Re-run `npx playwright test qa-audit/specs/07-a11y.spec.js` — currently 6 failing; target: 0 critical violations (all 6 should pass).
- Manually verify chart pages with a screen reader (or browser accessibility tree inspector) to confirm `<figure aria-label>` is announced.
- Regression risk: minimal — all changes are additive HTML attributes and class swaps.

**Rollback:** Revert affected JSX files and `index.html`.

---

## Batch 5 — Frontend UX Polish
**Goal:** Fix role display names, auto-select student course, verify error message visibility, fix column header jargon.  
**Severity profile:** P2 × 2, P3 × 2  
**Risk:** low — cosmetic and minor behavioral changes  
**Effort:** ~45min  
**Files (anticipated):**
- `frontend/src/components/Layout.jsx`
- `frontend/src/pages/StudentDashboard.jsx`
- `frontend/src/pages/EnrollmentPage.jsx`
- `frontend/src/pages/Login.jsx` (verify only — may need no change)

| ID | Sev | Description | Effort |
|----|-----|-------------|--------|
| FX-016 | P2 | Add role → display-name map in Layout.jsx: `program_director` → "Program Director", `vp_academic_affairs` → "VP for Academic Affairs" | S |
| FX-017 | P2 | Auto-select first enrolled course on StudentDashboard mount (add `useEffect` that sets course when courses load and none is selected) | S |
| FX-018 | P3 | Check Login.jsx wrong-password error state visibility; ensure error message renders in red with sufficient contrast | S |
| FX-019 | P3 | Rename "STUDENT ID HASH" column header to "Student ID" in EnrollmentPage.jsx | S |

**Test plan:**
- Navigate to PD and VP dashboards — confirm sidebar shows "Program Director" / "VP for Academic Affairs".
- Login as student and verify dashboard immediately shows course data (first course pre-selected).
- Enter wrong password on login; verify red error message is visible.
- Navigate to Admin → Enrollment; confirm column header reads "Student ID".

**Rollback:** Revert affected JSX files.

---

## Batch 6 — Demo Data Cleanup
**Goal:** Remove dirty test data; seed at least 1 grade consultation so academic standing features are demonstrable.  
**Severity profile:** P3 × 2  
**Risk:** med — direct DB mutations; wrong query can corrupt demo data  
**Effort:** ~1h  
**Files (anticipated):**
- Database (via psql or FastAPI admin endpoint)
- Optionally: seed script if one exists in `backend/`

| ID | Sev | Description | Effort |
|----|-----|-------------|--------|
| FX-020 | P3 | Seed 1–2 grade consultations with `academic_status=failed` for a student in IT 101; run `upsert_academic_standing` to populate standing table | M |
| FX-021 | P3 | Delete the "wer" assessment; resolve duplicate IT 101 course IDs (rename or delete); ensure demo students have proper user accounts with readable names | M |

**Test plan:**
- After cleanup: log in as instructor Maria Santos, open Grade Consultation page — confirm at least 1 consultation exists.
- Log in as student — verify academic standing shows a warning or probation state.
- Log in as admin — confirm "wer" assessment is gone from the system.
- Regression risk: if FX-021 deletes a course that has FK relationships (enrollments, grades, competencies), cascades could drop legitimate demo data. Query all dependent tables before deleting.

**Rollback:** This is the only batch without a trivial code rollback. Before running any deletes, dump the relevant tables:  
```sql
pg_dump -t assessments -t courses -t enrollments ... ailas > backup_before_cleanup.sql
```

---

## Deferred (post-defense)

| FX | DEF | Reason |
|----|-----|--------|
| — | DEF-11 | Missing feature, not a bug — attendance threshold → auto-intervention trigger was never implemented; fixing it is new functionality, not a regression |
| — | DEF-19 | P3 — route-based code splitting is a non-trivial Vite/React refactor with risk of breaking lazy-load boundaries near the defense |
| — | DEF-20 | P3 — client-side data cache (React Query) would require adding a new dependency; feature improvement, not a bug |

---

## Open Questions for the User

**Q1 — DEF-09 logout implementation approach:**  
The `redis` package is not in requirements.txt and Redis isn't wired into app code. Three options:
- **Option A (recommended):** In-memory JTI blacklist (`set()` in `auth.py`) — zero deps, zero migration, cleared on server restart. Fine for a defense-day session.
- **Option B:** Add `redis` package + wire a real Redis client — proper production-grade solution, but adds a dependency (needs your approval per the scope rules) and requires Redis to be running.
- **Option C:** Skip DEF-09 entirely — the 30-minute token TTL already limits exposure; no logout is a known gap, not a new discovery.

Which do you want?

**Q2 — Batch 2 routing fix approach (DEF-21):**  
For the Vite proxy conflict, the plan proposes renaming frontend routes (`/users` → `/user-management`, `/analytics` → `/analytics-page`, `/resources` → `/resource-library`). This touches `App.jsx` and sidebar navlinks in `Layout.jsx`. Alternatively, the proxy entries can be removed and the API layer changed to use a `/api/` prefix — but that's much broader scope.

Is renaming the frontend routes acceptable? Or do you want a different approach?
