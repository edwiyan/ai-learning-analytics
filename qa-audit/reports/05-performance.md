# Phase 5 — Performance Report
**Date:** 2026-05-22  
**Tools:** Lighthouse CLI v13.3.0, Playwright CDP performance API, Vite build analyzer  
**Pages measured:** Login, Admin dashboard, Instructor dashboard, Student dashboard  
**New defects found:** 2 (DEF-19, DEF-20)

---

## Methodology Note

Lighthouse was run against the **dev server** (port 5173). Dev mode serves 60+ individual unminified module files via Vite's native ESM, which inflates CWV metrics far beyond production reality. Scores from dev mode are reported for completeness but should be interpreted alongside the Playwright CDP timings and production bundle analysis.

**Production bundle** was built via `npm run build` and analyzed directly. Playwright CDP was used to capture actual load times against the running dev server (which reflects real API timing but includes module overhead).

---

## Lighthouse Summary (Dev Server — Login Page)

| Category | Score | Notes |
|----------|-------|-------|
| Performance | **53** | Dev artifact — see CWV note below |
| Accessibility | **81** | Confirms DEF-14 (button-name, color-contrast) |
| Best Practices | **100** | No console errors, HTTPS/mixed content clean |
| SEO | **82** | Missing meta description, no robots.txt |

**Why the performance score is low (dev mode):**  
The login page in dev mode loads 60+ individual JavaScript modules without bundling or minification. This accounts for 5,150 KB total byte weight vs. the production 259 KB gzip bundle. CWV metrics below are therefore not comparable to production.

---

## Core Web Vitals (Dev Server)

| Metric | Dev Mode | Production Estimate | Target | Pass? |
|--------|----------|-------------------|--------|-------|
| FCP (Lighthouse) | 16.8 s | ~0.9 s | ≤ 1.8 s (good) | ⚠️ (dev only) |
| LCP (Lighthouse) | 31.6 s | ~1.2 s | ≤ 2.5 s (good) | ⚠️ (dev only) |
| TBT | 170 ms | ~100 ms | ≤ 200 ms (good) | ✅ |
| CLS | 0 | 0 | ≤ 0.1 | ✅ |
| TTI | 31.6 s | ~1.3 s | ≤ 3.8 s (good) | ⚠️ (dev only) |

**Production estimates** are based on: 259 KB gzip JS transfer + API latency (220–650 ms per Phase 3 baseline) + typical LAN delivery. The app is production-only deployable via Docker on campus LAN — not a public internet deployment.

---

## Playwright CDP Page Load Timings (Dev Server, Warm Cache)

| Page | FCP | DOMContentLoaded | Full Load | API Calls | Notes |
|------|-----|-----------------|-----------|-----------|-------|
| /login | 576 ms | 473 ms | 873 ms | 0 | No API on login screen |
| /admin | 400 ms | 251 ms | 1,451 ms | 7 endpoints | 14 requests (StrictMode ×2) |
| /instructor | 268 ms | 211 ms | 1,167 ms | 6 endpoints | 12 requests (StrictMode ×2) |
| /student | 332 ms | 236 ms | 1,004 ms | 3 endpoints | 6 requests (StrictMode ×2) |

All measured times are within the project quality target of **≤ 2 seconds dashboard load** (ISO/IEC 25010).

**React StrictMode note:** In development, React StrictMode intentionally double-invokes `useEffect` to surface side effects. This causes every API call to fire twice. This behavior does **not** occur in the production build — production fires each endpoint once.

---

## API Call Waterfall per Page

### Admin Dashboard (7 parallel API calls in production)
```
GET /auth/me
GET /notifications/unread-count
GET /analytics/admin/stats
GET /analytics/admin/subject-performance
GET /analytics/admin/audit-logs
GET /analytics/admin/enrollment-trends
GET /surveys/sus/results
```
All calls fire in parallel on mount. Total data fetch time bounded by slowest response.

### Instructor Dashboard (6 parallel API calls in production)
```
GET /auth/me
GET /notifications/unread-count
GET /analytics/instructor/course-summaries
GET /analytics/instructor/interventions
GET /analytics/instructor/consultations
GET /analytics/instructor/standing-summary
```

### Student Dashboard (3 parallel API calls in production)
```
GET /auth/me
GET /notifications/unread-count
GET /analytics/me/courses
```
Student dashboard is the lightest — loads ~1 s including API round-trips.

**No sequential waterfall dependencies found.** All data is fetched in parallel. No API call waits for another to complete before firing.

---

## Production Bundle Analysis

| Metric | Value | Target | Pass? |
|--------|-------|--------|-------|
| JS bundle raw size | 1,011 KB | — | — |
| JS bundle gzipped | **259 KB** | ≤ 500 KB | ✅ |
| CSS (included in bundle) | ~69 KB raw | — | — |
| Number of JS chunks | **1** | — | ⚠️ DEF-19 |
| Code splitting | None | Route-based preferred | ⚠️ DEF-19 |

**Vite build output:**
```
dist/assets/index-CgqMLrgX.js   1,011.33 kB │ gzip: 259.47 kB
```

The entire application — all 50+ page components including admin analytics, instructor grade submission, VP dashboard, etc. — is in a single bundle. A student visiting `/student` downloads the full admin dashboard code.

---

## Largest JavaScript Files (Production, from Vite build)

