# Phase 2 — Smoke Testing

**Result: PASS** (go for deep testing)

## API smoke (real endpoints; per-role tokens)
| Role | Endpoint | HTTP | Verdict |
|---|---|---|---|
| instructor | /syllabi/mine | 200 | ✅ |
| instructor | /analytics/instructor/course-summaries | 200 | ✅ |
| instructor | /analytics/instructor/at-risk-students | 200 | ✅ |
| instructor | /analytics/instructor/interventions | 200 | ✅ |
| instructor | /courses | 307→/courses/ | ✅ (trailing-slash redirect) |
| instructor | /surveys/sus/results | 403 | ✅ correct — admin-only aggregate |
| student | /analytics/me/* (no consent) | **451** | ✅ consent gate (RA 10173) |
| student | /consent/accept then /me/courses | 200 | ✅ |
| student | /me/risk, /me/competency-scores (no course_id) | 422 | ✅ correct validation |
| student | /me/risk?course_id=… | 200 | ✅ `On-Track`, conf 0.75 |
| program_director | /syllabi/pending-approval | 200 | ✅ |
| program_director | /assessments/pending-approval | 200 | ✅ |
| program_director | /grade-submissions/pending | 200 | ✅ |
| admin | /analytics/admin/stats | 200 | ✅ |
| admin | /analytics/admin/audit-logs | 200 | ✅ |
| admin | /users | 307→/users/ | ✅ |
| vp_academic_affairs | /grade-submissions/pending | 200 | ✅ |
| vp_academic_affairs | /syllabi/pending-approval | 200 | ✅ |

No `401`/`500` on any happy-path endpoint. The `451`/`422`/`307`/`403` are all **correct, intentional** behaviors (consent gate, input validation, slash redirect, RBAC).

## UI smoke (Playwright, token-injected sessions, 1440×900)
| Screen | Screenshot | Verdict |
|---|---|---|
| Landing/Login | 00-landing.png, 00-login.png | ✅ AILAS branding, login form |
| Instructor dashboard | 02-smoke-instructor-dashboard.png | ✅ KPIs, Chart.js charts, 2 classes/7 students |
| Instructor at-risk (Intervention Alerts) | 02-smoke-instructor-at-risk.png | ✅ renders |
| Student dashboard | 02-smoke-student-dashboard.png | ✅ Risk On-Track, mastery radar, trend |
| Admin dashboard | 02-smoke-admin-dashboard.png | ✅ renders |
| PD approval queue | 02-smoke-pd-queue.png | ✅ role-scoped nav, clean empty state |
| SUS survey | 02-smoke-sus-survey.png | ✅ renders |

## Finding to investigate later (banked)
- **Instructor dashboard Attendance card** states: *"Absence rate is factored into student risk
  predictions — students above 30% absence are flagged At-Risk."* This appears to **contradict
  Capstone Delimitation #2** (no behavioral/attendance signal drives the risk flag) and Phase 7.3.
  → Verify against the actual risk engine in Phase 3C / Phase 7. (Potential High finding.)
