# Suggested edits to the capstone document (MJCO_CAPSTONE_92726.docx)

Drafted 2026-10-26 after the capstone alignment work (see `CAPSTONE_ALIGNMENT_PLAN.md`).
Each item gives the section, the current wording, and replacement text you can paste.
Items in **A** are factual corrections; **B** brings the document in line with the system as built;
**C** is optional.

---

## A. Internal inconsistencies (fix before final submission)

**A1. §2.1.20 Gradescope (Revisited), last sentence**
- Current: "Unlike the proposed system, which uses TF-IDF and Cosine Similarity for automated mapping, …"
- Replace with: "Unlike the proposed system, which uses LLM-based semantic analysis (GPT-4o-mini through engineered prompts) for automated mapping, …"

**A2. §2.1.8 Edmentum Courseware, last sentence**
- Current: "… rather than predicting future performance risks using advanced classifiers like Random Forests (Harris & Miller, 2023)."
- Replace with: "… rather than flagging future performance risks from competency-level evidence (Harris & Miller, 2023)."

**A3. Chapter 2 introduction**
- Current: "Related Systems, which analyzes ten existing platforms … Related Technologies, which discusses the ten key technological components …"
- Replace with: "Related Systems, which analyzes twenty existing platforms … Related Technologies, which discusses the eleven key technological components …"

