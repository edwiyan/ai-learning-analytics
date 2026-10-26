# AILAS QA Master Report

**Date:** 2026-06-03
**QA Engineer:** Alex (Senior QA — Claude Code)
**System:** AILAS v1.0 — BTECH Capstone (AI-Assisted Learning Analytics System)
**Environment:** Docker Compose (FastAPI + React/Vite + PostgreSQL 16 + Redis), Windows host
**Method:** API-first verification + Playwright UI smoke. Master prompt adapted to the real
system (routes/endpoints/credentials differed — see `ADAPTATION-NOTES.md`).

---

## Executive Summary

**Overall: PASS — defense-ready, with a small punch-list.** Every capstone-critical business
rule was verified correct **at the source and behaviorally**: the deterministic at-risk engine
(≥3 gaps OR >15% decline), the 0.75 confidence/HITL threshold, mastery bands, the SUS scoring
formula, the multi-stage approval chain with bypass protection, RBAC across 6 roles, and RA
10173 pseudonymization (SHA-256, consent gating). Performance is far inside SLA. The system is
in strong shape.

**Findings:** 0 Critical, 0 High, 2 Medium, 4 Low. **All code-fixable findings (BUG-001
through BUG-006) have been fixed and verified in this session.** The only remaining open item
is OBS-2 (rotate the SMTP/OpenAI secrets in `.env`) — a proponent action that cannot be done
from code. Post-fix regression: **40 passed, 1 skipped**.

Total automated app tests run: **40 passed, 1 skipped** (project pytest suite) + ~50 QA probes.

---

## Phase Results

| Phase | Name | Status | Issues |
|---|---|---|---|
| 0 | Environment Validation | ✅ PASS | 1 (BUG-001 ops) |
| 1 | Test Data & Sessions | ✅ PASS | 0 |
| 2 | Smoke Testing | ✅ PASS | 0 (found BUG-002 lead) |
| 3 | Functional Testing | ✅ PASS | 1 (BUG-002) |
| 4 | Security & RBAC | ✅ PASS | 2 Low |
| 5 | Performance | ✅ PASS | 0 |
| 6 | Compatibility | ✅ PASS | 0 |
| 7 | Regression | ✅ PASS | 1 Low |
| 8 | Exploratory | ✅ PASS | 1 Low |
| 9 | Compliance/Privacy | ✅ PASS | 1 Low |

---

## Capstone Compliance Check

| Requirement | Status | Evidence |
|---|---|---|
| BTECH branding (not BASC) | ✅ | phase-7; rendered "BTECH/Baliwag/Politekniko" |
| At-Risk rule exact match (≥3 gaps OR >15% decline) | ✅ | risk-rule-boundaries.txt; risk_predictor.py |
| Mastery bands (≥85 / 75–84 / <75) | ✅ | 02-smoke-student-dashboard.png |
| Confidence ≥0.75 auto-accept, <0.75 HITL | ✅ | assessments.py:74; boundary verified |
| SHA-256 hashed_identifier (10/10) | ✅ | sha256-validation.txt |
| Storage keyed by student_id_hash | ✅ | phase-9 (information_schema) |
| GPT-4o-mini only (no TF-IDF/sklearn) | ✅ | grep — only test comments |
| Dashboard load <3s | ✅ | ~284ms (dashboard-load.txt) |
| API response <5s | ✅ | ≤0.12s (api-response-times.txt) |
| SUS survey functional + correct math | ✅ | score 82.5 (sus-submit/results.json) |
| Approval chain live + bypass-proof | ✅ | self-approve 403; PATCH/status 404 |
| All AI outputs advisory + labeled | ✅ | 09-advisory-labels.png; disclaimer banner |
| Faculty override / human-in-the-loop | ✅ | 09-faculty-override.png (Log/Review) |
| RBAC blocks unauthorized access | ✅ | security-rbac.txt (all 403) |
| RA 10173 consent + no raw IDs (student) | ✅ | 451 consent gate; raw-id-check.txt empty |
| Migration head n4j5k6l7m8n9 | ✅ | migration-status.txt |
| Attendance NOT in risk flag | ⚠️ engine ✅ / UI copy ❌ | BUG-002 |

---

## Bug Register

