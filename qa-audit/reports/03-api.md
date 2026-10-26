# Phase 3 — API Contract & Integration Report
**Date:** 2026-05-22  
**Method:** OpenAPI sweep, cross-sprint chain probes, latency benchmarks (20 req per endpoint)  
**Endpoints benchmarked:** 16  
**New defects found:** 4 (DEF-10 through DEF-13)

---

## OpenAPI / Swagger Audit

| Check | Result |
|-------|--------|
| `/docs` accessible | Yes — HTTP 200 (no auth required) |
| `/openapi.json` accessible | Yes — HTTP 200 (no auth required) |
| `/redoc` accessible | Yes — HTTP 200 (no auth required) |
| All 106 routes documented | Yes — FastAPI auto-generates from route definitions |
| Response shapes match actual responses | Yes — spot-checked 8 key endpoints |
| Required fields enforced by Pydantic | Yes — 422 on missing required fields |
| Error responses have consistent shape | Yes — `{"detail": "..."}` across all routers |

**DEF-10 (P3): OpenAPI docs exposed without authentication**  
`/docs`, `/openapi.json`, `/redoc` are publicly accessible. Any user who can reach port 8000 can view the full API surface, all schema definitions, and endpoint descriptions.  
For defense: low risk since the defense panel will be local-network only. For production deployment: should be restricted.

---

## Response Shape Audit

| Endpoint | Expected Fields | Actual Fields | Match |
|----------|----------------|---------------|-------|
| GET /auth/me | id, email, full_name, role, student_number | id, email, full_name, role, student_number | ✅ |
| GET /analytics/me/risk | risk_level (str), confidence (float), weak_competency_ids (list) | Matches | ✅ |
| GET /analytics/instructor/course-summaries | course_id, course_code, course_title, total_students, failing_count, failure_rate, avg_score, formative_avg, summative_avg | Matches | ✅ |
| GET /analytics/admin/stats | total_users, total_students, total_instructors, total_courses, total_syllabi, total_resources | Matches | ✅ |
| GET /notifications/ | id, type, title, message, related_id, is_read, created_at | Matches | ✅ |
| GET /analytics/instructor/standing-summary | warning, probation, dismissal_risk, students[] | Matches | ✅ |
| GET /grade-submissions/pending | GradeSubmissionResponse shape | Matches | ✅ |
| GET /syllabi/pending-approval | SyllabusResponse shape | Matches | ✅ |

All spot-checked response shapes match their documented schemas. No contract violations found.

**Note:** `GET /auth/me` returns only `['id', 'email', 'full_name', 'role', 'student_number']` for the student role. Optional nullable fields (college, is_active, year_level, program, section) are present in the Pydantic schema but return `null` — this is correct Pydantic behavior, not a contract violation.

---

## Cross-Sprint Integration Checks

### S04 Syllabus → S05 Assessment Approval Chain
| Step | Check | Result |
|------|-------|--------|
| Syllabus uploaded → `status=pending` | Endpoint exists and works | ✅ |
| PD/Dean/VP approval chain progresses stage | `approval_stage` transitions: pending_pd → pending_dean → pending_vp → fully_approved | ✅ |
| Instructor can submit-for-review only from draft/rejected stages | Stage guard enforced in `submit_for_review` | ✅ |
| Assessment upload blocked until PD-approved | `assessment.approval_status != approved` → 403 with clear message | ✅ |
| Validated syllabus (CS 201) has 4 assessments in draft | Chain exists; approval not yet walked in demo data (expected for seeded data) | ✅ |

### S05 Grades → S09 Grade Consultation Chain  
| Step | Check | Result |
|------|-------|--------|
| Grade consultation endpoint exists | `POST /analytics/courses/{id}/consultations` | ✅ |
| Consultation fields include `academic_status` | `AcademicStatus` enum: passed, failed, incomplete, dropped | ✅ |
| Consultation triggers `upsert_academic_standing` | Called on `body.academic_status` set | ✅ |
| Academic standing thresholds | warning=1 fail/drop, probation=2 fails, dismissal_risk=3+ fails | ✅ |
| No consultations in demo data | IT 101 has 0 consultations → standing shows all "good" | ⚠️ DEF-12 |

### T5-D Academic Standing Model
| Check | Result |
|-------|--------|
| `AcademicStanding` model exists | ✅ |
| `upsert_academic_standing` called from consultation POST | ✅ |
| `GET /analytics/me/academic-standing` returns student standing | ✅ (for student role) |
| `GET /analytics/instructor/standing-summary` returns instructor view | ✅ |
| Standing math correct (code-verified) | warning ≥1 fail/drop, probation ≥2 fail, dismissal_risk ≥3 fail | ✅ |
| Demo data exercises this chain | No consultations recorded → all students show "good" | ⚠️ (demo quality) |

### S08 Attendance → Intervention Threshold
| Check | Result |
|-------|--------|
| Attendance router exists at `/attendance` | ✅ |
| Instructor can POST bulk attendance records | ✅ |
| Student can view own attendance via `/analytics/me/attendance` | ✅ |
| Automatic intervention trigger on attendance threshold | Not found — attendance and interventions are separate, threshold logic not auto-triggered | ⚠️ DEF-11 |

---

## API Latency Baseline (20 requests each)

