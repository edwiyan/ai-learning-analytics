# OWASP ZAP scans — 2026-10-26

Capstone §3.5 Testing row: OWASP ZAP security testing. ZAP `stable` image (2.16.x), run in Docker
against the local stack.

| Scan | Target | Result | Report |
|---|---|---|---|
| Baseline (passive spider) | Built frontend (`vite preview`, port 4173) | **0 FAIL**, 9 WARN, 59 PASS | `frontend-baseline.html` / `.json` |
| API scan (active, from OpenAPI) | Backend `/openapi.json`, unauthenticated | **0 FAIL**, 1 WARN, 119 PASS | `api-scan.html` / `.json` |

The API scan was unauthenticated on purpose: every write endpoint rejects it, so the active
attacks cannot change the dev database. A DB backup was taken first (`backups/`).

## Triage

| Warning | Where | Action |
|---|---|---|
| Cross-Origin-Resource-Policy missing [90004] | API | **Fixed**: `SecurityHeadersMiddleware` now sends `Cross-Origin-Resource-Policy: same-site`. |
| Anti-clickjacking header missing [10020] | Frontend static files | **Fixed in production**: Nginx adds `X-Frame-Options: DENY` (T8.4). Vite preview is dev-only. |
| X-Content-Type-Options missing [10021] | Frontend static files | **Fixed in production**: Nginx adds `nosniff` (T8.4). |
| CSP header not set [10038] | Frontend static files | **Fixed in production**: Nginx adds a Content-Security-Policy (T8.4). |
| Permissions-Policy not set [10063] | Frontend static files | **Fixed in production**: Nginx adds it (T8.4). |
| Cross-Origin-Embedder-Policy [90004] | Frontend | Accepted: COEP would block cross-origin resources (e.g. remedial video links) for no benefit; no SharedArrayBuffer use. |
| Storable but non-cacheable content [10049] | Frontend | Informational: cache policy, not a vulnerability. |
| Suspicious comments / Unix timestamp [10027, 10096] | Minified JS bundle | Informational: library code in the bundle; no secrets. |
| Modern web application [10109] | Frontend | Informational: tells ZAP to use the AJAX spider. |

To re-run: see the commands in `CAPSTONE_ALIGNMENT_PLAN.md` (T8.3) or:

```bash
docker run --rm -v "$PWD/qa-output/security/zap:/zap/wrk:rw" -t ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py -t http://host.docker.internal:8000/openapi.json -f openapi -r api-scan.html -J api-scan.json -I
```

(The backend must run with `DEBUG=true` so `/openapi.json` is served.)
