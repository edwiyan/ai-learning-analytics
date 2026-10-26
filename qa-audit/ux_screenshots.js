const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const SHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const PAGES = [
  { role: null, route: '/login', label: 'login' },
  { role: 'admin', route: '/admin', label: 'admin-dashboard' },
  { role: 'admin', route: '/programs', label: 'admin-programs' },
  { role: 'admin', route: '/users', label: 'admin-users' },
  { role: 'admin', route: '/audit-logs', label: 'admin-audit-logs' },
  { role: 'instructor', route: '/instructor', label: 'instructor-dashboard' },
  { role: 'instructor', route: '/my-classes', label: 'instructor-classes' },
  { role: 'instructor', route: '/intervention-alerts', label: 'instructor-interventions' },
  { role: 'student', route: '/student', label: 'student-dashboard' },
  { role: 'student', route: '/my-courses', label: 'student-courses' },
  { role: 'student', route: '/my-competencies', label: 'student-competencies' },
  { role: 'pd', route: '/program-director', label: 'pd-dashboard' },
  { role: 'dean', route: '/dean', label: 'dean-dashboard' },
  { role: 'vp', route: '/vp', label: 'vp-dashboard' },
];

const CREDS = {
  admin: { email: 'admin@ailas.edu', password: 'Admin@1234' },
  instructor: { email: 'maria.santos@btech.edu', password: 'Demo@1234' },
  student: { email: 'andrea.reyes@students.btech.edu', password: 'Student@1234' },
  pd: { email: 'pd@ailas.edu', password: 'PD@1234' },
  dean: { email: 'dean@ailas.edu', password: 'Dean@1234' },
  vp: { email: 'vp@ailas.edu', password: 'VP@1234' },
};

async function loginAs(page, role) {
  const creds = CREDS[role];
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let currentRole = null;
  let tokens = {};  // store per-role localStorage
  
  for (const vp of ['desktop', 'mobile']) {
    console.log('\n--- ' + vp.toUpperCase() + ' ---');
    const viewport = VIEWPORTS[vp];
    
    for (const pg of PAGES) {
      const ctx = await browser.newContext({ viewport });
      const page = await ctx.newPage();
      
      if (pg.role) {
        await loginAs(page, pg.role);
        await page.goto(BASE + pg.route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
      } else {
        await page.goto(BASE + pg.route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
      }
      
      const file = path.join(SHOT_DIR, pg.label + '-' + vp + '.png');
      await page.screenshot({ path: file, fullPage: true });
      console.log('  Captured: ' + pg.label + '-' + vp + '.png');
      
      await ctx.close();
    }
  }
  
  await browser.close();
  console.log('\nAll screenshots saved to qa-audit/screenshots/');
})();
