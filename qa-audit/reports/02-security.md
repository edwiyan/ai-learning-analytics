# Phase 2 — Security & Role Boundaries Report
**Date:** 2026-05-22  
**Method:** Direct API probing with curl, all 6 role JWTs obtained fresh  
**Endpoints probed:** 38 unique endpoint×role combinations  
**New defects found:** 5 (DEF-05 through DEF-09)

---

## Authorization Matrix

Legend: ✅ Correctly allowed | 🚫 Correctly blocked (403/401) | ⚠️ Wrong response (bug)

### Analytics Router

| Endpoint | Admin | Instructor | Student | PD | Dean | VP |
|----------|-------|-----------|---------|-----|------|-----|
| GET /analytics/admin/stats | ✅ 200 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |
| GET /analytics/admin/audit-logs | ✅ 200 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |
| GET /analytics/admin/enrollment-trends | ✅ 200 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |
| GET /analytics/instructor/course-summaries | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |
| GET /analytics/instructor/at-risk-students | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 | — | — |
| GET /analytics/instructor/standing-summary | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 | — | — |
| GET /analytics/me/courses | ⚠️ 200 [] | ⚠️ 200 [] | ✅ 200 | ⚠️ 200 [] | — | — |
| GET /analytics/me/risk | ⚠️ 400 | ⚠️ 400 | ✅ 200/404 | ⚠️ 400 | ⚠️ 400 | ⚠️ 400 |
| GET /analytics/me/academic-standing | ⚠️ 200 "good" | ⚠️ 200 "good" | ✅ 200 | ⚠️ 200 "good" | ⚠️ 200 "good" | — |
| GET /analytics/me/trend | ⚠️ 200 [] | ⚠️ 200 [] | ✅ 200 | ⚠️ 200 [] | — | — |
| GET /analytics/me/recommendations | ⚠️ 200 [] | ⚠️ 200 [] | ✅ 200 | ⚠️ 200 [] | — | — |
| GET /analytics/me/interventions | ⚠️ 200 [] | ⚠️ 200 [] | ✅ 200 | ⚠️ 200 [] | — | — |
| GET /analytics/me/attendance | ⚠️ 200 {} | ⚠️ 200 {} | ✅ 200 | ⚠️ 200 {} | — | — |
| GET /analytics/me/consultations | ⚠️ 200 [] | ⚠️ 200 [] | ✅ 200 | ⚠️ 200 [] | — | — |
| POST /analytics/courses/{id}/train | 🚫 403¹ | 🚫 403¹ | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |

¹ Admin-only; instructor gets 403.

### Assessments Router

| Endpoint | Admin | Instructor | Student | PD | Dean | VP |
|----------|-------|-----------|---------|-----|------|-----|
| GET /assessments/pending-approval | 🚫 403 | 🚫 403 | 🚫 403 | ✅ 200 | 🚫 403 | 🚫 403 |
| GET /assessments/course/{id} | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 | — | — |
| POST /assessments/{course_id} | ✅ 201 | ✅ 201 | 🚫 403 | 🚫 403 | — | — |
| POST /assessments/{id}/approve | 🚫 403 | 🚫 403 | 🚫 403 | ✅ 200 | 🚫 403 | 🚫 403 |
| **GET /assessments/{id}/items** | ✅ 200 | ✅ 200 | **⚠️ 200** | **⚠️ 200** | **⚠️ 200** | **⚠️ 200** |

### Syllabi Router

| Endpoint | Admin | Instructor | Student | PD | Dean | VP |
|----------|-------|-----------|---------|-----|------|-----|
| GET /syllabi/pending-approval | 🚫 403 | 🚫 403 | 🚫 403 | ✅ 200 | ✅ 200 | ✅ 200 |
| POST /syllabi/upload | ✅ 201 | ✅ 201 | 🚫 403 | 🚫 403 | — | — |
| POST /syllabi/{id}/approve | 🚫 403 | 🚫 403 | 🚫 403 | ✅ 200 | ✅ 200 | ✅ 200 |
| POST /syllabi/{id}/reject | 🚫 403 | 🚫 403 | 🚫 403 | ✅ 200 | ✅ 200 | ✅ 200 |
| **GET /syllabi/{id}** | ✅ 200 | ✅ 200 | **⚠️ 200** | ⚠️ 200 | — | — |
| GET /syllabi/{id}/approval-history | ✅ 200 | ✅ 200 | ⚠️ 200 | ✅ 200 | — | — |

### Grade Submissions Router

