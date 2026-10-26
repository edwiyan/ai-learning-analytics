const { chromium } = require('playwright');

const ROLES = {
  admin: { email: 'admin@ailas.edu', password: 'Admin@1234', route: '/admin' },
  instructor: { email: 'maria.santos@btech.edu', password: 'Demo@1234', route: '/instructor' },
  student: { email: 'andrea.reyes@students.btech.edu', password: 'Student@1234', route: '/student' }
};

async function measurePage(page, label, url) {
  await page.evaluate(() => {
    window.__perfStart = performance.now();
  });
  
  const requests = [];
  page.on('request', r => requests.push({ url: r.url(), type: r.resourceType(), time: Date.now() }));
  
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const loadTime = Date.now() - t0;
  
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = Object.fromEntries(
      performance.getEntriesByType('paint').map(p => [p.name, p.startTime])
    );
    return {
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.fetchStart : null,
      loadComplete: nav ? nav.loadEventEnd - nav.fetchStart : null,
      fcp: paints['first-contentful-paint'] || null,
      transferSize: nav ? nav.transferSize : null,
      encodedBodySize: nav ? nav.encodedBodySize : null,
    };
  });
  
  const jsReqs = requests.filter(r => r.type === 'script').length;
  const xhrReqs = requests.filter(r => r.type === 'xhr' || r.type === 'fetch').length;
  const totalReqs = requests.length;
  
  return { label, url, loadTime, metrics, jsReqs, xhrReqs, totalReqs };
}

async function login(page, email, password) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  
  // Login page (no auth)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const r = await measurePage(page, 'Login', 'http://localhost:5173/login');
    results.push(r);
    await ctx.close();
  }
  
  // Authenticated pages
  for (const [role, creds] of Object.entries(ROLES)) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, creds.email, creds.password);
    
    const r = await measurePage(page, role + ' dashboard', 'http://localhost:5173' + creds.route);
    results.push(r);
    await ctx.close();
  }
  
  await browser.close();
  
  console.log(JSON.stringify(results, null, 2));
})();
