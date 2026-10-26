# Phase 5 — Performance

**Result: PASS** — all SLAs met with large margin.

## API response time (SLA < 5s)
| Endpoint | Time | Verdict |
|---|---|---|
| /analytics/instructor/course-summaries | 0.043s | ✅ |
| /analytics/instructor/at-risk-students | 0.115s | ✅ |
| /courses/ | 0.013s | ✅ |
| /syllabi/mine | 0.021s | ✅ |
| /analytics/admin/stats | 0.038s | ✅ |
| /analytics/admin/audit-logs | 0.022s | ✅ |
| /analytics/me/competency-scores | 0.013s | ✅ |
| /analytics/me/risk | 0.011s | ✅ |

## Concurrency (5 simultaneous at-risk queries)
All 5 completed in 0.51–0.58s — no degradation past SLA.

## Dashboard load (SLA < 3s) — Navigation Timing API
| Page | load/duration | Verdict |
|---|---|---|
| /instructor | ~284 ms | ✅ |
| /student | ~284 ms | ✅ |

## Caveats
- Measured against the **Vite dev server** (not a production build) on a warm DB with the
  seeded demo dataset (small). A production build + larger dataset would change absolute
  numbers, but the headroom (×10–250 under SLA) is substantial.
- Topic-mapping (GPT-4o-mini) latency not load-tested live to avoid spending API quota /
  external variability; that path is async and the <5s SLA applies to the local API, which
  passes. Real LLM latency should be spot-checked separately before defense.
