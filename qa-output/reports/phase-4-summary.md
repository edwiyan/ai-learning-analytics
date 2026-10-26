# Phase 4 — Security & RBAC

**Result: PASS** — RBAC enforced server-side and client-side; auth hardened. 2 Low notes.

## RBAC (server-side, fresh tokens)
| Attempt | HTTP | Verdict |
|---|---|---|
| instructor → /syllabi/pending-approval (PD-only) | 403 | ✅ |
| instructor → /analytics/admin/stats | 403 | ✅ |
| instructor → /analytics/admin/audit-logs | 403 | ✅ |
| student → /analytics/instructor/at-risk-students | 403 | ✅ |
| student → /users/ | 403 | ✅ |
| student → /syllabi/pending-approval | 403 | ✅ |
| instructor → POST /syllabi/{id}/approve (self-approve) | 403 | ✅ (Phase 3) |

## RBAC (client-side)
- Student → `/instructor` → **redirected to /login** (ProtectedRoute `allowedRoles`). ✅ blocked.
  - **Low (UX):** redirects an authenticated wrong-role user to `/login` rather than an
    `/unauthorized` page — functionally safe, slightly confusing.

## Auth hardening
| Attempt | HTTP | Verdict |
|---|---|---|
| Tampered JWT signature | 401 | ✅ |
| Expired/garbage token | 401 | ✅ |
| No token | 403 | ✅ (HTTPBearer default) |
| SQLi in email field | 422 | ✅ Pydantic `EmailStr` rejects before query |
| SQLi in password (valid email) | 401 | ✅ login fails, ORM is parameterized |

- SQL injection structurally prevented: SQLAlchemy ORM parameterizes all queries; no string-built SQL.
- XSS: no `dangerouslySetInnerHTML` / `innerHTML=` in frontend — React auto-escapes. ✅

## Privacy note
- **Low:** `GET /auth/me` returns the student's **own** `student_number` ("2024-0001"). Self-only
  identity data (not another student's), and performance data is keyed by `hashed_identifier`
  internally — but a strict reading of "no raw IDs in student-facing responses" would omit it.
- Student **dashboard view** shows no raw student-number pattern (`raw-id-check.txt` empty). ✅
