# AILAS — System Status Report & Compliance Comparison

**Against guideline document:** `LATEST DOC CAPSTONE_53126.docx`
**Codebase:** `C:\Users\edria\ai-learning-analytics`
**Report date:** 2026-06-02
**Migration head:** `n4j5k6l7m8n9_rename_fields_to_doc_names`

> The capstone document is the gold standard. This report states (1) what the document requires, (2) what is built in the system, (3) where they match, (4) what is missing, and (5) where the **document itself** contradicts itself and must be corrected by the proponent. Nothing here invents requirements that aren't in the paper.

---

## 1. What the Document Specifies (the guideline, distilled)

| Area | Document requirement |
|------|----------------------|
| **Title** | AI-Assisted Learning Analytics System for Student Performance Monitoring and Early Academic Intervention |
| **Institution** | Dalubhasaang Politekniko ng Lungsod ng Baliwag (**BTECH**), Baliwag — a city polytechnic |
| **Author** | Mark Joeven C. Orpilla (MIT) |
| **Core approach** | API-based AI only (OpenAI **GPT-4o-mini**); **no custom ML training** (no Random Forest/Neural Nets) |
| **4 Objectives → 4 Modules** | (1) Data Ingestion (PDF/DOC syllabus + CSV grades), (2) AI-Assisted Topic Classification (semantic competency mapping), (3) Performance Dashboard + Recommendation Engine, (4) Evaluation (ISO/IEC 25010 + SUS) |
| **Users / RBAC** | Faculty (primary), Students (secondary), Admins = Program Chair/Director, Deans, VPAA (view-only on high-level reports) |
| **Tech stack** | Python 3.11 + Flask 3.0 / FastAPI; React.js 18; Chart.js 4; Tailwind CSS; PostgreSQL 15; OpenAI GPT-4o-mini; JWT + SHA-256 + TLS 1.3; Docker 24; pytest/Jest/JMeter/OWASP ZAP; Git/GitHub |
| **Database** | **11 relational tables** (ERD): Users, Courses, Enrollments, Syllabi, Competencies, Assessments, Assessment Items, Student Grades, Competency Mastery, Remedial Resources, Interventions |
| **At-Risk rule** | `(learning_gap_count ≥ 3) OR (grade_decline over 2 periods > 15%)` |
| **Mastery bands** | Proficient ≥85%, Developing 75–84%, Emerging <75% (Emerging = Learning Gap) |
| **Mapping confidence** | Auto-accept at confidence **≥ 0.75**; low-confidence → Human-in-the-Loop review |
| **Privacy** | RA 10173 — SHA-256 hashing of student identifiers (`hashed_identifier`) |
| **Quality targets** | SUS **≥68**; dashboard load **<3s**; API response **<5s**; mapping accuracy ≥85% (faculty-validated); 100% critical-task completion |
| **3-Phase Academic Workflow** (§3.11) | Phase 1 Syllabus prep (Instructor → **PD → Dean → VPAA**); Phase 2 Assessment prep (Instructor → **PD review** on validity/difficulty/clarity/fairness vs Table of Specifications); Phase 3 Grade consultation → at-risk ID → intervention → **multi-level encoding (PD → Dean → VPAA)** |
| **Pilot scope** | Prioritize **Phase 3**; Phases 1 & 2 AI "pre-configured, activated post-pilot." All AI outputs **advisory only**. |
| **Delimitations** | No custom ML; CSV + PDF/DOC only (no LMS clickstream/behavioral/affective sensors); single-institution pilot; rule-based recommendation retrieval (no generative content); system never automates official grading/standing decisions. |

---

## 2. What Is Built — and How It Maps to the Document

### 2.1 Fully implemented and ALIGNED ✅

