/**
 * AILAS Demo Recording Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Records a full product walkthrough for each of the 6 user roles.
 * For every session it produces:
 *   demo-output/<role>/session.webm   — raw Playwright video
 *   demo-output/<role>/session.srt    — subtitle file (SRT format)
 *   demo-output/<role>/session.mkv    — video with soft subtitle track (ffmpeg)
 *
 * Run:  node demo-record.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let ffmpegBin;
try { ffmpegBin = require('ffmpeg-static'); } catch { ffmpegBin = null; }

// ── config ────────────────────────────────────────────────────────────────────
const BASE     = 'http://localhost:5173';
const OUT_ROOT = path.join(__dirname, 'demo-output');
const W = 1440, H = 900;

const CREDS = {
  admin:               { email: 'admin@ailas.edu',                 password: 'Admin@1234',   label: 'Administrator' },
  instructor:          { email: 'maria.santos@btech.edu',          password: 'Demo@1234',    label: 'Instructor'    },
  student:             { email: 'andrea.reyes@students.btech.edu', password: 'Student@1234', label: 'Student'       },
  program_director:    { email: 'pd@ailas.edu',                    password: 'PD@1234',      label: 'Program Director' },
  dean:                { email: 'dean@ailas.edu',                  password: 'Dean@1234',    label: 'Dean'          },
  vp_academic_affairs: { email: 'vp@ailas.edu',                    password: 'VP@1234',      label: 'VP Academic Affairs' },
};

// ── SRT helpers ───────────────────────────────────────────────────────────────
function msToSrt(ms) {
  const hh = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
  const mm = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((ms % 60_000) / 1_000)).padStart(2, '0');
  const ff = String(ms % 1_000).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ff}`;
}

class Captioner {
  constructor() { this.entries = []; this._t0 = 0; }

  start() { this._t0 = Date.now(); this.entries = []; }

  /** Inject an on-screen caption and record a subtitle entry. */
  async show(page, text, holdMs = 4000) {
    const start = Date.now() - this._t0;
    this.entries.push({ start, end: start + holdMs, text });
    await page.evaluate(({ text, holdMs }) => {
      let el = document.getElementById('__cap__');
      if (!el) {
        el = document.createElement('div');
        el.id = '__cap__';
        el.style.cssText = [
          'position:fixed', 'bottom:48px', 'left:50%', 'transform:translateX(-50%)',
          'background:rgba(10,10,10,.82)', 'color:#fff', 'padding:10px 28px',
          'border-radius:10px', 'font:600 15px/1.4 system-ui,sans-serif',
          'z-index:2147483647', 'max-width:78%', 'text-align:center',
          'backdrop-filter:blur(6px)', 'border:1px solid rgba(255,255,255,.12)',
          'box-shadow:0 4px 24px rgba(0,0,0,.5)', 'pointer-events:none',
        ].join(';');
        document.body.appendChild(el);
      }
      el.textContent = text;
      clearTimeout(el.__timer);
      el.__timer = setTimeout(() => { el.textContent = ''; }, holdMs);
    }, { text, holdMs }).catch(() => {});
  }

  toSrt() {
    return this.entries
      .map((e, i) => `${i + 1}\n${msToSrt(e.start)} --> ${msToSrt(e.end)}\n${e.text}`)
      .join('\n\n') + '\n';
  }
}

// ── low-level helpers ─────────────────────────────────────────────────────────
async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function go(page, cap, url, caption, pauseMs = 2500) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await cap.show(page, caption);   // show AFTER navigation so caption appears on the right page
  await wait(pauseMs);
}

async function click(page, cap, selector, caption, opts = {}) {
  // Try each comma-separated selector individually for reliability
  const parts = selector.split(/\s*,\s*(?=button|a|input)/);
  for (const part of parts) {
    const el = page.locator(part).first();
    if (await el.isVisible().catch(() => false)) {
      if (caption) await cap.show(page, caption);
      await el.click(opts);
      await wait(1200);
      return;
    }
  }
}

