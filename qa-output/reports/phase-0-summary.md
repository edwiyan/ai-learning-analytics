# Phase 0 — Environment Validation

**Result: PASS (with 1 ops issue found & fixed)**

| Check | Expected | Actual | Status |
|---|---|---|---|
| Docker services | backend/frontend/db/redis Up | all 4 Up & healthy | ✅ |
| Migration head | `n4j5k6l7m8n9` | `n4j5k6l7m8n9 (head)`, current==head | ✅ |
| Backend health | `{"status":"ok"}` | `{"status":"ok","db":"connected","llm_api":"configured"}` | ✅ |
| Frontend reachable | login page renders | HTTP 200 | ✅ |
| Seed data present | users for all roles | 22 users across 6 roles | ✅ |

## Seeded accounts / roles (verified in DB)
- student ×10, instructor ×4, program_director ×3, dean ×3, admin ×1, **vp_academic_affairs ×1**
- (Correcting an earlier note: a VPAA account **does** exist — `vp@ailas.edu`.)

## Ops issue found (logged BUG-001, Medium)
Backend container failed to boot on first `docker compose up`: the cached backend image
was built ~2 weeks ago, before migration `n4j5k6l7m8n9_rename_fields_to_doc_names` was
added. `alembic upgrade head` errored with `Can't locate revision identified by
'n4j5k6l7m8n9'` because the DB volume was already stamped at that revision but the image's
code didn't contain it. **Resolution:** rebuilt the backend image (`docker compose build
backend`) — boot + migrations then succeeded. This is a developer-environment hazard
(image/DB drift), not an application defect, but it will bite anyone reusing an old image
against a migrated volume.
