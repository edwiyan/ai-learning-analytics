# Panel revision plan — system changes (ORPILLA review, Oct 2026)

Source: panelist's review of the revised manuscript (`D:\Downloads\ORPILLA.pdf`, 10 comments).
Manuscript wording for every comment is in `PANEL_REVISIONS_MANUSCRIPT.docx` (repo root).
This file covers only the **system** changes. Work on branch `capstone-alignment` (or a new
`panel-revisions` branch off it). Tick tasks as they are done; each task is small enough to
finish and commit on its own.

## Comment → system work

| # | Panel comment | System work | Phase |
|---|---|---|---|
| 1 | Ground-truth validation of AI mapping | Auto-accept switch (off for pilot); blind validation module with adjudication, accuracy + CI, Cohen's κ, accuracy by confidence band | P3, P5 |
| 2 | Justify / validate thresholds | Thresholds become institution settings (audited); sensitivity view for the validation meeting; values printed in reports | P3 |
| 3 | Define "early" | Record first flag; % flagged before Midterm; days from alert to intervention; overdue follow-ups | P4 |
| 4 | Don't oversell | Remove fake risk "confidence"; "Risk Prediction" → "Risk Classification"; landing-page claims | P1 |
| 5 | "Real-time" | Wording on landing page | P1 |
| 6 | Privacy of AI payloads | Payload guard + tests; redact contact details from syllabus text; privacy page lists what is sent | P2 |
| 7 | Zero data retention | `store=False` on OpenAI calls; Gemini off unless explicitly enabled; provider/data-policy shown to admin; evidence doc | P2 |
| 8 | MVC vs three-tier, Flask vs FastAPI | Repo docs only (CLAUDE.md says MVC) | P6 |
| 9 | Objective 3 split | Student label "Recommended Resources"; "AI suggestions" label only when an LLM is configured | P1 |
| 10 | Compliance Matrix | None (document only) | — |

## Decisions (recommended defaults — confirm with adviser)

- **D1 Auto-accept off during the pilot.** AI mappings are applied *provisionally* so analytics and
  alerts stay early, but every one shows "pending confirmation" until a faculty member confirms it.
  A bulk "Confirm all high-confidence" action records an explicit faculty confirmation.
  (Alternative: count only confirmed mappings in analytics — more conservative, but delays alerts.)
- **D2 Validation design.** Two blind validators per course + Program Director adjudicator; default
  sample 306 items (stratified by course and confidence band), configurable; random seed stored.
- **D3 Who edits thresholds.** Administrator edits; every change audit-logged with old/new values;
  analytics recomputed for all courses after a change.
- **D4 "Early" cut-off.** First flag in the Prelim grading period = before Midterm; intervention
  target 5 school days (weekdays) after the alert. Both are settings.
- **D5 Gemini fallback** disabled unless `GEMINI_ENABLED=true` and a key are set.
- **D6 Encouragement message** stays (sends only weak-topic names and a resource title).

## Phase 1 — Honest wording in the UI (comments 4, 5, 9) · ~0.5 day

- [x] **T1.1 Remove the fake risk confidence.** The rule engine always returns 0.75. Stop showing it:
  StudentDashboard risk badge ("75% confidence"), instructor at-risk list (`confidence: 75`),
  anywhere else it renders. Keep the API field for compatibility but document it as unused, or drop
  it from `RiskResponse`/at-risk payloads. Files: `services/ai/risk_predictor.py`,
  `routers/analytics.py`, `pages/StudentDashboard.jsx`, `pages/InterventionAlertsPage.jsx`,
  `pages/InstructorDashboard.jsx`.
- [x] **T1.2 "Risk Prediction" → "Risk Classification (rule-based)".** Pipeline diagrams in
  `AnalyticsPage`, `CurriculumInsightsPage`, `InstructorDashboard`; processing step label in
  `ProcessingInterface`; `TopicMappingPage` help text; `PrivacyPolicy` ("risk predictions").