/** Type into a field using pressSequentially so React's onChange fires on every keystroke. */
async function typeInto(page, selector, value) {
  const el = page.locator(selector).first();
  if (!(await el.isVisible().catch(() => false))) return;
  await el.click();
  await el.selectText().catch(() => {});
  await page.keyboard.press('Control+a');
  await el.pressSequentially(value, { delay: 40 });
  await wait(400);
}

async function fill(page, cap, selector, value, caption) {
  if (caption) await cap.show(page, caption);
  await typeInto(page, selector, value);
}

async function select(page, selector, value) {
  const el = page.locator(selector).first();
  if (await el.isVisible().catch(() => false)) {
    await el.selectOption(value).catch(() => {});
    await wait(600);
  }
}

async function login(page, cap, role) {
  const { email, password, label } = CREDS[role];
  await cap.show(page, `Signing in as ${label}…`);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 10000 }).catch(() => {});
  await wait(500);
  await typeInto(page, 'input[type="email"]',    email);
  await typeInto(page, 'input[type="password"]', password);
  await cap.show(page, `Submitting credentials…`);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.includes('/login'), { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await wait(1500);
}

async function dismissModal(page) {
  const esc = ['button:has-text("Cancel")', 'button:has-text("Close")', 'button[aria-label="Close"]'];
  for (const sel of esc) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) { await el.click(); await wait(600); return; }
  }
  await page.keyboard.press('Escape');
  await wait(600);
}

async function tryApproveFirst(page, cap, label) {
  await wait(1500);
  const btn = page.locator('button:has-text("Approve")').first();
  if (await btn.isVisible().catch(() => false)) {
    await cap.show(page, `Approving first item in ${label} queue`);
    await btn.click();
    await wait(1000);
    const confirm = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Approve")').nth(1);
    if (await confirm.isVisible().catch(() => false)) { await confirm.click(); await wait(1000); }
    await cap.show(page, `✓ Item approved successfully`);
    await wait(2000);
  } else {
    await cap.show(page, `${label} queue is empty — nothing pending`);
    await wait(2000);
  }
}

// ── per-role scenarios ────────────────────────────────────────────────────────