| Document requirement | Status in system | Evidence |
|---|---|---|
| **BTECH branding** (not BASC) | ✅ Done — source code is 100% BTECH; zero BASC/Bulacan-Agricultural strings remain in `backend/` or `frontend/src/` (remaining hits are only inside `venv/` library code) | `config.py` → `"AILAS – BTECH"`; `grading.py` → "BTECH numeric grade"; seed rewritten |
| **11 ERD tables** | ✅ All present (system has more, see §4) | `models/`: user, course, enrollment, syllabus, competency (in syllabus.py), assessment, assessment_item, score (Student Grades), competency_mastery, resource (Remedial Resources), instructor_intervention |
| **At-Risk rule** | ✅ Matches **exactly** | `risk_predictor.py:21` → `if learning_gap_count >= 3 or grade_decline_pct > 15.0` |
| **Mastery bands** | ✅ Matches **exactly** | `feature_engineering.py:29–33` → ≥85 Proficient / 75–84 Developing / <75 Emerging; Emerging → `risk_flag=True` |
| **Confidence ≥0.75 auto-accept + HITL** | ✅ Implemented | topic mapper + `requires_review` flag on Assessment Items; TopicMappingPage review UI |
| **SHA-256 hashed identifier** | ✅ Implemented | `users.hashed_identifier`, auto-populated via SQLAlchemy event + backfill migration `m3i4j5k6l7m8` |
| **GPT-4o-mini, API-only, no custom ML** | ✅ Compliant | `services/ai/syllabus_parser.py`, `topic_mapper.py` use OpenAI; no trained model files |
| **React 18 + Chart.js + Tailwind + Postgres + Docker + JWT** | ✅ Present | frontend build, `docker-compose.yml`, auth router |
| **SUS evaluation (≥68 target)** | ✅ Built | `SusSurveyPage.jsx`, `models/sus_survey.py`, `/surveys/sus` computes score; admin results view |
| **ISO/IEC 25010 framing** | ✅ Documented in CLAUDE.md "Quality Targets" (0.75 threshold, <3s/<5s perf, F1 reframed as internal QA) | per compliance fix Sprint 5 |
| **Field names match ERD** | ✅ DB columns renamed to `mapping_confidence`, `requires_review`, `llm_structured_output` | migration `n4j5k6l7m8n9` |

### 2.2 The 3-Phase Workflow (§3.11) — IMPLEMENTED (system exceeds the pilot scope)

The document says the pilot prioritizes **Phase 3 only**, with Phases 1 & 2 "pre-configured." **The system has actually built all three phases as live approval chains:**

| Workflow phase | Document | System |
|---|---|---|
| **Phase 1 — Syllabus** (Instructor → PD → Dean → VPAA) | Pilot: pre-configured | ✅ **Live**: `SyllabusApproval` model, stage enum `draft→pending_pd→approved_pd→pending_dean→approved_dean→pending_vp→fully_approved/rejected`; submit/approve/reject/resubmit endpoints; `SyllabusApprovalQueue.jsx`; validate blocked until `fully_approved` |
| **Phase 2 — Assessment** (Instructor → PD review) | Pilot: pre-configured | ✅ **Live**: `AssessmentApproval` with 5 review criteria (content_validity, difficulty_appropriate, instructions_clear, bias_free, outcomes_covered); upload blocked until approved; `AssessmentApprovalQueue.jsx` |
| **Phase 3 — Grade consultation/intervention/encoding** (multi-level PD → Dean → VPAA) | **Pilot focus** | ✅ **Live**: `GradeSubmission` + approval chain → VPAA marks `posted`; `GradeConsultation` (Pass/Fail/Incomplete + notes/next steps); 8 intervention types; improvement plans with student acknowledgment |
| Roles PD / Dean / VPAA | view-only admins | ✅ `UserRole` enum has `program_director`, `dean`, `vp_academic_affairs`; dedicated dashboards built |
| Notifications on each approval step | (doc lists Web Push/SMTP/Twilio) | ✅ In-app `Notification` model + bell; (email/SMS/push channels not wired — see §3) |

**Interpretation:** the system is **ahead of** the document's pilot scope here — it digitizes the full institutional hierarchy the document describes as "established." This is a *strength*, but note the document's wording ("Phases 1 & 2 activated post-pilot" + "all AI outputs advisory only"). Make sure the defense narrative explains that the **approval workflow** is built while the **AI assist inside Phases 1 & 2** (alignment analysis, difficulty predictor) stays advisory/post-pilot — consistent with the paper.

### 2.3 Assessment quality features (Phase 2 support) ✅