- [x] **T1.3 Landing page.** Replace "predicts academic risk", remove the "Risk Prediction F₁ ≥ 0.80"
  stat (internal QA only), "real-time visibility" → "up-to-date visibility after each upload".
- [x] **T1.4 Recommendation labels.** StudentDashboard "AI Recommendations" → "Recommended
  Resources" (subtitle: "matched to your learning gaps"); Course Resources shows "AI suggestions"
  only when an LLM is configured, otherwise "Keyword-matched suggestions".
- [x] **T1.5** Update Vitest/backend tests that assert old labels; lint; commit.

Acceptance: `grep -ri "predict\|real-time" frontend/src` shows no claims about AILAS itself.

## Phase 2 — Privacy and AI provider (comments 6, 7) · ~1 day

- [ ] **T2.1 Payload guard.** In `llm_client`, before any provider call, reject (log + raise) a
  prompt that contains a student-number pattern (e.g. `\d{4}-\d{4,5}`) or an email address.
  Test: build every prompt (`prompts.build_*`) from fixtures that include student names,
  numbers and scores and assert none appear in the prompt.
- [ ] **T2.2 Redact syllabus contact details.** Strip emails and phone numbers from syllabus text
  before `build_syllabus_prompt` (stored raw text stays local). Test.
- [ ] **T2.3 Provider settings.** `store=False` on both OpenAI calls; `GEMINI_ENABLED` flag in
  `core/config.py` (default false) gating `gemini_configured()`; `llm_status()` reports
  providers and `store=false`. Update `.env.example`, `docker-compose.prod.yml`. Tests.
- [ ] **T2.4 Admin visibility.** AI status card on the Admin dashboard lists enabled providers
  and the data-handling setting.
- [ ] **T2.5 Privacy Policy page.** Add the "sent to the AI provider / never sent" table (same as
  manuscript Table X).
- [ ] **T2.6 Evidence doc.** `docs/AI_DATA_HANDLING.md`: what each prompt sends, provider config,
  where to capture account-setting screenshots for the manuscript appendix.

## Phase 3 — Institution settings and thresholds (comments 1, 2) · ~1.5 days

- [ ] **T3.1 Settings store.** `institution_settings` table (key, JSON value, updated_by,
  updated_at) + migration; `services/settings.py` with typed getters, defaults and a short cache.
  Keys: `mastery_threshold` 75, `at_risk_min_gaps` 3, `grade_decline_pct` 15, `excelling_avg` 85,
  `mapping_review_threshold` 0.75, `mapping_auto_accept` false, `early_warning_period` "prelim",
  `intervention_target_school_days` 5.
- [ ] **T3.2 Use the settings.** `risk_predictor._rule_based_risk`, `feature_engineering`
  (`PASSING_THRESHOLD`, mastery levels), `risk_alerts` message text, `reports/data.py` +
  PDF methodology, topic mapping threshold (`config.topic_mapping_confidence_threshold` →
  setting). Tests for non-default values.
- [ ] **T3.3 Auto-accept switch (D1).** Topic mapping: when `mapping_auto_accept` is false, every
  AI-mapped item is applied provisionally and marked pending confirmation; low-confidence items
  still flagged first. Add "Confirm all ≥ threshold" bulk action (records `validated_by`).
  Mapping page shows pending count. Tests.
- [ ] **T3.4 Settings API + page.** `GET/PUT /institution-settings` (admin; PUT audit-logged with
  old/new); after a threshold change, recompute analytics for all courses in the background.
  Admin "Institution Settings" page. Add the prefix to the Vite proxy and Nginx (not `/settings`,
  which is already an SPA page).
- [ ] **T3.5 Threshold sensitivity view.** Endpoint + table: number/% of students flagged under
  gaps ∈ {2,3,4} × decline ∈ {10,15,20}% (and mastery 70/75/80), scope = admin's courses or a
  college; exportable for the BTECH validation meeting.
- [ ] **T3.6** Reports print the threshold values in force and when they were last changed.

## Phase 4 — Early-warning timing (comment 3) · ~1 day

