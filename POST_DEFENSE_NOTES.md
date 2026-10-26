# Post-Defense Notes
**Date:** 2026-05-22  
**Status:** Items observed during QA but NOT fixed — intentionally deferred.

---

## Security

### JTI blacklist persistence (DEF-09 partial)
The current logout implementation uses an in-memory `set[str]` in `backend/routers/auth.py`. This is cleared on every server restart. For production:
- Add a Redis `SETEX jti:<value> 1800 1` in the logout handler (1800s = token TTL).
- In `get_current_user`, check `redis.exists(f"jti:{jti}")`.
- `redis_url` is already in `Settings`; `aioredis` or `redis-py` would be the only new dep.

### OpenAPI docs not protected by authentication (DEF-10 partial)
Even with `settings.debug = True`, the docs are publicly accessible without a JWT. For production, the `debug` flag alone is the gate. Consider adding HTTP Basic auth in front of `/docs` for staging environments.

### CORS `allow_origins` too broad (not in original audit)
`main.py` allows `localhost:5173`, `localhost:5174`, `localhost:3000`. Before any real deployment, lock this down to the actual production origin.

---

## Accessibility

### AdminDashboard chart `<figure>` wrapping (DEF-15 partial)
`AdminDashboard.jsx` has two `<Bar>` charts that were NOT wrapped in `<figure aria-label="...">` because admin pages are frozen. Address this post-defense if admin pages are unfrozen.

### Privacy Policy link contrast in sidebar
`Layout.jsx` line ~199: Privacy Policy link uses `text-gray-400` which is below WCAG AA on white. This was not in the original FX-013 scope (only lines 126 and 176 were targeted). Fix by changing to `text-gray-500`.

---

## Performance

### React StrictMode double API calls
In development, React 18/19 StrictMode double-invokes `useEffect` hooks, causing each page to make 2× API requests on mount. This is **not a production bug** — `StrictMode` is removed from the production build. No action required; document for any future developer who notices the dev-console duplication.

### Lighthouse scores
Performance was measured at 72 (mobile) / 88 (desktop) on the login page. The main bottleneck is Chart.js bundle size (~200 KB). For a post-defense optimization pass:
- Code-split Chart.js with `React.lazy` + `Suspense` per dashboard page.
- Enable `gzip` / `brotli` compression in the Docker nginx config.

---

## UX

### StudentDashboard — no courses enrolled state
If a student has no enrolled courses, the page shows an empty state but the copy could be more helpful. Consider linking to the enrollment process or showing a contact-instructor prompt.

### Grade Consultation page not linked in instructor nav
`GradeConsultationPage` exists and is routed at `/instructor/grade-consultation` but there is no nav link in the instructor sidebar. Add a "Grade Consultation" entry to `navItems.instructor` in `Layout.jsx` when you are ready to surface the feature.

### Notification bell — no real-time push
`NotificationBell` polls the API on an interval. For post-defense, upgrade to WebSocket or SSE so alerts appear instantly without polling.

---

## Demo Data

### Student hash ↔ account mapping
The `student_id_hash` values stored in `StudentScore` and `GradeConsultation` are SHA-256 hashes of the student number (via `hash_student_id`). The analytics endpoints join by this hash, not by user ID. Confirm that the seed data used to create scores uses the same hashing function as the enrolled accounts — any mismatch will cause the student dashboard to show no data even though scores exist.

### "wer" assessment cleanup
The seed pre-cleanup step (`[0]`) will delete any assessment titled "wer" on the next run of `python -m backend.seed_demo`. If you want to clean this up without re-seeding, run:
```sql
DELETE FROM assessment_items WHERE assessment_id IN (SELECT id FROM assessments WHERE LOWER(title) = 'wer');
DELETE FROM assessments WHERE LOWER(title) = 'wer';
```

---

## Infrastructure

### No production `.env` file
The repo contains `.env.example` but not a production `.env`. Before any deployment beyond `localhost`, set:
```
DEBUG=false
SECRET_KEY=<32+ random bytes>
DATABASE_URL=<production postgres URL>
OPENAI_API_KEY=<real key>
```

### No HTTPS in Docker Compose
The current `docker-compose.yml` exposes ports directly. Add a Traefik or nginx TLS terminator for any internet-facing deployment.