**A4. §3.8.2 Grade Decline row and the At-Risk logic line** (the formula's sign conflicts with "> 15% decline")
- Grade Decline formula, replace with: `(previous_period_avg − current_period_avg) / previous_period_avg × 100`
- Threshold: "> 15% (a positive value means the average dropped)"
- At-Risk logic line, replace with: `At-Risk_i = (Count(CMS_i,c < 75.0%) ≥ 3) ∨ (GDI_i > 15.0%)`

**A5. "PDF/DOC" vs "PDF/DOCX"**: the system accepts PDF and DOCX (not legacy .doc). Change "PDF/DOC" to "PDF/DOCX" in §1.2 Objective 1, §2.2.4, §2.3 Input Phase, §3.1 (Input), §3.2 Data Ingestion Module and §3.6.1 Step 1.

**A6. List of Tables**: replace "No tables as of the moment" with:
- Table 1. Objective-to-Method Alignment Matrix (§3.1)
- Table 2. Development Tools and Technologies (§3.5)
- Table 3. At-Risk Classification Criteria (§3.8.2)
- Table 4. LLM Technical Limitations and Mitigation Matrix (§3.9.2)
- Table 5. AI-Enhanced Academic Workflow Integration (§3.11.2)

**A7. References not used in the text or the system**: remove, or cite where relevant:
Pedregosa et al. (2023) scikit-learn; Redis Ltd. (2024); Hunter (2023) Matplotlib; Waskom (2024) Seaborn;
Bird, Klein & Loper (2023) NLTK; Wolf et al. (2023) Transformers; Rajput & Ramesh (2023) TF-IDF;
Singhal (2023); Wang & Liu (2024); Abolnejadian & Hershkovitz (2023).
Also check the two "Patel, N., & Gupta, S." entries (2024 and 2025); they look like a duplicated author pair with different titles.

---

## B. Bring the document in line with the system as built

**B1. §2.2.2 Flask Web Framework → FastAPI Web Framework** (replace the whole subsection)

> **2.2.2 FastAPI Web Framework.** FastAPI is a modern, high-performance Python web framework used to build the system's REST API. It provides automatic request validation through Pydantic schemas, dependency injection for authentication and role checks, and asynchronous request handling suited to file uploads and calls to external AI services. Its automatically generated OpenAPI specification also supports API testing and security scanning. FastAPI was selected over Flask because built-in validation and dependency injection reduce custom code for the system's role-based access rules (Ramírez, 2024).

Add the reference: Ramírez, S. (2024). *FastAPI documentation*. https://fastapi.tiangolo.com/
(Keep or drop Grinberg (2022) depending on whether Flask is still discussed.)

**B2. §3.1 Objective-to-Method Alignment Matrix, Tools column**
- Objective 1: "Python 3.12, Pandas, pdfplumber, python-docx, Tesseract OCR (fallback), FastAPI REST API"
- Objective 3: "React.js 19, Chart.js 4, PostgreSQL 16, SQLAlchemy"

**B3. §3.3 System Architecture, Controller paragraph**: "Built with Python (FastAPI), this layer manages API requests, user authentication (via JWT), role-based access control, and business logic …"

**B4. §3.5 Development Tools and Technologies** (replace these rows)

| Layer | Technology | Purpose | Justification |
|---|---|---|---|
| Frontend | React.js 19, Chart.js 4, Tailwind CSS 3, Vite | Responsive UI, data visualization, accessibility | Component reusability, strong ecosystem, WCAG support |
| Backend | Python 3.12, FastAPI 0.115, SQLAlchemy 2, Alembic | API development, business logic, AI orchestration | Built-in validation, async support, versioned schema migrations |
| Database | PostgreSQL 16 | Relational storage, LLM response cache | ACID compliance, JSON support for LLM outputs, robust indexing |
| AI Service | OpenAI GPT-4o-mini API (primary); Google Gemini API (optional fallback) | Syllabus parsing, competency mapping, alignment checks, messages | Cost-efficiency, JSON mode; fallback keeps AI features available during an outage |
| Security | JWT (python-jose), bcrypt, salted SHA-256 (hashlib), TLS 1.3 (Nginx) | Authentication, password and identifier hashing, encryption in transit | Industry standards, RA 10173 alignment |
| Notifications | In-app notifications, SMTP email | At-Risk alerts and approval-workflow alerts | No third-party cost; Web Push and SMS are future work (see B11) |
| Deployment | Docker, Docker Compose, Nginx | Containerization, HTTPS reverse proxy | Reproducible deployments, simplified BTECH IT onboarding |
| Testing | pytest, Vitest (Jest-compatible), Playwright + axe-core, Apache JMeter, OWASP ZAP | Unit, integration, end-to-end/accessibility, load, security | Comprehensive quality assurance aligned with ISO/IEC 25010 |

**B5. §3.6.1 Step 2**: "Backend services use pdfplumber and python-docx to extract text from syllabus files (with a Tesseract OCR fallback for scanned PDFs), while Pandas parses the CSV grade matrix into tabular data."

**B6. §3.6.1 Step 3 and §3.9.1 (hashing location)**
- §3.9.1 heading "Client-Side Hashing & PII Masking" → "Hashing on Ingestion & PII Masking".
- Text: "Student identity numbers are hashed with SHA-256 and a secret institutional salt the moment a CSV is ingested, before database storage and before any API transmission: `hashed_identifier = SHA-256(Student_ID + Salt)`."

**B7. §3.6.2 AI Validation Mechanism** (add after "Faculty Override UI")
> Faculty can accept the AI's suggestion, reassign the item to another competency, or create a custom topic tag when no syllabus competency fits. The AI's original suggestion is preserved, and every override is logged with the previous and new competency, the AI confidence and an optional reason. The Mapping Accuracy Audit compares the AI's first suggestion with the final faculty decision for every reviewed item and reports accuracy per course and per competency against the 85% target.

**B8. §3.8.2 At-Risk Flag, Intervention Trigger column**: "Faculty alert + student notification (in-app and email), sent once when a student first becomes At-Risk."

**B9. §3.9.2 Mitigation Strategy column** (as implemented)
- Hallucination: "Strict JSON output; only codes from the syllabus list are accepted; confidence < 0.75 triggers HITL review."
- Inconsistent Output: "Deterministic response caching in PostgreSQL keyed by model and prompt; temperature 0 for mapping."
- Prompt Sensitivity: "Standardized prompt library with few-shot examples; automated input sanitization (control characters, injection phrases, data delimiters)."
- API Dependency: "Retry with backoff; circuit breaker (opens after 3 failures for 60 s); graceful degradation (rule-based syllabus parser, manual review queue); optional OpenAI → Google Gemini fallback."

**B10. §3.4 Database Design**: keep the eleven ERD entities, and add one sentence on naming and supporting tables:
> Physical table names: Enrollments = `student_enrollments`, Student Grades = `student_scores`, Remedial Resources = `resources`, Interventions = `instructor_interventions` (with `ai_feedback` and `status` columns). Supporting tables cover the approval workflow (syllabus, assessment and grade-submission approvals), curriculum structure (programs, curricula, sections), Table of Specifications, attendance, notifications, audit logs, privacy consent, risk-prediction snapshots, recommendation feedback, SUS responses and the LLM response cache.

**B11. §1.3 Delimitations** (add)
> Alert delivery is limited to in-app notifications and email; Web Push and SMS (Twilio) channels are identified as future work.

**B12. §1.5 Definition of Terms, RBAC**: "… based on user roles (Faculty, Student, Program Director, Dean, VPAA, Administrator) …"

**B13. §3.11.3 Scope Alignment** (append)
> For the pilot, light advisory versions of the Phase 1 and Phase 2 features are available: a syllabus alignment check (measurable learning-outcome verbs, and CLO-to-program-outcome mapping by the LLM) during syllabus approval, and Table of Specifications / Bloom's-level alignment hints during assessment review. Both remain advisory.

**B14. §2.3 Feedback Loop**: add "Students rate each recommended resource as helpful or not helpful; faculty see the ratings in the resource repository."

---

## C. Optional additions

**C1. Evaluation evidence (§3.8, if results are reported):**
dashboard load 0.54–0.66 s (target < 3 s); API p95 656 ms under 50 concurrent users (target < 5 s);
OWASP ZAP: 0 failures on frontend baseline and API scans. Sources: `qa-output/performance/TARGETS.md`,
`qa-output/security/zap/README.md`.

**C2. Supporting modules (new short subsection under §3.3 or an appendix):** curriculum and section management, bulk enrollment, attendance logging (descriptive only, per Delimitation 2), grade weights and scales, academic standing, AI exam-question drafting with DOCX export, privacy-consent capture, audit logging and the in-app SUS survey.
