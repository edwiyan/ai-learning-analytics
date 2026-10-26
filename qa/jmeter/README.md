# JMeter load test

Load test for the instructor dashboard APIs (capstone §3.5 Testing: JMeter; §3.8.1 target: API response < 5 s).

`ailas.jmx` logs in once as an instructor (setUp group), shares the JWT, then runs N concurrent
users through six dashboard endpoints: course summaries, at-risk students, course overview,
course students, topic-mastery distribution and mapping accuracy. Every sample asserts HTTP 200
and a duration under 5 s.

## Run

Start the backend with demo data (`python -m backend.seed_demo` once), then with Docker:

```bash
docker run --rm -v "$PWD:/work" -w /work alpine/jmeter:5.6 \
  -n -t /work/qa/jmeter/ailas.jmx \
  -Jhost=host.docker.internal -Jport=8000 -Jusers=50 -Jloops=5 -Jrampup=10 \
  -l /work/qa-output/performance/jmeter/run-<stamp>/results.jtl \
  -e -o /work/qa-output/performance/jmeter/run-<stamp>/report
```

(On Git Bash for Windows prefix with `MSYS_NO_PATHCONV=1`.) With a local JMeter install use
`jmeter -n -t qa/jmeter/ailas.jmx -Jhost=localhost ...`.

Properties: `host`, `port`, `protocol`, `users` (default 50), `loops` (5), `rampup` (10 s),
`email` / `password` (default: demo instructor `prof.ana.santos@btech.edu`).

## Results — 2026-10-26 (`qa-output/performance/jmeter/run-20261026-185437/`)

Local dev machine, single uvicorn worker, PostgreSQL 16 in Docker, 50 users × 5 loops, 10 s ramp-up.

| Endpoint | Samples | Mean | p95 | Max |
|---|---:|---:|---:|---:|
| course-summaries | 250 | 373 ms | 636 ms | 736 ms |
| at-risk-students | 250 | 446 ms | 718 ms | 1206 ms |
| course overview | 250 | 429 ms | 664 ms | 10011 ms* |
| course students | 250 | 432 ms | 670 ms | 791 ms |
| topic-mastery-distribution | 250 | 377 ms | 651 ms | 770 ms |
| mapping-accuracy | 250 | 331 ms | 581 ms | 779 ms |
| **Total** | **1502** | **398 ms** | **656 ms** | — |

Throughput 54.6 req/s; 1 error (0.07%).
\* The single error was a TCP connect timeout from the JMeter container to the host
(`host.docker.internal`), not a slow API response; every request that connected finished under
1.3 s, well inside the 5 s target. Production runs behind Nginx with multiple workers.