| ID | Severity | Phase | Description | Status |
|---|---|---|---|---|
| BUG-001 | Medium | 0 | Stale backend Docker image (built before migration `n4j5k6l7m8n9`) crashes on boot vs. an already-migrated DB volume (`Can't locate revision`). Fixed by rebuilding image; document the rebuild step / pin image-DB versioning. | Resolved (env) |
| BUG-002 | Medium (defense-critical) | 3/7 | `InstructorDashboard.jsx:563` stated *"Absence rate is factored into student risk predictions — students above 30% absence are flagged At-Risk."* This was **false** — the engine ignores attendance (Delimitation #2). **FIXED:** copy now reads *"Attendance is recorded for context only — it does not drive the At-Risk flag…"* and states the real rule. Verified rendered (10-bug002-fixed.png). | ✅ Resolved |
| BUG-003 | Low | 7 | API JSON exposed legacy field names `confidence_score`/`needs_review`/`parsed_json` while DB/ERD use `mapping_confidence`/`requires_review`/`llm_structured_output`. **FIXED:** ERD names now emitted additively (schemas via `computed_field`; `/assessments/{id}/items` + `/mapping-queue` dicts) — legacy keys retained for the frontend. Verified in responses. | ✅ Resolved |
| BUG-004 | Low | 4 | Wrong-role authenticated user was redirected to `/login`. **FIXED:** new `/unauthorized` (403) page; `ProtectedRoute` now routes wrong-role users there. Verified: student→/instructor lands on `/unauthorized`. | ✅ Resolved |
| BUG-005 | Low | 4/9 | `GET /auth/me` returned the student's own raw `student_number`. **FIXED:** `/auth/me` now nulls `student_number` for the student role (other roles unaffected). Verified null. | ✅ Resolved |
| BUG-006 | Low | 9 | Admin-creating a student **without** a `student_number` yielded a NULL `hashed_identifier`. **FIXED:** `POST /users/` now 400s if a student account has no `student_number`. Verified (400 without / 201 with). | ✅ Resolved |
| BUG-007 | Medium | UI walk | `/analytics-page` (and latently `/consent`) returned raw backend JSON on direct load/refresh — the Vite dev proxy key `/analytics` (prefix match) caught the SPA route. **FIXED:** proxy keys tightened to `/analytics/` and `/consent/` in `frontend/vite.config.js`. Verified: direct load + hard refresh render the real page; APIs still proxy. | ✅ Resolved |
| OBS-1 | Info | 8 | `DELETE /users/{id}` is a soft-delete (`deactivate_user`, sets `is_active=False`) — by design; name is misleading. | Info (no change) |
| OBS-2 | Low | env | Live SMTP app-password + OpenAI key sit in `.env` (plaintext). Properly gitignored / not in git history. **Action for proponent:** rotate both credentials (cannot be done from code). | Open (user action) |

## Severity Definitions
- **Critical:** crash, data loss, security breach, approval chain broken — **none found**.
- **High:** feature non-functional, SLA breach, wrong business-rule output — **none found**.
- **Medium:** correct behavior but misleading/ops hazard.
- **Low:** cosmetic / hardening / minor wording.

---

## Defense Readiness

**The system is ready for capstone defense.** All four objectives demonstrably work, every
ISO/IEC 25010 / capstone metric checked passes, and the AI is correctly positioned as advisory
with human-in-the-loop. 

**Fix before the demo (ordered):**
1. ~~**BUG-002 (must-fix):** correct the InstructorDashboard attendance sentence~~ — **✅ DONE
   this session.** Copy now states attendance is context-only and does not drive the At-Risk
   flag; rendered + regression-verified.
2. ~~**BUG-001:** rebuild the backend image when migrations change~~ — done this session
   (image rebuilt; note: the `backend` service has **no code volume mount**, so any backend
   code/schema change requires `docker compose build backend` + `up -d backend`, not just a
   restart).
3. ~~Optional polish: BUG-003, BUG-004, BUG-006~~ — **all fixed & verified this session**
   (see bug register).
4. **Remaining (proponent action):** rotate the `.env` SMTP app-password and OpenAI key
   (OBS-2) — cannot be done from code.

---

## Adaptation Note (important)
The supplied `AILAS_QA_MASTER_PROMPT.md` was written against assumed routes/endpoints/
credentials (`/api/v1/*`, `/dashboard`, `faculty@btech.edu`, etc.) that do **not** match the
real system. This engagement preserved the prompt's intent but executed against the actual API
(root-prefixed, e.g. `/analytics/*`, `/surveys/sus`), real routes (`/instructor`, `/student`,
`/syllabus-approval`, `/sus-survey`), and real seeded accounts. Full mapping in
`ADAPTATION-NOTES.md`. No VPAA was thought to be seeded initially, but `vp@ailas.edu` exists.

## Artifacts Index
- Reports: `qa-output/reports/phase-0..9-*.md` + this file + `ADAPTATION-NOTES.md`
- Screenshots: `qa-output/screenshots/` (15 — dashboards, RBAC block, cross-browser, mobile, advisory, empty state)
- API responses: `qa-output/api-responses/` (health, jwt, risk boundaries, sus, courses, etc.)
- Logs: `qa-output/logs/` (migration, auth, smoke-api, security-rbac, sha256, raw-id, pytest)
- Performance: `qa-output/performance/` (api-response-times, dashboard-load)
