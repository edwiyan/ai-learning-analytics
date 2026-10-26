import { test, expect } from '@playwright/test';
import { login, screenshot, screenshotVisual } from './helpers';

const ALL_PAGES = [
  { role: 'admin' as const,      path: '/',                    label: 'admin-dashboard' },
  { role: 'admin' as const,      path: '/admin/users',         label: 'admin-users' },
  { role: 'admin' as const,      path: '/audit-logs',          label: 'admin-audit' },
  { role: 'instructor' as const, path: '/',                    label: 'instructor-dashboard' },
  { role: 'instructor' as const, path: '/my-classes',          label: 'instructor-classes' },
  { role: 'instructor' as const, path: '/grade-submissions',   label: 'instructor-grades' },
  { role: 'instructor' as const, path: '/my-syllabi',          label: 'instructor-syllabi' },
  { role: 'student' as const,    path: '/',                    label: 'student-dashboard' },
  { role: 'student' as const,    path: '/analytics',           label: 'student-analytics' },
  { role: 'student' as const,    path: '/resources',           label: 'student-resources' },
  { role: 'pd' as const,         path: '/',                    label: 'pd-dashboard' },
  { role: 'pd' as const,         path: '/syllabus-approval',   label: 'pd-syllabus-queue' },
  { role: 'dean' as const,       path: '/',                    label: 'dean-dashboard' },
  { role: 'vp' as const,         path: '/',                    label: 'vp-dashboard' },
];

test.describe('Visual: Desktop Screenshots (1440x900)', () => {
  for (const { role, path, label } of ALL_PAGES) {
    test(`desktop: ${label}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await login(page, role);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await screenshotVisual(page, `desktop-${label}`);

      // Check for visible console errors
      const errors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      await page.waitForTimeout(500);
      if (errors.length > 0) {
        console.log(`[CONSOLE ERRORS] ${label}: ${errors.join(' | ')}`);
      }
    });
  }
});

test.describe('Visual: Mobile Screenshots (390x844)', () => {
  for (const { role, path, label } of ALL_PAGES) {
    test(`mobile: ${label}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, role);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await screenshotVisual(page, `mobile-${label}`);

      // Check horizontal scroll (mobile breakage indicator)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      if (hasHorizontalScroll) {
        console.warn(`[MOBILE] ${label}: horizontal scroll detected (layout overflow)`);
      }
      console.log(`[MOBILE] ${label}: horizontal-scroll=${hasHorizontalScroll}`);
    });
  }
});

test.describe('UX: Empty States & Error States', () => {
  test('404 page renders meaningful content', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/this-page-does-not-exist-xyz');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await screenshotVisual(page, 'error-404');
    const body = await page.textContent('body');
    const hasMessage = body && (body.includes('404') || body.includes('not found') || body.includes('Not Found'));
    console.log(`[404] page has error message: ${!!hasMessage}`);
  });

  test('login page with wrong credentials shows inline error', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"], input[name="email"]', 'nobody@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await screenshotVisual(page, 'error-invalid-login');
    const errorText = await page.locator('text=/invalid|incorrect|wrong|error/i').isVisible().catch(() => false);
    console.log(`[ERROR STATE] invalid login shows error: ${errorText}`);
  });

  test('grade submissions empty state', async ({ page }) => {
    await login(page, 'instructor');
    await page.goto('/grade-submissions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshotVisual(page, 'empty-grade-submissions');
  });

  test('admin dashboard — check for debug artifacts', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' || (msg.type() === 'warn' && msg.text().includes('Warning:'))) {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    await login(page, 'admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    if (consoleErrors.length > 0) {
      console.log(`[CONSOLE] admin-dashboard errors:\n${consoleErrors.slice(0, 10).join('\n')}`);
    }
    console.log(`[CONSOLE] admin-dashboard: ${consoleErrors.length} console errors/warnings`);
  });
});
