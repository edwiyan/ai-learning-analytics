// Measures the capstone performance targets (§3.1 / §3.8.1):
//   dashboard load < 3 s, API response < 5 s.
// Usage: node qa/perf/measure_targets.js [baseUrl] [apiUrl]
//   defaults: http://127.0.0.1:4173 (vite preview) and http://127.0.0.1:8000
// Writes qa-output/performance/targets-<date>.json and prints a table.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://127.0.0.1:4173";
const API = process.argv[3] || "http://127.0.0.1:8000";
const RUNS = 3;

const ROLES = [
  { role: "admin", email: "admin@ailas.edu", password: "Admin@1234", route: "/admin" },
  { role: "instructor", email: "prof.ana.santos@btech.edu", password: "Demo@1234", route: "/instructor" },
  { role: "student", email: "andrea.reyes@students.btech.edu", password: "Student@1234", route: "/student" },
];

async function login(page, { email, password }) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");
}

async function timeDashboard(page, route) {
  // Full reload of the dashboard: HTML, JS, and every API call until the network is idle.
  const t0 = Date.now();
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 30000 });
  return Date.now() - t0;
}

async function timeApi(token, url) {
  const t0 = Date.now();
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  await res.arrayBuffer();
  return { url, status: res.status, ms: Date.now() - t0 };
}

(async () => {
  const browser = await chromium.launch();
  const results = { date: new Date().toISOString(), base: BASE, dashboards: [], api: [] };

  for (const r of ROLES) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const apiCalls = [];
    page.on("requestfinished", async req => {
      if (!["xhr", "fetch"].includes(req.resourceType())) return;
      const t = req.timing();
      apiCalls.push({ url: new URL(req.url()).pathname, ms: Math.round(t.responseEnd) });
    });
    try {
      await login(page, r);
    } catch (e) {
      results.dashboards.push({ role: r.role, error: `login failed: ${e.message}` });
      await context.close();
      continue;
    }
    const times = [];
    for (let i = 0; i < RUNS; i++) times.push(await timeDashboard(page, r.route));
    results.dashboards.push({
      role: r.role, route: r.route, runs_ms: times,
      worst_ms: Math.max(...times), meets_3s: Math.max(...times) < 3000,
    });

    const token = await page.evaluate(() => localStorage.getItem("access_token"));
    const unique = [...new Set(apiCalls.map(c => c.url))].filter(u => !u.includes("/auth/"));
    for (const u of unique) {
      const q = apiCalls.find(c => c.url === u);
      const full = (await page.evaluate(() => performance.getEntriesByType("resource").map(e => e.name)))
        .map(n => new URL(n)).find(n => n.pathname === u);
      const timed = await timeApi(token, full ? full.pathname + full.search : u);
      results.api.push({ role: r.role, ...timed, meets_5s: timed.ms < 5000, browser_ms: q?.ms ?? null });
    }
    await context.close();
  }
  await browser.close();

  const outDir = path.join(__dirname, "..", "..", "qa-output", "performance");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `targets-${results.date.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(results, null, 2));

  console.log("Dashboard load (target < 3000 ms):");
  for (const d of results.dashboards) {
    console.log(d.error ? `  ${d.role}: ${d.error}` : `  ${d.role.padEnd(10)} ${d.route.padEnd(12)} runs ${d.runs_ms.join(" / ")} ms  worst ${d.worst_ms} ms  ${d.meets_3s ? "PASS" : "FAIL"}`);
  }
  const worstApi = results.api.reduce((m, a) => (a.ms > m.ms ? a : m), { ms: 0 });
  const failures = results.api.filter(a => !a.meets_5s || a.status >= 500);
  console.log(`API calls (target < 5000 ms): ${results.api.length} timed, worst ${worstApi.ms} ms (${worstApi.url}), ${failures.length} over target or 5xx`);
  console.log(`Saved ${path.relative(process.cwd(), file)}`);
})();
