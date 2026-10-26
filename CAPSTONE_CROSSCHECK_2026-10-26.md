# AILAS vs. capstone document — re-check after alignment work (2026-10-26)

Document: MJCO_CAPSTONE_92726.docx (May 15, 2026). Work log: `CAPSTONE_ALIGNMENT_PLAN.md`.
Verification: backend pytest 108 passed / 1 skipped / 5 xfailed (known, pre-existing authorization
findings); frontend Vitest 13 passed; production build OK; database at migration head `v2r3s4t5u6v7`.

Legend: ✅ in sync · 🟡 partial / documented difference · 📝 resolved by a document edit (`CAPSTONE_DOC_EDITS.md`)

## Items that were gaps in the first cross-check

| Doc requirement | Before | Now | Status |
|---|---|---|---|
| §3.9.1 SHA-256(Student_ID + Salt) | Unsalted | Salted with `STUDENT_ID_SALT`; existing data re-keyed by migration | ✅ |
| §3.8.2 CMS = ΣScore/ΣMax | Mean of item % | Pooled points | ✅ |
| Table 9 `competency_mastery` kept current | Only filled by seed script | Recomputed after upload, mapping, override | ✅ |
| §3.8.2 At-Risk → faculty alert + student notification | None | In-app + email, once per transition | ✅ |
| §3.6.2 Keep AI suggestion; log overrides | Overwritten; not logged | Stored; audit-logged with reason | ✅ |
| §3.6.2 Mapping accuracy audit (≥ 85%) | None | Report + card per course | ✅ |
| §3.6.2 Faculty create custom topic tags | None | Create tag from the override drawer | ✅ |
| §2.3 Students rate recommendations | None | Thumbs up/down; counts on Resources page | ✅ |
| §2.3 AI encouragement message shown to student | Generated, never displayed | Shown on student dashboard | ✅ |
| §3.4 Interventions: AI feedback + status | Missing | `ai_feedback`, `status` (open/in progress/resolved) | ✅ |
| §3.9.2 Response caching in PostgreSQL | None | `llm_cache` table | ✅ |
| §3.9.2 Few-shot prompt library + sanitization | Inline zero-shot prompts | `prompts.py` + `sanitize()` | ✅ |
| §3.9.2 Circuit breaker + graceful degradation | None | Retry, breaker, fallbacks, UI banner | ✅ |
| §3.9.2 OpenAI → Gemini fallback | None | Optional, enabled by `GEMINI_API_KEY` | ✅ |
| §3.1 Ingestion parse rate / < 2 s | Not measured | Tracked per upload; admin card | ✅ |
| §3.8.1 LLM mapping < 5 s per batch | Sequential calls | Concurrent calls; batch timing recorded | 🟡 needs a live OpenAI key to measure |
| §3.11.2 Phase 1 alignment analysis | None | Advisory syllabus check (verbs + CLO→PO) | ✅ (pilot-light) |
| §3.11.2 Phase 2 difficulty predictor | Bloom tag only | Advisory TOS/Bloom hints in PD review | ✅ (pilot-light) |
| §3.5 Jest | None | Vitest (Jest-compatible), in CI | 📝 |
| §3.5 JMeter | None | Plan + 50-user results | ✅ |
| §3.5 OWASP ZAP | None | Baseline + API scan, 0 failures, triaged | ✅ |
| §3.5 TLS 1.3 | HTTP only | Nginx TLS 1.3 only, HSTS/CSP headers | ✅ (needs real cert on deploy) |
| §3.5 Web Push / Twilio | None | Descoped (D1) | 📝 future work |
| PDF/DOC (legacy .doc) | Not accepted | Descoped (D3) | 📝 doc says PDF/DOCX |
| Doc internal inconsistencies (TF-IDF, Random Forests, counts, formula sign, references, List of Tables) | — | Edits drafted | 📝 |
| Stack versions (FastAPI, React 19, PG 16, pdfplumber, python-jose) | Differ from doc | Doc edits drafted | 📝 |

## Bugs found and fixed along the way

- GPT syllabus parsing never ran: unescaped braces in the prompt raised KeyError, silently forcing the rule-based fallback.
- Scores for CSV pre-tagged questions had no competency, so they were excluded from mastery.
- Mapping override/revert had no course-ownership check (any instructor could retag any item).
- UI said "70% confidence" while the system and doc use 0.75.
- Production: Nginx forwarded only 7 of 15 API prefixes; prod compose built the dev frontend (Vite :5173) behind an Nginx expecting :80.

## Still open (not in the document's scope, noted for later)

- Pre-existing authorization holes kept as `xfail` tests: assessment approval-history / TOS reads and grade-submission reads are not scoped to the owner (`backend/tests/test_authorization.py`). `POST /analytics/courses/{id}/interventions` also has no ownership check.
- Pilot evaluation itself (SUS ≥ 68 with 8 faculty / 60 students, 100% task completion) must still be run.
- LLM batch latency and live mapping accuracy (≥ 85%) need a real OpenAI key and faculty-reviewed data.