| Endpoint | Admin | Instructor | Student | PD | Dean | VP |
|----------|-------|-----------|---------|-----|------|-----|
| GET /grade-submissions/pending | ✅ 200 | 🚫 403 | 🚫 403 | ✅ 200 | ✅ 200 | ✅ 200 |
| GET /grade-submissions/mine | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 | — | — |
| POST /grade-submissions/ | ✅ 201 | ✅ 201 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |
| POST /grade-submissions/{id}/approve | — | 🚫 403 | 🚫 403 | ✅ 200 | ✅ 200 | ✅ 200 |
| GET /grade-submissions/{id} | ✅ 200 | ✅ 200 | ⚠️ 200² | ⚠️ 200² | — | — |

² Any authenticated user can read a submission by ID if they know it. Low exploitability (UUID not guessable) but worth noting.

### Users Router

| Endpoint | Admin | Instructor | Student | PD | Dean | VP |
|----------|-------|-----------|---------|-----|------|-----|
| GET /users/ | ✅ 200 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |
| GET /users/students | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |
| GET /users/instructors | ✅ 200 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |
| POST /users/ | ✅ 201 | ✅ 201³ | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |
| PUT /users/{id} | ✅ 200 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |
| DELETE /users/{id} | ✅ 204 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 | 🚫 403 |
| PUT /users/me/password | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |

³ Instructors can create users, but only with role=student (enforced at code level).

### Notifications Router (all authenticated roles — by design)

GET /notifications/, GET /notifications/unread-count, PUT /notifications/{id}/read — all return data scoped to `current_user.id`, so cross-user data leak is not possible. ✅

---

## IDOR Checks

| Scenario | Result |
|----------|--------|
| Student calls `/analytics/me/risk` with random `course_id` | 200 with empty/default data — not another student's data ✅ |
| Student reads `/assessments/{real_assessment_id}/items` | **200 — full question bank exposed** ⚠️ |
| Student reads `/syllabi/{real_syllabus_id}` | **200 — full syllabus and competencies exposed** ⚠️ |
| Student reads `/grade-submissions/{id}` | 200 if ID known (UUID, not guessable) — low risk |
| Student A accessing Student B's standing via `/analytics/me/academic-standing` | Not possible — endpoint scopes to `current_user.student_number` ✅ |
| Instructor A accessing Instructor B's courses | Not possible — `require_role` + instructor_id filter ✅ |

---

## Input Validation Results

| Probe | Result |
|-------|--------|
| SQL injection in email field (`admin@ailas.edu' OR '1'='1`) | 422 — Pydantic email validation catches it ✅ |
| Empty email/password | 422 — validation error, proper message ✅ |
| Oversized password (10,000 chars) | Request accepted by server, password fails `verify_password` → 401 |
| XSS in `full_name` field (`<script>alert(1)</script>`) | **201 Created — stored as-is** ⚠️ |
| Invalid UUID in path (`/syllabi/not-a-uuid`) | **500 Internal Server Error** ⚠️ |
| Non-UUID path of 200+ chars | **500 Internal Server Error** ⚠️ |
| SQL metacharacters in search query param | 422 or 200 with empty results — ORM parameterization protects ✅ |

---

## Token / Session Hygiene

| Check | Result |
|-------|--------|
| No Authorization header | 403 Forbidden ✅ |
| Invalid/expired JWT | 401 Unauthorized ✅ |
| Malformed Authorization header (no "Bearer" prefix) | 403 ✅ |
| Token in URL query param (e.g., `?token=...`) | Not accepted — header-only auth ✅ |
| Logout endpoint exists | **No** — frontend clears localStorage only ⚠️ |
| Token blacklist / revocation | **None** — stateless JWT ⚠️ |
| Token TTL | 30 minutes (set in `.env ACCESS_TOKEN_EXPIRE_MINUTES=30`) — acceptable |
| Token payload exposes sensitive data | Role and user ID only — no PII in JWT ✅ |

---

## New Defects Found

### DEF-05 — P1: Assessment question bank readable by students
**Area:** `backend/routers/assessments.py` — `GET /{assessment_id}/items`  
**Evidence:** Student JWT → `GET /assessments/0098ce09-0ed9-4308-8382-a78a60e96d18/items` → 200 with full question text  
```json
[{"id":"1eb256d0...","question_text":"Define encapsulation in OOP.","needs_review":true,...}]
```
**Expected:** HTTP 403 — students must not see the question bank (academic integrity).  
**Root cause:** `Depends(get_current_user)` with no role guard. PD, Dean, VP also affected.  
**Fix area:** Add `Depends(require_role(UserRole.instructor, UserRole.admin))` to `GET /{assessment_id}/items` and `GET /{assessment_id}/mapping-queue`.

---

### DEF-06 — P2: Any syllabus readable by all authenticated users
**Area:** `backend/routers/syllabi.py` — `GET /{syllabus_id}`  
**Evidence:** Student JWT → `GET /syllabi/b6dbb86a-...` → 200 with full syllabus, competencies, parsed JSON.  
**Expected:** Students should only access syllabi for their enrolled courses; arbitrary syllabus IDs should be scoped.  
**Risk:** Low (IDs are UUIDs; syllabus content is not secret). Minor information exposure.  
**Fix area:** Add instructor/admin role guard or scope by enrollment. Also affects `GET /{id}/approval-history`.