- [ ] **T4.1 First-flag record.** From `risk_predictions` snapshots (written on change), derive per
  student-course: first At-Risk date and grading period. Helper in `services/early_warning.py`.
- [ ] **T4.2 Time to intervention.** First At-Risk date → first logged intervention for that
  student-course, in school days (weekdays); overdue when > target.
- [ ] **T4.3 Metrics.** % of At-Risk enrolments first flagged in the early period (before
  Midterm), median school days to intervention, % within target, median lead time to Final
  (if term dates unknown, report grading period instead). Instructor dashboard card + Reports
  (PDF section 8 and an Excel sheet). Tests.
- [ ] **T4.4 Overdue follow-ups.** "Overdue" badge and filter on Intervention Alerts; one
  in-app reminder to the instructor when an alert passes the target with no intervention
  (checked when analytics refresh or the alerts page loads — no scheduler needed).

## Phase 5 — Mapping validation module (comment 1) · ~3 days

- [ ] **T5.1 Data model + migration.** `mapping_validation_sets` (name, scope courses, sample
  size, seed, status, created_by), `mapping_validation_items` (set, assessment_item, snapshot of
  AI competency + confidence), `mapping_validation_assignments` (set, course, validator ids,
  adjudicator id), `mapping_validation_labels` (item, validator, competency or "none",
  labeled_at), `mapping_validation_adjudications` (item, adjudicator, competency or "none", note).
- [ ] **T5.2 Sampling.** Stratified random sample per course and confidence band (≥ / < threshold),
  any review status; default n = 306; seed stored so the sample is reproducible.
- [ ] **T5.3 Set-up flow (PD/admin).** Create set, pick courses, assign two validators per course
  (faculty of the same college) and the adjudicator; validators get notifications.
- [ ] **T5.4 Blind labeling page (validators).** One item at a time: question text + endorsed
  competency list + "no matching competency"; **AI suggestion and confidence hidden**; cannot see
  the other validator's labels; progress bar; resume later.
- [ ] **T5.5 Adjudication page (PD).** Only disagreements; shows both labels (AI still hidden);
  PD picks the final competency with an optional note.
- [ ] **T5.6 Metrics.** Ground truth = agreed label or adjudication. Accuracy with 95% Wilson CI;
  Cohen's κ before adjudication; per-competency accuracy; accuracy by confidence band
  (calibration table); "none fits" counts. Pure functions with unit tests (known κ examples).
- [ ] **T5.7 Results page + export.** Results view, Excel export, and a "Mapping Validation"
  section in the Reports PDF (Chapter 4 evidence).
- [ ] **T5.8 Rename the existing card** to "Faculty review agreement" and link to the validation
  results.
- [ ] **T5.9 End-to-end test** (two validators, one disagreement, adjudication, metrics).

## Phase 6 — Docs and wrap-up (comment 8 + housekeeping) · ~0.5 day

- [ ] **T6.1** CLAUDE.md: "MVC" → three-tier description; add settings, validation and privacy notes.
- [ ] **T6.2** `CAPSTONE_DOC_EDITS.md`: point to `PANEL_REVISIONS_MANUSCRIPT.docx` as the current
  manuscript edit list; keep the version/stack fixes.
- [ ] **T6.3** Full run: pytest, Vitest, build, lint (no new errors); browser check of every new page.
- [ ] **T6.4** Final cross-check of the ten comments against system and manuscript.

## Order and dependencies

P1 → P2 → P3 → P4 → P5 → P6. P1–P2 are quick and independent. P3 must precede P4 and P5 (they use
the settings and the auto-accept switch). P5 is the largest and the one BTECH faculty must use,
so the validators should be lined up while P3–P4 are built. Rough total: 7–8 working days.

## Needs BTECH / adviser (cannot be built)

Validator names per course and PD time; threshold validation meeting and signed memo; BTECH
grading-policy citation for 75%; OpenAI account evidence; signed VPAR endorsement.

## Progress log

- 2026-10-27 — Plan written; manuscript guide `PANEL_REVISIONS_MANUSCRIPT.docx` created.
