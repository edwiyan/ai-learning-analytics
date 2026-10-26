# Phase 7 — Regression

**Result: PASS** (1 Low note on API field naming; BUG-002 from Phase 3 re-confirmed here.)

| # | Check | Result |
|---|---|---|
| 7.1 | BTECH branding, no BASC | ✅ PASS |
| 7.2 | ERD field names (DB) | ✅ PASS (DB) / Low note (API aliases) |
| 7.3 | Attendance excluded from At-Risk | ✅ PASS (engine) — BUG-002 UI copy |
| 7.4 | No TF-IDF / sklearn in app code | ✅ PASS |
| 7.5 | Migration head `n4j5k6l7m8n9` | ✅ PASS |

## 7.1 Branding
- No `BASC` / `Bulacan Agricultural` in `frontend/src` or `backend` (excl. venv). The only
  "basc" hits are venv false positives (`passlib.bascii_to_str`).
- Rendered student dashboard contains **BTECH / Baliwag / Politekniko**. ✅

## 7.2 ERD field names
- **DB columns use the capstone §3.4 / ERD names** (verified in information_schema):
  `assessment_items.mapping_confidence`, `assessment_items.requires_review`,
  `syllabi.llm_structured_output`, `users.hashed_identifier`. ✅
  (Migration `n4j5k6l7m8n9_rename_fields_to_doc_names` renamed them from
  `confidence_score`/`needs_review`/`parsed_json`.)
- **Low note:** the API JSON (`AssessmentItemResponse`) still exposes the *legacy* attribute
  names `confidence_score` / `needs_review` (ORM maps old attr → new column). DB↔ERD is
  aligned; API↔ERD is not. Documented as intentional in CLAUDE.md, but a defense panel
  comparing the ERD to live API responses would see the mismatch. Consider aligning the
  Pydantic field names (or `alias`) to the doc names.

## 7.3 Attendance excluded (re-confirmed)
- Engine ignores attendance (Phase 3C boundary proof). `absence_rate` is a descriptive-only
  feature. **BUG-002:** InstructorDashboard.jsx copy wrongly says absence >30% flags At-Risk.

## 7.4 No TF-IDF / sklearn
- No `sklearn`/`TfidfVectorizer`/`cosine_similarity` imports in app code (only test comments
  asserting their absence). sklearn present in venv but unused by the application. ✅

## 7.5 Migration head
- `alembic current` == `alembic heads` == `n4j5k6l7m8n9 (head)`. ✅
