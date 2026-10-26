const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const SHOT_DIR = path.join(__dirname, 'screenshots');

// Only recapture the pages that used wrong routes or failed
const PAGES = [
  { role: 'admin', route: '/admin/programs', label: 'admin-programs' },
  { role: 'admin', route: '/admin/curricula', label: 'admin-curricula' },
  { role: 'admin', route: '/admin/sections', label: 'admin-sections' },
  { role: 'admin', route: '/admin/enrollment', label: 'admin-enrollment' },
  { role: 'admin', route: '/users', label: 'admin-users-raw' },  // capture the proxy bug
  { role: 'admin', route: '/analytics', label: 'admin-analytics' },
  { role: 'pd', route: '/program-director', label: 'pd-dashboard' },
  { role: 'pd', route: '/syllabus-approval', label: 'pd-syllabus' },
  { role: 'dean', route: '/dean', label: 'dean-dashboard' },
  { role: 'vp', route: '/vp', label: 'vp-dashboard' },
  { role: 'student', route: '/sus-survey', label: 'student-sus' },
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
  await page.waitForTimeout(2000);  // Longer wait to avoid rate limiting
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  for (const pg of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    
    if (pg.role) {
      await loginAs(page, pg.role);
      // Add delay between logins to avoid rate limiting
      await page.waitForTimeout(2000);
    }
    
    await page.goto(BASE + pg.route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    const file = path.join(SHOT_DIR, pg.label + '-desktop.png');
    await page.screenshot({ path: file, fullPage: true });
    console.log('Captured: ' + pg.label + '-desktop.png');
    
    await ctx.close();
    await new Promise(r => setTimeout(r, 4500));  // 4.5s delay between logins (stay under 10/min)
  }
  
  await browser.close();
  console.log('Done.');
})();
