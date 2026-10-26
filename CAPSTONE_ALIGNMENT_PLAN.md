# Capstone Alignment Plan

Brings the system in line with the capstone document **MJCO_CAPSTONE_92726.docx** (May 15, 2026).
Source of the gaps: the doc-vs-system cross-check done on 2026-10-26.

## How to use this file

- Work **one task per session** (or per commit). Each task is small enough to finish without losing context.
- To resume, say: **"Continue CAPSTONE_ALIGNMENT_PLAN.md — next task"** (or name one, e.g. `T2.1`).
- Claude reads this file first, does the task, runs the tests, ticks the box, and adds a line to the **Progress log** at the bottom.
- Tasks inside a phase are ordered; later tasks may depend on earlier ones (noted as *Depends on*).
- Every backend change that touches the schema gets its own Alembic migration (latest head: `o5k6l7m8n9o0`).
- Baseline check after every task: `pytest backend/tests/ -q` and `cd frontend && npm run build`.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped (descoped in the doc instead)

---

## Decisions to confirm

Recommended defaults are already used in the tasks below. Change them here if you disagree.

| ID | Question | Recommended default |
|---|---|---|
| D1 | Web Push and Twilio SMS (§3.5): build them, or descope them in the doc? | **Descope.** Keep in-app + SMTP email, and list Push/SMS as future work in the doc. Twilio costs money and needs a verified number. |
| D2 | Gemini fallback (§3.9.2): build it, or descope it? | **Build behind a flag.** It only runs when `GEMINI_API_KEY` is set, so it costs nothing until it is used. |
| D3 | Legacy `.doc` (binary Word) uploads? | **Descope.** Change the doc wording to "PDF/DOCX". Supporting `.doc` needs LibreOffice in the container. |
| D4 | Phase 1/2 AI features (alignment check, difficulty predictor): the doc says these are post-pilot | **Build a light version** (Phase 7) only if time allows after Phases 1–6 and 8. |
| D5 | Frontend tests: the doc says **Jest** | **Vitest** (Jest-compatible API, native to Vite). Name it in the doc as "Vitest (Jest-compatible)", or swap to Jest if the panel insists. |
| D6 | The repo has **no commits yet** | Make an initial baseline commit before starting (T0.1), so every task can be reviewed and reverted. |

---

## Phase 0 — Baseline

- [x] **T0.1 Baseline commit.** Review `.gitignore` (exclude logs, `*.db`, `~$*.docx`, `qa-output/`, `.playwright-cli/`), then make the initial commit on a branch. *Needs your go-ahead.*
- [x] **T0.2 Test baseline.** Run pytest and the frontend build, and record the pass/fail counts in the progress log, so later regressions are visible.

## Phase 1 — Correctness and security (doc §3.8.2, §3.9.1)

- [x] **T1.1 Ownership check on mapping overrides.**
  `PUT /assessments/items/{id}/tag` and `/revert` must call `_assert_course_access` the way upload does. Also check that `competency_id` belongs to the course's validated syllabus.
  Files: `backend/routers/assessments.py`, `backend/tests/test_authorization.py`.
  Done when: another instructor gets a 403; tests cover this.
- [x] **T1.2 Salted student-ID hash** — `SHA-256(Student_ID + Salt)`, as in §3.9.1.
  Add `STUDENT_ID_SALT` to the settings and `.env.example`, and update `hash_student_id()`. Write a migration that re-hashes every `student_id_hash` / `hashed_identifier` column, using `users.student_number` as the source and an old→new hash map.
  Files: `backend/core/config.py`, `backend/core/security.py`, new migration, `.env.example`, tests.
  Done when: hashes differ from plain SHA-256, existing demo data still links up after the migration, and the CSV upload test passes.
- [x] **T1.3 CMS formula = ΣScore / ΣMax × 100** (§3.8.2), instead of the current average of item percentages.
  Files: `backend/services/ai/feature_engineering.py` (`competency_scores`), `test_risk_predictor.py`, `test_risk_f1.py`.
  Done when: there is a unit test with items that have different max scores, and the F1 guard still passes.
