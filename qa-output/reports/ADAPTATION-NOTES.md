# AILAS QA — Adaptation Notes

The master prompt (`AILAS_QA_MASTER_PROMPT.md`) was written against assumed routes,
endpoints, and credentials that do **not** match the actual codebase. Per the user's
decision, the QA engagement keeps the prompt's **intent** (10 phases, business rules,
SUS/RBAC/privacy/perf checks) but maps every step onto the **real** system. Platform is
Windows + Docker (commands adapted from the prompt's bash).

## Environment realities
- **DB:** PostgreSQL via `docker compose` (service `postgres`, db `ailas_db`, user `ailas_user`).
- **Backend** image was stale (built before migration `n4j5k6l7m8n9` existed) → migration
  failure on boot (`Can't locate revision 'n4j5k6l7m8n9'`). Fixed by rebuilding the image.
  Logged as **BUG/ops note** (stale image vs. DB head mismatch).
- **No VPAA user is seeded.** `vp_academic_affairs` exists in the `UserRole` enum and has
  frontend routes (`/vp`, gated approval queues), but `seed_demo.py` creates no VPAA account.
  VPAA-specific steps are tested at the route/RBAC level, not via a logged-in VPAA session.

## API base — NO `/api/v1/` prefix (prompt was wrong)
| Prompt assumed | Real endpoint |
|---|---|
| `POST /auth/login` | `POST /auth/login` ✓ (root) |
| `/api/v1/students/at-risk` | `GET /analytics/instructor/at-risk-students` |
| `/api/v1/students/{id}/competency-profile` | `GET /analytics/courses/{course_id}/students/{student_id_hash}/profile` |
| `/api/v1/topic-map` | topic mapping under `/syllabi/upload` pipeline + `/topic-mapping` UI |
| `/api/v1/surveys/sus/results` | `GET /surveys/sus/results` |
| `/api/v1/surveys/sus` (submit) | `POST /surveys/sus` |
| `/api/v1/syllabi/{id}/status` | `GET /syllabi/{id}` + `/syllabi/{id}/approval-history` |
| `/api/v1/grade-submissions/latest` | `GET /grade-submissions/mine` / `/grade-submissions/{id}` |
| student self view | `GET /analytics/me/risk`, `/analytics/me/competency-scores`, `/analytics/me/recommendations` |

## Frontend routes (prompt's paths were fictional)
| Prompt assumed | Real route |
|---|---|
| `/dashboard` | `/instructor` (or `/student`, `/admin`, `/program-director`, `/dean`, `/vp`) |
| `/syllabi/new` | `/instructor/processing` + `/instructor/my-syllabi` |
| `/approvals/syllabi` | `/syllabus-approval` (PD/Dean/VPAA) |
| `/approvals/assessments` | `/assessment-approval` (PD) |
| `/approvals/grades` | `/grade-approval` (PD/Dean/VPAA) |
| `/profile` | `/student` dashboard / `/my-competencies` |
| `/surveys/sus` | `/sus-survey` |
| `/dashboard/at-risk` | `/intervention-alerts` (instructor) |
| `/processing/topic-mapping` | `/topic-mapping` |

## Real demo credentials (`seed_demo.py`)
| Role | Email | Password |
|---|---|---|
| instructor (=faculty) | prof.ana.santos@btech.edu | Demo@1234 |
| program_director | pd.ics@btech.edu | PD@1234 |
| dean | dean.ics@btech.edu | Dean@1234 |
| student | jose.santos@students.btech.edu | Student@1234 |
| admin | admin@ailas.edu | Admin@1234 |
| vp_academic_affairs | (none seeded) | — |

## Early findings (pre-runtime, source-level)
- **PASS** Phase 7.4 — no `sklearn`/`TfidfVectorizer`/`cosine_similarity` in app code
  (only test comments asserting their absence). sklearn present in venv but unused by app.
- **SECURITY (High)** Real secrets committed in `.env` (live SMTP app password + OpenAI key).
  Should be rotated and removed from any tracked/shared copy.