async function runAdmin(page, cap) {
  await login(page, cap, 'admin');

  // Dashboard (already here after login redirect)
  await cap.show(page, 'Admin Dashboard — System-wide overview of all metrics', 3500);
  await wait(3500);

  // Analytics
  await go(page, cap, `${BASE}/analytics-page`, 'Analytics — Enrollment trends and subject performance charts', 3000);

  // Faculty Management — create instructor
  await go(page, cap, `${BASE}/user-management`, 'Faculty Management — Viewing all registered users');
  await click(page, cap, 'button:has-text("Add Instructor"), button:has-text("+ Add")', 'Creating a new Instructor account');
  await wait(800);
  await fill(page, cap, 'input[placeholder*="Full Name"], input[name="full_name"]', 'Dr. Jose Rizal', null);
  await fill(page, cap, 'input[type="email"]',    'jose.rizal@btech.edu', null);
  await fill(page, cap, 'input[type="password"]', 'Instructor@2024!',       null);
  // College dropdown
  const collegeSelect = page.locator('select').filter({ hasText: /college|institute/i }).first();
  if (await collegeSelect.isVisible().catch(() => false)) {
    await collegeSelect.selectOption({ index: 1 }).catch(() => {});
  }
  await cap.show(page, 'Filling instructor details — name, email, password, college');
  await wait(1000);
  await click(page, cap, 'button:has-text("Create Instructor"), button[type="submit"]:has-text("Create")', 'Submitting new instructor account…');
  await wait(2000);

  // Processing Module
  await go(page, cap, `${BASE}/admin/processing`, 'Ingestion Module — Upload assessment CSV files for AI processing', 3000);

  // Resource Library — add resource
  await go(page, cap, `${BASE}/resource-library`, 'Resource Library — Repository of remedial learning materials');
  await click(page, cap, 'button:has-text("Add Resource"), button:has-text("+ Add Resource")', 'Adding a new learning resource');
  await wait(800);
  await fill(page, cap, 'input[placeholder*="Title"], input[name="title"]', 'Introduction to Data Structures — Video Lecture', null);
  const typeSelect = page.locator('select[name="type"], select').first();
  await typeSelect.selectOption('video').catch(() => {});
  await fill(page, cap, 'input[type="url"], input[name="url"], input[placeholder*="URL"]', 'https://www.youtube.com/watch?v=RBSGKlAvoiM', null);
  const diffSelect = page.locator('select[name="difficulty"]').first();
  await diffSelect.selectOption('beginner').catch(() => {});
  await fill(page, cap, 'input[placeholder*="Duration"], input[name="duration"]', '45', null);
  await cap.show(page, 'Filling resource details — title, type, URL, difficulty, duration');
  await wait(1000);
  await click(page, cap, 'button:has-text("Save Resource"), button:has-text("Save")', 'Saving new resource…');
  await wait(2000);

  // Audit Logs
  await go(page, cap, `${BASE}/audit-logs`, 'Audit Logs — Full trail of all system activity', 3000);

  // Programs — create
  await go(page, cap, `${BASE}/admin/programs`, 'Academic Programs — Managing degree programs offered by BTECH');
  await click(page, cap, 'button:has-text("Add Program"), button:has-text("+ Add Program")', 'Creating a new academic program');
  await wait(800);
  await fill(page, cap, 'input[placeholder*="Program Name"], input[name="program_name"], input[name="name"]',
    'Bachelor of Secondary Education', null);
  const degreeSelect = page.locator('select[name="degree_type"], select').first();
  await degreeSelect.selectOption('Bachelor').catch(() => degreeSelect.selectOption({ index: 1 }).catch(() => {}));
  await fill(page, cap, 'input[placeholder*="CMO"], input[name="ched_cmo"]', 'CMO No. 75 s. 2017', null);
  await fill(page, cap, 'input[placeholder*="Units"], input[name="total_units"]', '153', null);
  await cap.show(page, 'Filling program details — name, degree type, CHED CMO, total units');
  await wait(1000);
  await click(page, cap, 'button:has-text("Create Program"), button[type="submit"]:has-text("Create")', 'Submitting new academic program…');
  await wait(2000);

  // Curricula — create
  await go(page, cap, `${BASE}/admin/curricula`, 'Curricula — Managing curriculum versions per program');
  await click(page, cap, 'button:has-text("Add Curriculum"), button:has-text("+ Add Curriculum")', 'Creating a curriculum for the new program');
  await wait(800);
  const progSelect = page.locator('select[name="program_id"], select').first();
  await progSelect.selectOption({ index: 1 }).catch(() => {});
  await fill(page, cap, 'input[placeholder*="Curriculum Name"], input[name="name"]', 'BSEd Curriculum 2024', null);
  await fill(page, cap, 'input[placeholder*="2018"], input[name="effective_year"]', '2024', null);
  await fill(page, cap, 'input[placeholder*="178"], input[name="total_units"]', '153', null);
  await cap.show(page, 'Linking curriculum to program — name, effective year, total units');
  await wait(1000);
  await click(page, cap, 'button:has-text("Create"), button[type="submit"]', 'Creating curriculum record…');
  await wait(2000);

  // Sections — create
  await go(page, cap, `${BASE}/admin/sections`, 'Sections — Class sections assigned to curricula and year levels');
  await click(page, cap, 'button:has-text("Add Section"), button:has-text("+ Add Section")', 'Adding a new class section');
  await wait(800);
  const currSelect = page.locator('select[name="curriculum_id"], select').first();
  await currSelect.selectOption({ index: 1 }).catch(() => {});
  await fill(page, cap, 'input[placeholder*="BSIT-1A"], input[name="name"], input[name="section_name"]', 'BSEd-1A', null);
  const yrSelect = page.locator('select[name="year_level"]').first();
  await yrSelect.selectOption('1').catch(() => {});
  await fill(page, cap, 'input[placeholder*="2025-2026"], input[name="academic_year"]', '2025-2026', null);
  await cap.show(page, 'Filling section — curriculum, name, year level, academic year');
  await wait(1000);
  await click(page, cap, 'button:has-text("Create Section"), button[type="submit"]:has-text("Create")', 'Creating class section…');
  await wait(2000);

  // Enrollment
  await go(page, cap, `${BASE}/admin/enrollment`, 'Enrollment — Assigning students to sections and curricula', 3000);

  // SUS Survey
  await go(page, cap, `${BASE}/sus-survey`, 'System Usability Survey — Collecting usability feedback');
  await wait(1000);
  for (let q = 1; q <= 10; q++) {
    const score = [4,2,4,2,4,2,5,2,4,2][q-1];
    const btn = page.locator(`button:has-text("${score}")`).nth(q - 1);
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await wait(300);
    }
  }
  await cap.show(page, 'Completing all 10 SUS questions — rating system usability');
  await wait(1500);
  await click(page, cap, 'button[type="submit"]:has-text("Submit")', 'Submitting SUS survey…');
  await wait(3000);
  await cap.show(page, 'Admin session complete — all features demonstrated');
  await wait(2000);
}