- [x] **T1.4 Keep `competency_mastery` up to date.**
  Today it is only filled by `seed_demo.py`. Call `recompute_competency_mastery()` at the end of `_run_topic_mapping`, after `override_tag` / `revert`, and after a CSV upload where every item was pre-tagged.
  Files: `backend/routers/assessments.py`.
  Done when: uploading a CSV produces `competency_mastery` rows without running the seed script.

## Phase 2 — Human-in-the-loop and mapping audit (doc §3.6.2)

- [x] **T2.1 Keep the original AI suggestion.**
  Add `ai_suggested_competency_id`, `ai_confidence` and `ai_mapped_at` to `assessment_items`, plus a migration. `_run_topic_mapping` writes these, and overrides never touch them.
  Files: `backend/models/assessment.py`, migration, `backend/routers/assessments.py`.
- [x] **T2.2 Log every override.**
  `override_tag` / `revert` call `log_action(...)` with the old and new competency and a `reason` (optional query or body field). Expose `override_action` = accepted | reassigned | custom.
  *Depends on* T2.1.
- [x] **T2.3 Mapping accuracy audit report.**
  `GET /assessments/course/{course_id}/mapping-accuracy` returns the reviewed item count, items where the AI matched the final tag, accuracy %, and a per-competency breakdown, with the 85% target. Add a summary card on `TopicMappingPage.jsx`.
  *Depends on* T2.1. Tests: accuracy calculation.
- [x] **T2.4 Faculty-created custom topic tags.**
  `POST /syllabi/{syllabus_id}/competencies` (instructor who owns the course) creates a competency with `source = "faculty"`. Add a "Create new tag" option in the review dropdown on `TopicMappingPage.jsx`.
  Files: `backend/models/syllabus.py` (+ `source` column), migration, `backend/routers/syllabi.py`, frontend.

## Phase 3 — At-Risk alerts and notifications (doc §3.8.2 "faculty alert + student notification", §3.5)

- [x] **T3.1 Persist risk snapshots.**
  Add `services/ai/risk_snapshot.py: refresh_course_risk(course_id, db)`. It runs `predict_risk` for every student and writes a `RiskPrediction` row whenever the level changes, then returns the transitions. Call it wherever T1.4 recomputes mastery.
- [x] **T3.2 In-app alerts when a student becomes At-Risk.**
  For each transition into At-Risk, `notify()` the course instructor and the student user (resolved via `users.hashed_identifier`). The message states the reason (number of gaps and/or % decline). Do not repeat the alert while the student stays At-Risk.
  *Depends on* T3.1.
- [x] **T3.3 SMTP email for At-Risk alerts.**
  Refactor `core/email.py` into a generic `send_email(to, subject, html)`, and send the T3.2 alerts by email when SMTP is configured. If it isn't, skip quietly and log.
- [-] **T3.4 Web Push** — descoped per D1 (doc edit in T9.1).
- [-] **T3.5 Twilio SMS** — descoped per D1 (doc edit in T9.1).

## Phase 4 — Feedback loop and interventions (doc §2.3 Feedback Loop, §3.4 Interventions)

- [x] **T4.1 Student feedback on recommendations.**
  New table `recommendation_feedback` (student hash, resource_id, helpful bool, comment, created_at). Add `POST /analytics/me/recommendations/{resource_id}/feedback`, thumbs up/down on the student dashboard recommendation cards, and a helpfulness % on `ResourcesPage.jsx` for faculty.
- [x] **T4.2 Interventions table: AI feedback and status** (§3.4).
  Add `ai_feedback` (the encouragement text the recommender generated) and `status` (open | in_progress | resolved) to `instructor_interventions`. Add `PUT /interventions/{id}/status` and a status selector in `InterventionAlertsPage.jsx`.

## Phase 5 — LLM robustness (doc §3.9.2 mitigation matrix)