- **Table of Specifications** (`tos.py`) — editor in ProcessingInterface, 100%-weight validation
- **Bloom's taxonomy** levels on Competency & AssessmentItem; GPT prompts updated; badges in UI
- **Formative vs Summative** categories; feature engineering separates them
- **Grade weighting** per period/category; **Letter-grade conversion** (BTECH 1.00–5.00 scale, relabeled from BASC)
- **Attendance** tracking (manual P/A/L/E records) — kept as a *feature*, **correctly removed from the at-risk rule** to honor Delimitation #2 (no behavioral tracking in the risk decision)

---

## 3. What Is MISSING or PARTIAL vs the Document

> **Re-audited 2026-06-02 (second pass).** Several items first listed as gaps are resolved or were never real gaps. Corrections below.

| Gap | Document basis | Current state | Priority |
|---|---|---|---|
| ~~TF-IDF / Cosine-similarity fallback~~ **RESOLVED — not a code gap** | §2.1.20 of the .docx mentions TF-IDF/Cosine | ✅ **TF-IDF is NOT in the system** (verified: `topic_mapper.py` is pure GPT-4o-mini; no TF-IDF, no sklearn anywhere). This matches every design section of the paper. The **only** place TF-IDF appears is one stray sentence in .docx §2.1.20 — a document wording slip, not a system gap. | Reword .docx §2.1.20 (see §5) |
| **OCR (Tesseract) fallback for scanned PDFs** | §3.9 "graceful degradation" | ✅ **NOW WIRED** — `extractor.py` routes empty-text PDFs to a guarded Tesseract OCR fallback that degrades gracefully (returns empty text) if the Tesseract/Poppler **binaries** are absent. This host has no Tesseract binary, so OCR stays dormant until the binary is installed — by design, no crash. | Install Tesseract + Poppler on the deployment host to activate |
| **Mapping accuracy ≥85% (faculty-validated)** | Obj 2 success criterion | ✅ **Aligned with the paper** — there is **no** `/admin/validate-model` endpoint (first pass was wrong). Per the capstone evaluation design, mapping accuracy is **validated manually by faculty** (Human-in-the-Loop), not an automated metric. The rule engine keeps an *internal* macro-F1 regression guard (`test_risk_f1.py`) that the doc itself frames as internal QA. | Collect the faculty validation sample during the pilot (T11-07, external) |
| **Multi-channel notifications** (Web Push / SMTP / Twilio) | §3.5 stack table | ⚠️ In-app notification bell is live; SMTP email exists (enrollment welcome). Web Push / Twilio SMS not wired. CLAUDE.md already documents these as deferred future work. | Low (doc lists them as "user preference flexibility," not core) |
| **Topic-mapping progress indicator** | UX expectation for long AI jobs | ❌ Mapping runs as a FastAPI BackgroundTask; no polling/progress endpoint. | Low |
| **Syllabus quality review criteria** (prerequisite check, industry standards, theory/practical %) | Phase 1 PD review depth | ❌ Track B, not started (T8) | Low (post-defense) |
| **Special grades** (INC/DRP/W handling catalog) | Phase 3 encoding completeness | ❌ Track B (T10) — note: Incomplete IS handled in GradeConsultation, but the full special-grade catalog is not | Low |
| **Post-grade advising templates / Academic probation auto-compute** | Phase 3 follow-through | ⚠️ Probation model + compute service exist (T5-D ✅); advising templates (T5-C) ☐ | Low |
| **Live end-to-end verification** | — | ⚠️ Per project memory, last full live seed+analytics run was blocked when Docker/Postgres were down; backend tests pass (40 passed, 1 skipped). Re-run the live seed before defense. | **Do before defense** |

---

## 4. Where the System EXCEEDS the Document (scope to be aware of)

These exist in code but are **not required** by the paper. They are not "wrong," but at defense you should be ready to explain them as workflow-digitization, not scope creep beyond the delimitations:

- Full PD→Dean→VPAA **approval chains** for syllabus, assessment, and grade encoding (doc treats these as "established manual hierarchy" + pilot defers Phases 1–2 AI).
- **Attendance** module, **grade weighting**, **TOS editor**, **academic-standing/probation** engine, **curriculum/program/section/enrollment** management layer.
- 6 roles vs the document's 3-tier RBAC description (Faculty/Student/Admin) — the system breaks "Admin" into PD/Dean/VPAA, which matches the §3.11 workflow narrative.

**Risk:** the document's Delimitations say outputs are "advisory only" and the system "does not automate official grading decisions, academic standing approvals, or final grade submissions." The system's grade-encoding and probation features get close to that line. **Mitigation:** confirm these features are framed as *recording human decisions / decision-support*, never as the system deciding autonomously. The current design (human approves at every stage) is compliant — just make the framing explicit.

---

## 5. Document-Side Wording Slips the Proponent Should Fix

The system matches the paper's **design**, but a few **wording slips in the .docx** will draw panel questions. These are document edits only (the code is already correct):

> **Note on institution:** The BASC title page is **intentional and correct** — the capstone is *submitted to* Bulacan Agricultural State College (the author's degree-granting school for the MIT), while the *client/deployment institution* is BTECH (Baliwag). Both belong in the paper. This is **not** an inconsistency to fix.

1. **TF-IDF/Cosine slip.** §2.1.20 says the proposed system "uses TF-IDF and Cosine Similarity," but §2.2.5, §2.3.1, §3.6 (and the actual code) use **LLM semantic mapping only**. → Reword §2.1.20 to "uses LLM-based semantic mapping." (The code is already TF-IDF-free; only this sentence is stale.)
2. **Flask vs FastAPI.** Stack table says "Flask 3.0/FastAPI 0.100" and some prose says Flask; the **system uses FastAPI**. → Standardize on FastAPI in the paper. (Minor — the doc already lists FastAPI as an accepted option.)
3. **"Random Forest" residue.** §2.3.1 says "Unlike the previous Random Forest classifier" — a leftover from an earlier ML design the delimitations now forbid. The code trains no model. → Remove the implication a Random Forest was ever trained.
4. **Background typo.** The programs list shows "Bachelor of Science in Information Technology" **twice** (one should be another program). → Proofread.
5. **Tables list.** "LIST OF TABLES — No tables as of the moment," yet Chapter 3 contains several tables (Objective matrix, At-Risk criteria, stack, limitations). → Populate the List of Tables.

---

## 6. Bottom Line

- **Core thesis claims are fully and faithfully implemented and verified in code**: BTECH identity, GPT-4o-mini API-only pipeline (no TF-IDF, no trained ML model), 11-table schema, the exact At-Risk formula, the exact mastery bands, 0.75 confidence + HITL, SHA-256 privacy, SUS evaluation, FastAPI/React/Chart.js/Postgres/Docker/JWT.
- **The full 3-phase institutional workflow is built** (the document only commits to Phase 3 for the pilot) — the system is *ahead* of the paper here.
- **The earlier "gaps" mostly evaporated on a second pass:** TF-IDF was never in the system (correct), the OCR fallback is now wired (dormant until the host has the Tesseract binary), and the "validate-model endpoint" never existed — accuracy is faculty-validated per the paper, with F1 only as internal QA.
- **Genuinely outstanding (all minor / post-defense):** Web Push + Twilio SMS channels, a topic-mapping progress bar, and Track-B niceties (syllabus quality criteria, special-grade catalog, advising templates). Plus the housekeeping of a fresh live end-to-end seed run before defense.
- **The only true mismatches are 5 wording slips in the .docx** (§5) — fixing those sentences makes paper and system fully agree. The institution (BASC submission + BTECH client) is intentional and correct.

**Recommended next actions (in order):**
1. Apply the 5 .docx wording fixes in §5 (cheap, high-impact for defense).
2. On the deployment host, install the **Tesseract + Poppler** binaries so the (already-wired) OCR fallback activates for scanned syllabi.
3. During the pilot, capture a small **faculty-validated mapping sample** to substantiate the ≥85% mapping-accuracy objective (manual validation, per the paper — no automated endpoint needed).
4. Run a clean live `alembic upgrade head` + seed + analytics smoke test (set `PYTHONIOENCODING=utf-8`) to re-verify end-to-end before defense.