async function runInstructor(page, cap) {
  await login(page, cap, 'instructor');

  // Dashboard (already here after login redirect)
  await cap.show(page, 'Instructor Dashboard — Class performance and pending tasks', 3500);
  await wait(3500);
  await go(page, cap, `${BASE}/my-classes`, 'My Classes — Students enrolled in my courses with risk indicators', 3000);
  await go(page, cap, `${BASE}/instructor/my-syllabi`, 'My Syllabi — Upload and track syllabus approval status', 3000);
  await go(page, cap, `${BASE}/instructor/processing`, 'Ingestion Module — Upload CSV grade files for AI topic mapping', 3000);

  // Grade Submissions — create
  await go(page, cap, `${BASE}/instructor/grade-submissions`, 'Grade Submissions — Submit graded assessments for review');
  await wait(1000);
  const courseSelect = page.locator('select[name="course_id"], select').first();
  if (await courseSelect.isVisible().catch(() => false)) {
    await cap.show(page, 'Selecting course and grading period for submission');
    await courseSelect.selectOption({ index: 1 }).catch(() => {});
    await wait(500);
    const periodSelect = page.locator('select[name="grading_period"]').first();
    await periodSelect.selectOption('Prelim').catch(() => periodSelect.selectOption({ index: 1 }).catch(() => {}));
    await wait(500);
    const notesField = page.locator('textarea[name="notes"]').first();
    if (await notesField.isVisible().catch(() => false)) {
      await notesField.fill('Prelim period grades — all students assessed');
    }
    await wait(800);
    await click(page, cap, 'button:has-text("Create Submission"), button[type="submit"]', 'Creating grade submission…');
    await wait(1500);
    // Confirm modal
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes, Submit")').first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await cap.show(page, 'Confirming grade submission for review');
      await confirmBtn.click();
      await wait(2000);
    }
  } else {
    await cap.show(page, 'Grade submission form — select course and grading period to submit');
    await wait(2500);
  }

  await go(page, cap, `${BASE}/analytics-page`, 'Analytics — Detailed subject performance and competency breakdown', 3000);
  await go(page, cap, `${BASE}/topic-mapping`, 'Topic Mapping — AI-generated competency coverage per assessment item', 3000);
  await go(page, cap, `${BASE}/intervention-alerts`, 'Intervention Alerts — Students flagged as At-Risk needing action', 3000);
  await go(page, cap, `${BASE}/resource-library`, 'Resource Library — Curated remedial materials by competency', 3000);
  await go(page, cap, `${BASE}/user-management`, 'User Management — Overview of enrolled students', 3000);

  // SUS Survey
  await go(page, cap, `${BASE}/sus-survey`, 'System Usability Survey — Instructor feedback on AILAS');
  for (let q = 1; q <= 10; q++) {
    const score = [5,1,5,1,5,1,5,1,5,1][q-1];
    const btn = page.locator(`button:has-text("${score}")`).nth(q - 1);
    if (await btn.isVisible().catch(() => false)) { await btn.click(); await wait(300); }
  }
  await cap.show(page, 'Submitting instructor usability feedback');
  await wait(1000);
  await click(page, cap, 'button[type="submit"]:has-text("Submit")', 'Survey submitted successfully');
  await wait(3000);
  await cap.show(page, 'Instructor session complete — full teaching workflow demonstrated');
  await wait(2000);
}