- [x] **T5.1 Prompt library and input sanitization.**
  Move `PARSE_PROMPT`, `MAP_PROMPT` and the encouragement prompt into `services/ai/prompts.py`, add 2–3 few-shot examples to the mapping prompt, and add `sanitize(text)` (strip control characters, cap length, neutralise "ignore previous instructions"-style injections in question text).
- [x] **T5.2 Single LLM client + response cache.**
  `services/ai/llm_client.py: complete_json(prompt, ...)` is used by the parser, mapper and recommender. Cache results in a new `llm_cache` table, keyed by `sha256(model + prompt)`, so identical prompts return the stored answer (deterministic output).
  *Depends on* T5.1.
- [x] **T5.3 Retry and circuit breaker.**
  Inside `llm_client`: retry with backoff (2 attempts), open the circuit after N consecutive failures for M seconds, and while it is open fail fast. Callers then fall back as they do today: the rule-based syllabus parser, or the manual-review queue for mapping. Show a "AI temporarily unavailable" banner via `/health` → `llm_status`.
- [x] **T5.4 Gemini fallback (D2).**
  If OpenAI fails and `GEMINI_API_KEY` is set, retry once with Gemini (JSON mode). Record which provider answered in the cache row. Add a test with mocked providers.

## Phase 6 — Ingestion measurements (doc §3.1 Objective 1)

- [x] **T6.1 Record parse time and success rate.**
  Time syllabus extraction and parsing and CSV parsing, and store `processing_ms` and `parse_ok` (audit log extra or columns). Add `GET /analytics/admin/ingestion-stats` (success %, median/p95 ms against the 2 s target) and a card on the admin dashboard.
- [-] **T6.2 Legacy `.doc` support** — descoped per D3.

## Phase 7 — Optional: Phase 1/2 workflow AI (doc §3.11.2, post-pilot) — D4

- [x] **T7.1 Assessment difficulty/misalignment hints.**
  On the assessment approval view, compare item Bloom levels and mapped competencies against the TOS and flag items whose competency isn't in the TOS, or whose Bloom level is far from the TOS target. Advisory only.
- [x] **T7.2 Syllabus alignment check.**
  On the syllabus approval view, have the LLM check the extracted CLOs against the program's outcomes (from `programs`). Advisory only.

## Phase 8 — Testing and deployment (doc §3.5 Testing / Security rows)

- [x] **T8.1 Frontend unit tests (Vitest, D5).**
  Add vitest + @testing-library/react and an `npm test` script. Cover `RiskBadge`, `ProtectedRoute`, `AuthContext` and the mastery-level helper. Add the step to CI.
- [x] **T8.2 JMeter load test.**
  Add `qa/jmeter/ailas.jmx` (login → dashboards → at-risk list, 50 users). Save the results to `qa-output/performance/`.
- [x] **T8.3 OWASP ZAP baseline scan.**
  Run `zap-baseline.py` via Docker against the running stack, save the report in `qa-output/security/`, and fix or triage the findings.
- [x] **T8.4 TLS 1.3 in production Nginx.**
  Add a 443 server block (`ssl_protocols TLSv1.3`, certs from `nginx/certs`) and enable the HTTP→HTTPS redirect. Document self-signed cert generation for the pilot.
- [x] **T8.5 Measure the remaining targets.**
  Re-run the dashboard (< 3 s) and API (< 5 s) measurements after Phases 1–5, plus LLM mapping-batch latency (< 5 s).

## Phase 9 — Document updates (for the proponent; Claude drafts the text)

- [ ] **T9.1 Draft the capstone doc edits:**
  - Stack versions: FastAPI 0.115, React 19, PostgreSQL 16, Python 3.12, pdfplumber, python-jose, Vitest.
  - Descoped items (Push/SMS, `.doc`) moved to future work.
  - Fix §2.1.20 (TF-IDF/Cosine), §2.1.8 (Random Forests), "ten platforms" → twenty, Flask-only §2.2.2, PDF/DOC → PDF/DOCX, the sign of the §3.8.2 grade-decline formula, unused references (scikit-learn, Redis, Matplotlib, Seaborn, NLTK, Transformers), and "No tables" in the List of Tables.
  - Optionally add a short section on extra modules (curricula, attendance, consent, audit logs, exam generator).