| Endpoint | Avg | p50 | p95 | Flag |
|----------|-----|-----|-----|------|
| GET /auth/me | 222ms | 217ms | 270ms | OK |
| GET /analytics/me/courses | 235ms | 231ms | 304ms | OK |
| GET /analytics/me/risk | 231ms | 227ms | 266ms | OK |
| GET /analytics/me/competency-scores | 240ms | 240ms | 250ms | OK |
| GET /analytics/me/academic-standing | 223ms | 222ms | 238ms | OK |
| GET /analytics/me/trend | 236ms | 236ms | 241ms | OK |
| GET /analytics/me/recommendations | 230ms | 231ms | 232ms | OK |
| GET /analytics/instructor/course-summaries | 254ms | 253ms | 273ms | OK |
| **GET /analytics/instructor/at-risk-students** | **658ms** | **638ms** | **889ms** | **P2-WARN** |
| GET /analytics/courses/{id}/overview | 253ms | 254ms | 258ms | OK |
| GET /analytics/courses/{id}/students | 285ms | 286ms | 292ms | OK |
| GET /analytics/courses/{id}/risk-trend | 223ms | 225ms | 227ms | OK |
| GET /analytics/courses/{id}/topic-mastery | 224ms | 224ms | 229ms | OK |
| GET /analytics/admin/stats | 235ms | 235ms | 240ms | OK |
| GET /syllabi/mine | 244ms | 244ms | 261ms | OK |
| GET /notifications/ | 224ms | 223ms | 233ms | OK |

**Note:** Latency measured locally (loopback), with small seeded dataset (3–8 students per course). Real-world performance with larger datasets will be higher — the at-risk endpoint especially, since it runs `predict_risk()` (ML inference) for every student in every assigned course in a single synchronous request.

**Baseline vs quality target:** Project doc states p95 ≤ 3 seconds — all endpoints within target even with the at-risk outlier. ISO/IEC 25010 target is met.

---

## New Defects Found

### DEF-10 — P3: OpenAPI docs publicly accessible without authentication
**Area:** `backend/main.py` (FastAPI app init)  
**Evidence:** `GET /docs` → 200 (no auth header required).  
**Risk:** Exposes full API surface, schema definitions, and parameter names to unauthenticated visitors on the same network. During a defense demo on a shared network, panel members or other students could enumerate the entire API.  
**Fix area:** Pass `docs_url=None, redoc_url=None` to `FastAPI()` in production, or add middleware to require a token on `/docs`.  
**For defense:** Low priority — defense will be local and the panel should see the API docs. Can defer.

---

### DEF-11 — P2: No automatic attendance-threshold intervention trigger
**Area:** `backend/routers/attendance.py`, `backend/services/`  
**Evidence:** Attendance records are stored but no automatic logic creates an `InstructorIntervention` when a student's absence rate crosses a threshold. Instructors must manually create interventions. The system documentation and sprint history (S08) implies this automation exists but it is not implemented.  
**Impact:** The "early warning" feature is manual-only. Students with high absence rates are not automatically flagged.  
**Fix area:** In `attendance.py` `bulk_create_records()`, after saving, compute the student's absence rate and auto-create an `InstructorIntervention` if it exceeds a threshold (e.g., ≥ 3 absences or ≥ 20% absence rate). Alternatively, document this as manual-only.

---

### DEF-12 — P3: Demo data has no grade consultations or academic standing entries
**Area:** Database seed data  
**Evidence:** IT 101 has 3 students with risk data but 0 consultations → academic standing summary shows 0 flagged students. The T5-D banner on StudentDashboard and InstructorDashboard will never trigger during a live demo without this data.  
**Risk:** Defense panel will not see the academic standing feature work live.  
**Fix area:** Seed at least 1–2 grade consultations with `academic_status=failed` for a student in IT 101 to trigger the standing chain. Run `upsert_academic_standing` to populate the academic_standing table.

---

### DEF-13 — P3: Dirty test data visible in API responses
**Area:** Database  
**Evidence:**  
- Assessment titled **"wer"** exists in IT 101 (`approval_status=approved`) — clearly a keyboard accident during manual testing.
- IT 101 student roster shows **"Student 198abbd2…"** (hash-only, no user account) — 2 of 3 students are anonymous hashes, not named users.
- Student's IT 101 (`4af17804-...`) is a different course ID from the instructor's IT 101 (`b7e71cd0-...`) — two courses with the same code exist.
**Risk:** During a defense demo, these data quality issues are immediately visible and embarrassing.  
**Fix area:** 
1. Delete/rename the "wer" assessment via admin panel or direct DB cleanup.
2. Ensure demo students have proper user accounts with `student_number` mapped to the hashed score data.
3. Consolidate or rename duplicate IT 101 courses.

---

## Fixes Queued (Phase 3)

| DEF | File / Area | Fix |
|-----|-------------|-----|
| DEF-10 | `backend/main.py` | Conditionally disable /docs in non-debug environments (defer for defense) |
| DEF-11 | `backend/routers/attendance.py` | Add absence-rate threshold check after bulk save → auto-create intervention |
| DEF-12 | Database / seed data | Add consultation + academic standing records for demo student |
| DEF-13 | Database | Delete "wer" assessment; reconcile student hashes with user accounts |

---

## Phase 3 Summary

| Category | Count |
|----------|-------|
| P2 defects (new) | 1 (DEF-11 — no auto attendance trigger) |
| P3 defects (new) | 3 (DEF-10, DEF-12, DEF-13) |
| Endpoints benchmarked | 16 |
| Response shape violations | 0 |
| Cross-sprint integration chains verified | 4 |
| Latency P2 outliers (p95 > 500ms) | 1 (at-risk endpoint: 889ms p95) |
| Latency P1 outliers (p95 > 2000ms) | 0 |

**No new P0 or P1 found.** API contracts are clean and consistent. All approval chains enforce their stage gates correctly. The at-risk endpoint is the only latency concern, and it is within the project's 3-second quality target. The most actionable findings are the dirty test data (DEF-13) and missing demo data for T5-D (DEF-12).