async function runStudent(page, cap) {
  await login(page, cap, 'student');

  // Dashboard (already here after login redirect)
  await cap.show(page, 'Student Dashboard — Personal academic risk status and performance summary', 3500);
  await wait(3500);
  await go(page, cap, `${BASE}/my-courses`, 'My Courses — All enrolled courses with competency scores', 3000);
  await go(page, cap, `${BASE}/my-competencies`, 'Competencies — Detailed breakdown of skills mastery per course', 3000);
  await go(page, cap, `${BASE}/interventions`, 'Interventions — AI-recommended remedial resources for weak competencies', 3000);
  await go(page, cap, `${BASE}/settings`, 'Settings — Personal account and notification preferences', 2500);

  // SUS Survey
  await go(page, cap, `${BASE}/sus-survey`, 'System Usability Survey — Student experience feedback');
  for (let q = 1; q <= 10; q++) {
    const score = [4,2,5,1,4,2,5,1,4,2][q-1];
    const btn = page.locator(`button:has-text("${score}")`).nth(q - 1);
    if (await btn.isVisible().catch(() => false)) { await btn.click(); await wait(350); }
  }
  await cap.show(page, 'Student submitting SUS survey — rating usability of learning platform');
  await wait(1000);
  await click(page, cap, 'button[type="submit"]:has-text("Submit")', 'Feedback recorded — thank you!');
  await wait(3000);
  await cap.show(page, 'Student session complete — learning analytics workflow demonstrated');
  await wait(2000);
}

async function runProgramDirector(page, cap) {
  await login(page, cap, 'program_director');

  // Dashboard (already here after login redirect)
  await cap.show(page, 'Program Director Dashboard — College-wide performance metrics', 3500);
  await wait(3500);

  await go(page, cap, `${BASE}/syllabus-approval`, 'Syllabus Approval Queue — Reviewing submitted syllabi from instructors');
  await tryApproveFirst(page, cap, 'Syllabus');

  await go(page, cap, `${BASE}/assessment-approval`, 'Assessment Approval Queue — Validating AI topic mapping results');
  await tryApproveFirst(page, cap, 'Assessment');

  await go(page, cap, `${BASE}/grade-approval`, 'Grade Approval — Final review of submitted grade reports');
  await tryApproveFirst(page, cap, 'Grade Submission');

  await cap.show(page, 'Program Director session complete — full approval workflow demonstrated');
  await wait(2000);
}

async function runDean(page, cap) {
  await login(page, cap, 'dean');

  // Dashboard (already here after login redirect)
  await cap.show(page, 'Dean Dashboard — College academic performance at a glance', 3500);
  await wait(3500);

  await go(page, cap, `${BASE}/syllabus-approval`, 'Syllabus Approval — Dean-level review of curriculum compliance');
  await tryApproveFirst(page, cap, 'Syllabus');

  await go(page, cap, `${BASE}/grade-approval`, 'Grade Approval — Dean sign-off on final grade submissions');
  await tryApproveFirst(page, cap, 'Grade Submission');

  await cap.show(page, 'Dean session complete — college oversight workflow demonstrated');
  await wait(2000);
}

async function runVP(page, cap) {
  await login(page, cap, 'vp_academic_affairs');

  // Dashboard (already here after login redirect)
  await cap.show(page, 'VP Academic Affairs Dashboard — Institution-wide view of all metrics', 3500);
  await wait(3500);

  await go(page, cap, `${BASE}/syllabus-approval`, 'Syllabus Approval — VP final review of institution syllabi');
  await tryApproveFirst(page, cap, 'Syllabus');

  await go(page, cap, `${BASE}/grade-approval`, 'Grade Approval — VP-level endorsement of grade submissions');
  await tryApproveFirst(page, cap, 'Grade Submission');

  await cap.show(page, 'VP Academic Affairs session complete — institution-wide oversight demonstrated');
  await wait(2000);
}