- [ ] **T9.2 Final re-check.** Re-run the doc-vs-system cross-check and update the status reports.

---

## Progress log

| Date | Task | Result / notes |
|---|---|---|
| 2026-10-26 | — | Plan created from the cross-check. |
| 2026-10-26 | T0.1 | Baseline commit 89a7df0 on branch capstone-alignment; .gitignore extended (logs, *.db, QA artifacts). |
| 2026-10-26 | T0.2 | Baseline: pytest 62 passed / 1 skipped / 6 xfailed; frontend build OK. |
| 2026-10-26 | T1.1 | tag/revert now check course ownership + competency belongs to course's validated syllabus (422). Removed Finding-3 xfail; added test_mapping_review.py. |
| 2026-10-26 | T1.2 | SHA-256(id+STUDENT_ID_SALT); migration p6l7m8n9o0p1 + core/rehash.py + scripts/rehash_student_ids.py. Local DB backed up to backups/, salt added to .env, migrated (240 scores, 9 enrollments, 60 mastery, 10 users re-keyed, 0 orphans). |
| 2026-10-26 | T1.3 | competency_mastery_score() = SUM(score)/SUM(max)x100 used in feature_engineering + topic-mastery-distribution; F1 guard still green. |
| 2026-10-26 | T1.4 | services/analytics_refresh.py (per-course lock) runs after topic mapping, override and revert. Also fixed: pre-tagged CSV scores never got competency_id. |
| 2026-10-26 | T2.1 | assessment_items.ai_suggested_competency_id/ai_confidence/ai_mapped_at (migration q7m8n9o0p1q2, backfilled for unvalidated AI maps); exposed in /items. |
| 2026-10-26 | T2.2 | mapping_override / mapping_revert audit logs (old/new/AI pick/confidence/reason); override_action accepted|reassigned|custom|manual in /items + tag response; reason box + true AI pick in OverrideDrawer. |
| 2026-10-26 | T2.3 | GET /assessments/course/{id}/mapping-accuracy (reviewed vs AI pick, 85% target, by competency/action) + MappingAccuracyCard. Also fixed UI '70%' confidence labels/thresholds to 0.75 (TopicMapping, ProcessingInterface). |
| 2026-10-26 | T2.4 | competencies.source (migration r8n9o0p1q2r3); POST /syllabi/courses/{id}/competencies (owner only, auto FAC-NN code, 409 on dup); 'Create a new topic tag' form in OverrideDrawer. |
| 2026-10-26 | T3.1 | services/ai/risk_snapshot.py writes RiskPrediction on level change and returns transitions; run inside refresh_course_analytics. |
| 2026-10-26 | T3.2 | services/risk_alerts.py: on transition into At-Risk, in-app notify instructor (student_at_risk) + student (at_risk_alert) with Table 3.8.2 reason; no repeat while still At-Risk; bell icons added. |
| 2026-10-26 | T3.3 | core/email.py: smtp_configured()+send_email(); enrollment welcome reuses it; At-Risk alerts emailed to instructor+student when SMTP set (HTML-escaped). T3.4/T3.5 stay descoped (D1). |
| 2026-10-26 | T4.1 | recommendation_feedback table (s9o0p1q2r3s4), POST /analytics/me/recommendations/{id}/feedback (upsert), my_feedback on recs, helpful counts on /analytics/resources; thumbs on StudentDashboard + counts on ResourcesPage. Also now shows the GPT encouragement message (was generated but never displayed). |
| 2026-10-26 | T4.2 | instructor_interventions.ai_feedback/status/status_updated_at (t0p1q2r3s4t5); AI feedback stored on create; PUT /analytics/interventions/{id}/status (owner/admin); status selector + AI line on InstructorDashboard. |
| 2026-10-26 | T5.1 | services/ai/prompts.py (syllabus/mapping/encouragement prompts, 3 few-shot mapping examples, sanitize() + <<< >>> data delimiters). FIXED: old PARSE_PROMPT had unescaped braces -> KeyError -> GPT syllabus parsing never ran (always rule-based fallback). |
| 2026-10-26 | T5.2 | services/ai/llm_client.py (complete_json/complete_text, LLMUnavailable) used by parser, mapper, recommender, question generator; llm_cache table (u1q2r3s4t5u6) caches JSON answers by sha256(model+temp+prompt). |
| 2026-10-26 | T5.3 | CircuitBreaker (3 failures -> open 60s -> half-open) + 1 retry on transient errors in llm_client; /health returns llm {configured, available, providers}; AiStatusBanner in Layout for instructor/admin. |
| 2026-10-26 | T5.4 | GEMINI_API_KEY/GEMINI_MODEL settings; llm_client tries OpenAI then Gemini (REST via httpx, key in header, JSON mime type), each with its own breaker; cache row records answering provider. Disabled when key blank. |
| 2026-10-26 | T6.1 | core/ingestion.py records each syllabus/CSV upload attempt (parse_ok, processing/extract/parse ms) as 'ingestion' audit entries; GET /analytics/admin/ingestion-stats (parse rate, median/p95, % under 2 s); File Ingestion card on AdminDashboard. T6.2 stays descoped (D3). |
| 2026-10-26 | T7.1 | services/assessment/alignment.py compares drafted exam questions (competency + Bloom) to the TOS: unlinked, outside-TOS, Bloom gap >=2, under/over coverage, higher-order share; GET /assessments/{id}/alignment-hints (owner, admin, PD/Dean same college, VPAA); shown in PD Approve modal. Advisory only. |
| 2026-10-26 | T7.2 | programs.program_outcomes (v2r3s4t5u6v7) editable on ProgramsPage; services/ai/syllabus_alignment.py: rule-based measurable-verb check + LLM CLO->PO mapping (hallucinated codes dropped); GET /syllabi/{id}/alignment-check; shown in syllabus approval dialog. Advisory only. |
| 2026-10-26 | T8.1 | Vitest 5 + Testing Library + jsdom; npm test; 13 tests (RiskBadge, ProtectedRoute, AuthContext, AiStatusBanner) instead of a separate mastery helper (none exists in the frontend). CI: Node 22 + npm test step. |
| 2026-10-26 | T8.2 | qa/jmeter/ailas.jmx + README; 50 users x 5 loops: 1502 samples, mean 398 ms, p95 656 ms, 1 connect timeout (0.07%, Docker->host networking); all connected requests < 1.3 s vs 5 s target. HTML report in qa-output/performance/jmeter/run-20261026-185437/. |
| 2026-10-26 | T8.3 | ZAP baseline (frontend): 0 FAIL/9 WARN; ZAP API scan (OpenAPI, unauthenticated): 0 FAIL/1 WARN/119 PASS. Fixed CORP header in API; frontend header warnings fixed via Nginx in T8.4; rest triaged in qa-output/security/zap/README.md. |
| 2026-10-26 | T8.4 | nginx.conf: 443 TLSv1.3-only + HTTP->HTTPS + HSTS/CSP/XFO/nosniff/Permissions-Policy; verified with openssl (1.3 ok, 1.2 refused). FIXED prod routing: proxied only 7 of 15 API prefixes. FIXED prod frontend: compose used the dev Dockerfile (Vite :5173) while nginx proxied :80 -> new frontend/Dockerfile.prod + nginx-spa.conf (SPA fallback verified). Prod compose passes STUDENT_ID_SALT/GEMINI/SMTP. nginx/README.md + make-self-signed-cert.sh. |
| 2026-10-26 | T8.5 | qa/perf/measure_targets.js: dashboards 0.54-0.66 s (<3 s PASS), APIs worst 35 ms (<5 s PASS); JMeter 50 users p95 656 ms. LLM batch latency pending (no OpenAI key here): mapping calls now run 8-way concurrent and each batch is timed into ingestion stats. Summary: qa-output/performance/TARGETS.md. |
