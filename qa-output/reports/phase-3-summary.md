# Phase 3 — Functional Testing

**Result: PASS** — all core capstone business rules verified correct. One UI-copy contradiction found (BUG-002).

## 3A — Data Ingestion (Obj 1)
- Project test suite covers CSV parsing & assessment upload: `test_csv_parser.py`,
  `test_assessment_upload.py` — **pass** (part of 40 passed / 1 skipped run).
- Student IDs SHA-256 hashed on ingestion (`hash_student_id`) — see Phase 9.

## 3B — AI Topic Classification (Obj 2)
- Threshold rule (`backend/routers/assessments.py:74`): `needs_review = score < 0.75`.
  - score **0.75 → auto-accept** (needs_review False) ✅ boundary correct
  - score **0.749 → HITL** (needs_review True) ✅
  - threshold sourced from `settings.topic_mapping_confidence_threshold = 0.75` ✅
- `test_topic_mapping.py` — pass.

## 3C — At-Risk Detection Engine (verified by direct engine calls)
`backend/services/ai/risk_predictor.py::_rule_based_risk`, boundaries (`risk-rule-boundaries.txt`):
| Case | Result | Correct? |
|---|---|---|
| 2 gaps, 10% decline | On-Track | ✅ |
| **3 gaps** | At-Risk | ✅ (≥3) |
| 2 gaps, **exactly 15%** decline | On-Track | ✅ (rule is strict `>15`) |
| 2 gaps, 15.01% decline | At-Risk | ✅ |
| avg **85**, 0 gaps | Excelling | ✅ (≥85 & no gaps) |
| avg 84.9, 0 gaps | On-Track | ✅ |
| absence high, 0 gaps/decline | On-Track | ✅ attendance NOT a factor |
- Mastery bands render on student dashboard (Proficient/Developing/Emerging) — screenshot.

### BUG-002 (Medium → defense-critical) — UI claims attendance drives At-Risk
`frontend/src/pages/InstructorDashboard.jsx:563` states: *"Absence rate is factored into student
risk predictions — students above 30% absence are flagged At-Risk."* This is **false**: the engine
ignores attendance (Delimitation #2), and `InterventionAlertsPage.jsx:419` describes the rule
correctly. Misleading copy that contradicts the documented methodology — fix before defense.

## 3D — 3-Phase Approval Workflow
- `POST /syllabi/{id}/approve` enforces: (a) role ∈ APPROVER_ROLES else 403; (b) stage machine
  `APPROVAL_CHAIN[role]` (required_stage → next_stage) — a role can only approve at its stage,
  cannot skip to `fully_approved`.
- **Verified:** instructor self-approve → **403**; bogus `PATCH /syllabi/{id}/status` → **404**
  (no such endpoint — the approval-bypass vector doesn't exist).
- PD/Dean/VPAA pending queues reachable (Phase 2). Assessment approval (5 criteria) & grade
  posting endpoints present (`/assessments/*/approve`, `/grade-submissions/*/approve`).

## 3E — SUS Evaluation (Obj 4)
- `POST /surveys/sus` with prompt's answers → **sus_score = 82.5** (matches hand-calc
  `((q1-1)+(5-q2)+…)*2.5`). Rating "Good", ≥68 ✅.
- Admin `GET /surveys/sus/results` → aggregate (total/avg/min/max/rating/threshold_pct) ✅.
- `compute_sus_score` correct; `sus_rating` bands (Excellent/Good/OK/Poor/Awful) correct.

## Regression suite
- `docker compose exec backend pytest backend/tests/` → **40 passed, 1 skipped** (`pytest-results.txt`).
