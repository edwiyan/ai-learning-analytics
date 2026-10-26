# Phase 9 — Compliance & Privacy (RA 10173)

**Result: PASS** — pseudonymization, consent gating, advisory framing, and human-in-the-loop all present.

## 9.1 / 9.2 — hashed_identifier + SHA-256 format
- **10/10** seeded students have a non-null `hashed_identifier` matching `^[a-f0-9]{64}$`
  (valid SHA-256). Raw `student_number` (e.g. `2022-0001`) is decoupled from the hash.
- (During Phase 8 an admin-created student *without* a `student_number` had a NULL
  `hashed_identifier` — the auto-hash sync only fires when a student_number is present.
  That was my test account, now removed; coverage is back to 10/10. **Low note:** admin
  student-creation should require `student_number` so the hash is always populated.)

## Storage pseudonymization (RA 10173 core)
- All performance/behavioral tables key on `student_id_hash`, **not** raw IDs:
  `student_scores, competency_mastery, risk_predictions, recommendations,
  student_enrollments, academic_standings, attendance_records, instructor_interventions,
  grade_consultations, privacy_consents`. Only `users` holds the raw `student_number`. ✅

## 9.3 — No raw IDs in student-facing views
- Student dashboard shows name only, no raw student-number pattern (`raw-id-check.txt` empty). ✅
- `GET /auth/me` returns the student's **own** `student_number` — Low note (Phase 4); self-only.
- Instructor-facing Intervention Alerts shows raw student no. (e.g. `2022-0004`) — **acceptable**:
  faculty need it to identify students; the rule targets *student-facing* views + storage.

## Consent gate (bonus — strong control)
- Student data endpoints return **HTTP 451** until `POST /consent/accept` is recorded
  (`privacy_consents`, versioned, IP logged). Demonstrates explicit RA 10173 consent capture.

## 9.4 — AI outputs labeled advisory
- Recommendations framed as **"AI-Recommended Resources"**, **"AI-generated action plans"**,
  **"personalized suggestions"** (StudentInterventionsPage / StudentDashboard).
- Intervention Alerts shows a disclaimer banner: *"Risk classification uses a rule-based engine
  with deterministic thresholds… flagged At-Risk when 3+ competencies fall below 75% … or
  average declines by more than 15%."* — transparent, advisory, methodologically correct. ✅

## 9.5 — Faculty review / override (human-in-the-loop)
- Intervention Alerts provides **Log** and **Review** actions per at-risk student; interventions
  are **created by faculty** (`POST /courses/{id}/interventions`), students **accept**
  (`PUT /interventions/{id}/student-accept`). The system surfaces suggestions; humans decide.
- Low-confidence topic mappings route to HITL review (Phase 3B). No autonomous grade/standing
  decisions. ✅