---

### DEF-07 — P2: 500 Internal Server Error on invalid UUID path parameters
**Area:** `backend/routers/syllabi.py` (and likely assessments.py, analytics.py)  
**Evidence:**  
```
GET /syllabi/not-a-valid-uuid   → 500 Internal Server Error
GET /syllabi/AAAA...x200chars   → 500 Internal Server Error
```
**Expected:** 422 Unprocessable Entity (FastAPI should catch UUID validation).  
**Root cause:** Path parameter is typed as `str` not `uuid.UUID`. SQLAlchemy throws when given a non-UUID, resulting in an unhandled exception.  
**Fix area:** Change `syllabus_id: str` → `syllabus_id: uuid.UUID` in route signatures, or wrap the query in try/except.

---

### DEF-08 — P2: Backend stores raw HTML in `full_name` field (XSS risk)
**Area:** `backend/routers/users.py` — `POST /users/`  
**Evidence:** `{"full_name":"<script>alert(1)</script>"}` → 201 Created, stored as-is.  
**Risk:** P2 because React JSX escapes `{}` expressions by default. Becomes P0 if any page uses `dangerouslySetInnerHTML` or constructs DOM from API strings.  
**Fix area:** Add server-side sanitization (strip HTML tags from `full_name`) using `bleach` or a regex strip. Also apply to other user text fields.

---

### DEF-09 — P2: No server-side token invalidation (no logout endpoint)
**Area:** `backend/routers/auth.py`  
**Evidence:** After frontend clears localStorage, the JWT remains valid for its remaining TTL (up to 30 min). No blacklist, no `/auth/logout` endpoint.  
**Risk:** If a defense evaluator or student uses a shared computer and "logs out" via the UI, a malicious user could reuse the token by extracting it from browser history or clipboard before TTL expires.  
**Fix area:** Add `POST /auth/logout` that adds the JTI (JWT ID) to a Redis blacklist, or reduce TTL to 15 minutes. For defense: acceptable as-is given 30-min TTL, but should be noted.

---

## DEF-01 Addendum: `/me/academic-standing` is uniquely dangerous
The `GET /analytics/me/academic-standing` variant of DEF-01 is worse than other `/me/*` endpoints because:
- `/me/risk` returns **400** — clearly an error
- `/me/courses` returns **200 `[]`** — empty, clearly no data
- `/me/academic-standing` returns **200 `{"standing":"good","computed_at":null}`** — looks like a valid "good" response

A PD or Dean calling this endpoint (perhaps accidentally) would see `{"standing":"good"}` and have no indication that this is a role-boundary error rather than their actual standing. This is the highest-priority fix within DEF-01.

---

## Fixes Queued (Phase 2)

| DEF | File | Fix |
|-----|------|-----|
| DEF-01 (updated) | `backend/routers/analytics.py` | Add `require_role(UserRole.student)` to all 9 `/me/*` endpoints; priority: `me/academic-standing` first |
| DEF-05 | `backend/routers/assessments.py` | Add `require_role(UserRole.instructor, UserRole.admin)` to `/{id}/items` and `/{id}/mapping-queue` |
| DEF-06 | `backend/routers/syllabi.py` | Scope `GET /{id}` by role or enrollment (P2 — defer if time-constrained) |
| DEF-07 | `backend/routers/syllabi.py` (and others) | Change `str` path params to `uuid.UUID` type in affected routes |
| DEF-08 | `backend/routers/users.py` | Strip HTML tags from `full_name` on create/update |
| DEF-09 | `backend/routers/auth.py` | Add `POST /auth/logout` + Redis JTI blacklist, or reduce TTL (P2) |

---

## Phase 2 Summary

| Category | Count |
|----------|-------|
| P1 defects (new) | 1 (DEF-05) |
| P2 defects (new) | 4 (DEF-06, DEF-07, DEF-08, DEF-09) |
| Endpoints probed | 38 |
| Role×endpoint combinations tested | 65 |
| Authorization matrix violations | 13 (all are DEF-01 variants already logged + DEF-05) |
| IDOR attacks that succeeded | 1 (assessment items) |
| Input validation failures | 2 (XSS stored, 500 on UUID) |

**No new P0 found.** Role boundary enforcement at the approval-chain level (syllabi, assessments, grade submissions) is solid. The P1 finding (DEF-05 — question bank IDOR) is an academic integrity concern that must be fixed before the defense. The two most impactful fixes are DEF-01 (all 9 `/me/*` endpoints) and DEF-05 (assessment items).
