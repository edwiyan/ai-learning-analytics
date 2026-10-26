# Performance targets — measured 2026-10-26

Capstone §3.1 (Objective 3) and §3.8.1 acceptance benchmarks, measured after the capstone
alignment work (Phases 1–8). Local dev machine; backend = single uvicorn worker; PostgreSQL 16
in Docker; frontend = production build via `vite preview`.

| Target | Result | Status | Evidence |
|---|---|---|---|
| Dashboard load < 3 s | admin 0.58–0.66 s, instructor 0.55–0.60 s, student 0.54–0.55 s (3 full reloads each, until network idle) | **Pass** | `targets-2026-10-26.json` (`node qa/perf/measure_targets.js`) |
| API response < 5 s (single user) | 15 dashboard API calls, slowest 35 ms | **Pass** | `targets-2026-10-26.json` |
| API response < 5 s (50 concurrent users) | 1,502 requests, mean 398 ms, p95 656 ms; 1 Docker-network connect timeout (0.07%) | **Pass** | `jmeter/run-20261026-185437/`, `qa/jmeter/README.md` |
| LLM mapping < 5 s per batch | Not measurable here: no OpenAI key is configured in this environment | **Pending** | Recorded automatically per batch once a key is set: Admin dashboard → File Ingestion → "AI topic mapping" row |
| Ingestion < 2 s per file, 100% parse rate | Measured on every upload | **Tracked** | Admin dashboard → File Ingestion (`/analytics/admin/ingestion-stats`) |

## Change made for the LLM batch target

Topic mapping used to call the LLM once per question, one after another, so a 20-question CSV
would take roughly 20 × (LLM latency, ~1 s) ≈ 20 s. The calls now run concurrently (8 at a time,
`MAPPING_CONCURRENCY` in `backend/routers/assessments.py`), which brings a typical batch to about
the latency of 2–3 sequential calls. Cached prompts (identical questions) return instantly.
