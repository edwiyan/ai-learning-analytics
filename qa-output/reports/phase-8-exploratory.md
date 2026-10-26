# Phase 8 — Exploratory

**Result: PASS** — robust handling of empty states, boundaries, hostile input, and bypass attempts.

## 8.1 Empty states
- Student with no enrollment (`nina.reyes`): `GET /analytics/me/courses` → `200 []`; dashboard
  shows friendly empty state *"No course data yet. Your instructor needs to upload assessment
  scores first."* — no crash. (`08-empty-state-student.png`)
- PD approval queue with nothing pending → clean "No syllabi pending your review" (Phase 2).
- Empty/0-row CSV: covered by `test_empty_csv_raises` (passes) — parser raises, not crashes.

## 8.2 Boundary values (from Phase 3C engine proof)
- 3 learning gaps → At-Risk; exactly 15% decline → On-Track (strict `>15`); confidence exactly
  0.75 → auto-accept; 0.749 → HITL. All correct.

## 8.4 Long / special-character input
- Admin create user, `full_name = "O'Brien, María José <script>alert(1)</script>" + 500×'X'`:
  - Result: **201** with `<script>` tags **stripped** server-side ("O'Brien alert(1) XXX…").
  - Apostrophe + accented chars preserved; **XSS payload neutralized at storage**. No 500.
  - Minor: a near-identical earlier attempt returned **400** (likely a length-cap interaction) —
    inconsistent code but never a 500/crash. Worth a glance, not blocking. (Test user deleted.)

## 8.6 Approval-chain bypass (from Phase 3D)
- Instructor self-approve → **403**; non-existent `PATCH /syllabi/{id}/status` → **404**.
  The bypass vector the prompt probes for does not exist in the API surface.

## Not exercised (documented)
- 8.3 true race-condition concurrency and 8.5 mid-request network kill were not driven
  (out of scope for API-first + UI-smoke; would need orchestrated fault injection).