// ── ffmpeg mux ────────────────────────────────────────────────────────────────
function muxSubtitle(videoPath, srtPath, outPath) {
  if (!ffmpegBin) {
    console.log('  ⚠  ffmpeg-static not available — skipping mux (load .srt in VLC alongside .webm)');
    return false;
  }
  console.log('  ↳  Muxing subtitle track…');
  const result = spawnSync(ffmpegBin, [
    '-y', '-i', videoPath, '-i', srtPath,
    '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'srt',
    '-metadata:s:s:0', 'language=eng',
    '-metadata:s:s:0', 'title=English',
    outPath,
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.log('  ⚠  ffmpeg exited', result.status, '— trying MKV container…');
    // fallback: try without audio codec spec
    const r2 = spawnSync(ffmpegBin, [
      '-y', '-i', videoPath, '-i', srtPath,
      '-c', 'copy', '-c:s', 'srt', outPath,
    ], { encoding: 'utf8' });
    return r2.status === 0;
  }
  return true;
}

// ── session runner ────────────────────────────────────────────────────────────
async function runSession(roleKey, runFn) {
  const { label } = CREDS[roleKey];
  const dir = path.join(OUT_ROOT, roleKey);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Recording: ${label}`);
  console.log('═'.repeat(60));

  const browser = await chromium.launch({
    headless: false,
    args: [`--window-size=${W},${H}`, '--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir, size: { width: W, height: H } },
  });

  const page = await context.newPage();
  const cap  = new Captioner();
  cap.start();

  try {
    // Opening title card
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await wait(500);
    await cap.show(page, `AILAS — AI-Assisted Learning Analytics System`, 2500);
    await wait(1000);
    await cap.show(page, `Session: ${label}`, 2500);
    await wait(2000);

    await runFn(page, cap);

    // Closing card
    await cap.show(page, `End of ${label} session — AILAS Demo`, 3000);
    await wait(3500);
  } catch (err) {
    console.error(`  ✖  Error in ${label} session:`, err.message);
  }

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  // Wait a moment for video to flush
  await wait(1500);

  // Write SRT
  const srtPath = path.join(dir, 'session.srt');
  fs.writeFileSync(srtPath, cap.toSrt(), 'utf8');
  console.log(`  ✓  SRT saved → ${srtPath}`);

  if (videoPath && fs.existsSync(videoPath)) {
    const destWebm = path.join(dir, 'session.webm');
    if (videoPath !== destWebm) fs.renameSync(videoPath, destWebm);
    console.log(`  ✓  Video saved → ${destWebm}`);

    const destMkv = path.join(dir, 'session.mkv');
    const ok = muxSubtitle(destWebm, srtPath, destMkv);
    if (ok) console.log(`  ✓  Subtitled video → ${destMkv}`);
  } else {
    console.log(`  ⚠  Video path not found — Playwright may have saved it with a generated name in ${dir}`);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   AILAS Product Demo — Full Role Recording               ║');
  console.log('║   Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH)  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nOutput directory: ${OUT_ROOT}`);
  console.log(`ffmpeg: ${ffmpegBin || 'not available — .srt will be saved separately'}\n`);

  const sessions = [
    ['admin',               runAdmin],
    ['instructor',          runInstructor],
    ['student',             runStudent],
    ['program_director',    runProgramDirector],
    ['dean',                runDean],
    ['vp_academic_affairs', runVP],
  ];

  for (const [role, fn] of sessions) {
    await runSession(role, fn);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   All sessions recorded.                                 ║');
  console.log('║                                                          ║');
  console.log('║   Files per role:                                        ║');
  console.log('║     session.webm  — raw video                            ║');
  console.log('║     session.srt   — subtitle file                        ║');
  console.log('║     session.mkv   — video with embedded soft subtitles   ║');
  console.log('║                                                          ║');
  console.log('║   Tip: VLC auto-loads session.srt when opening .webm     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
})();
