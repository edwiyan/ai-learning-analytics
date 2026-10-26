# Phase 1 — Sessions & Auth

**Result: PASS**

All 6 roles authenticate via `POST /auth/login` and receive a valid JWT.

| Role | Account | Login | Token |
|---|---|---|---|
| instructor (faculty) | prof.ana.santos@btech.edu | ✅ | saved |
| program_director | pd.ics@btech.edu | ✅ | saved |
| dean | dean.ics@btech.edu | ✅ | saved |
| vp_academic_affairs | vp@ailas.edu | ✅ | saved |
| student | jose.santos@students.btech.edu | ✅ | saved |
| admin | admin@ailas.edu | ✅ | saved |

Tokens saved to `qa-output/sessions/<role>.token` (raw JWT) and `<role>.json` (full response).

## JWT structure (verified, instructor)
- Header: `{"alg":"HS256","typ":"JWT"}`
- Payload: `sub` (user UUID), `role`, `jti` (token id → supports server-side revocation/logout), `exp`
- Expiry ≈ 30 min (matches `ACCESS_TOKEN_EXPIRE_MINUTES=30`). ✅ not expired on issue.
- `/auth/me` returns the authenticated user (id, email, full_name, role). ✅

Note: 30-min token lifetime — long phases re-authenticate as needed.