| File | Dev Transfer Size | Role |
|------|-----------------|------|
| ProcessingInterface.jsx | 321 KB | Admin only |
| UserManagement.jsx | 245 KB | Admin only |
| TopicMappingPage.jsx | 219 KB | Admin only |
| AnalyticsPage.jsx | 164 KB | Instructor |
| AdminDashboard.jsx | 158 KB | Admin only |
| MyClassesPage.jsx | 165 KB | Instructor |
| InstructorDashboard.jsx | 155 KB | Instructor |

*Dev sizes include HMR overhead; production gzip significantly reduces these.*  
Without code splitting, every user role loads all of the above.

---

## Latency Outlier (Carried from Phase 3)

| Endpoint | p50 | p95 | Flag |
|----------|-----|-----|------|
| GET /analytics/instructor/at-risk-students | 638 ms | 889 ms | P2 — runs ML inference synchronously |

All other endpoints: p95 ≤ 304 ms. Within the 3-second project quality target.  
The at-risk endpoint runs `predict_risk()` synchronously for all students in all assigned courses. This will degrade as the student roster grows.

---

## Back/Forward Cache (bf-cache)

Lighthouse flags **1 bf-cache failure reason** on the login page. The browser cannot restore the page from bf-cache after navigation — users pressing Back will trigger a full page reload and re-fetch of all data. Root cause is likely event listeners or `localStorage` access in top-level effects.

Impact: Minor UX degradation. Back navigation feels slower than it should.

---

## Redundant Asset Loading

| Issue | Finding |
|-------|---------|
| Chart.js loaded on all pages | Chart.js (~401 KB raw) is bundled globally and parsed even on pages with no charts |
| No lazy loading | No `React.lazy()` or `import()` dynamic imports anywhere in the codebase |
| No route-based splitting | All 50+ components execute at page load |

---

## No Client-Side Data Caching

Each time a user navigates to a dashboard, all API calls repeat from scratch. There is no:
- React Query / SWR cache
- In-memory cache in a context
- LocalStorage TTL caching

Impact: Navigating Admin → Programs → Admin causes 7 more API calls. For a demo-scale dataset this is negligible, but the pattern means API calls scale with navigation actions.

---

## New Defects Found

### DEF-19 — P3: No route-based code splitting
**Area:** `frontend/vite.config.js`, `frontend/src/App.jsx`  
**Evidence:** `npm run build` produces a single 1,011 KB JS chunk. Vite emits a warning:  
`(!) Some chunks are larger than 500 kB after minification. Use build.rollupOptions.output.manualChunks to chunk your bundle.`  
**Impact:** Every user downloads the entire admin analytics and processing interface, even if they only access the student dashboard. First-load parse cost is higher than necessary.  
**Fix:** Wrap page imports in `React.lazy()` + `Suspense`. Add route-level `manualChunks` in `vite.config.js`:
```js
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        charts: ['chart.js', 'react-chartjs-2'],
        admin: ['./src/pages/AdminDashboard', './src/pages/ProcessingInterface', ...],
      }
    }
  }
}
```
Estimated saving: reduces initial parse to ~80 KB (vendor + route chunk) vs. 1,011 KB.

---

### DEF-20 — P3: No client-side data cache — all API calls repeat on every navigation
**Area:** All dashboard page components  
**Evidence:** Playwright CDP captures 7 fresh API calls each time `/admin` is loaded, even after visiting it moments earlier. No cache layer exists.  
**Impact:** Defense demo: if the panel asks to revisit a dashboard after navigating away, every metric re-fetches. On a live server this is fast (220 ms avg), but the waterfall is visible in browser DevTools.  
**Fix:** Add React Query (`@tanstack/react-query`) with a 2-minute stale time, or use a simple `useRef` cache in the dashboard components. Minimum fix: wrap API calls in a context that memoizes responses per session.

---

## Fixes Queued (Phase 5)

| DEF | File | Fix |
|-----|------|-----|
| DEF-19 | `vite.config.js`, `App.jsx` | Add `manualChunks` + `React.lazy()` for route-level splitting |
| DEF-20 | All dashboard page components | Add React Query or simple session cache to avoid re-fetching on back-navigation |

---

## Phase 5 Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Dashboard load (Playwright, dev server) | 873–1,451 ms | ≤ 2,000 ms | ✅ |
| at-risk-students p95 latency | 889 ms | ≤ 3,000 ms | ✅ |
| JS bundle (gzip) | 259 KB | ≤ 500 KB | ✅ |
| Code splitting | None | Route-based | ⚠️ P3 |
| CLS | 0 | ≤ 0.1 | ✅ |
| TBT | 170 ms | ≤ 200 ms | ✅ |
| Redundant API calls (dev) | ×2 each | ×1 | ℹ️ StrictMode — not a prod bug |
| Client-side data cache | None | Recommended | ⚠️ P3 |

**No P0 or P1 performance blockers.** All measured load times meet the project's ≤ 2-second dashboard load target. The 259 KB gzip bundle is within the 500 KB threshold. The two new defects (DEF-19, DEF-20) are P3 quality improvements — neither will affect the defense demo.

**Defense risk:** Lighthouse dev-mode score of 53 looks bad on paper. If a panel member opens DevTools → Lighthouse while the dev server is running, they will see misleading CWV metrics. The defense should demonstrate from a properly built production server, or the panel should be informed that dev-mode bundle serving is the cause.
