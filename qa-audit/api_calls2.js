const { chromium } = require('playwright');

async function login(page, email, password) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

async function captureApiCalls(browser, label, email, password, route) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email, password);
  
  const apiCalls = [];
  page.on('request', r => {
    const type = r.resourceType();
    if (type === 'xhr' || type === 'fetch') {
      const url = r.url().replace('http://localhost:5173', '').replace('http://localhost:8000', '').split('?')[0];
      apiCalls.push({ method: r.method(), url });
    }
  });
  
  await page.goto('http://localhost:5173' + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const counts = {};
  apiCalls.forEach(c => {
    const key = c.method + ' ' + c.url;
    counts[key] = (counts[key] || 0) + 1;
  });
  
  console.log('\n=== ' + label + ' API calls (' + apiCalls.length + ' total) ===');
  Object.entries(counts).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => {
    const flag = v > 1 ? ' *** DUPLICATE x' + v : '';
    console.log('  ' + k + flag);
  });
  
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  await captureApiCalls(browser, 'Admin Dashboard', 'admin@ailas.edu', 'Admin@1234', '/admin');
  await captureApiCalls(browser, 'Instructor Dashboard', 'maria.santos@btech.edu', 'Demo@1234', '/instructor');
  await captureApiCalls(browser, 'Student Dashboard', 'andrea.reyes@students.btech.edu', 'Student@1234', '/student');
  await browser.close();
})();
