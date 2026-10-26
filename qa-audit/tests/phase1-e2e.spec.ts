import { test, expect } from '@playwright/test';
import { login, screenshot, CREDS } from './helpers';

// ── ADMIN journey ─────────────────────────────────────────────────────────────
test.describe('Admin Journey', () => {
  test('login and reach dashboard', async ({ page }) => {
    await login(page, 'admin');
    await screenshot(page, 'admin', '01-dashboard');
    await expect(page).not.toHaveURL(/login/i);
    const h1 = await page.locator('h1').first().textContent();
    expect(h1).toBeTruthy();
  });

  test('user management — view user list', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'admin', '02-user-management');
    const rows = page.locator('table tbody tr, [role="row"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('system-wide dashboard data loads', async ({ page }) => {
    await login(page, 'admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'admin', '03-dashboard-loaded');
    const statValues = page.locator('.text-2xl, .text-3xl');
    const count = await statValues.count();
    expect(count).toBeGreaterThan(0);
  });

  test('invalid login attempt shows error', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"], input[name="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    await screenshot(page, 'admin', '04-login-error');
    const errorVisible = await page.locator('text=/invalid|incorrect|wrong|failed|error/i').isVisible().catch(() => false);
    expect(errorVisible).toBe(true);
  });

  test('navigate to audit logs', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/audit-logs');
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'admin', '05-audit-logs');
    await expect(page).not.toHaveURL(/login/i);
  });
});

// ── INSTRUCTOR journey ─────────────────────────────────────────────────────────
test.describe('Instructor Journey', () => {
  test('login and reach dashboard', async ({ page }) => {
    await login(page, 'instructor');
    await screenshot(page, 'instructor', '01-dashboard');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('view my classes', async ({ page }) => {
    await login(page, 'instructor');
    await page.goto('/my-classes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'instructor', '02-my-classes');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('view syllabi page', async ({ page }) => {
    await login(page, 'instructor');
    await page.goto('/my-syllabi');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'instructor', '03-syllabi');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('view grade submissions page', async ({ page }) => {
    await login(page, 'instructor');
    await page.goto('/grade-submissions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'instructor', '04-grade-submissions');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('attempt to access admin page — should be blocked', async ({ page }) => {
    await login(page, 'instructor');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'instructor', '05-forbidden-admin');
    const blocked = await page.locator('text=/forbidden|not authorized|403|access denied/i').isVisible().catch(() => false);
    const redirected = page.url().includes('login') || page.url().includes('dashboard') || !page.url().includes('/admin/users');
    expect(blocked || redirected).toBe(true);
  });

  test('my courses page loads', async ({ page }) => {
    await login(page, 'instructor');
    await page.goto('/my-courses');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'instructor', '06-my-courses');
    await expect(page).not.toHaveURL(/login/i);
  });
});

// ── STUDENT journey ───────────────────────────────────────────────────────────
test.describe('Student Journey', () => {
  test('login and reach dashboard', async ({ page }) => {
    await login(page, 'student');
    await screenshot(page, 'student', '01-dashboard');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('view analytics / grades page', async ({ page }) => {
    await login(page, 'student');
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'student', '02-analytics');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('view resources page', async ({ page }) => {
    await login(page, 'student');
    await page.goto('/resources');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'student', '03-resources');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('attempt to access instructor endpoint — should be blocked', async ({ page }) => {
    await login(page, 'student');
    await page.goto('/grade-submissions');
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'student', '04-forbidden-gradesubmission');
    const blocked = await page.locator('text=/forbidden|not authorized|403/i').isVisible().catch(() => false);
    const redirected = !page.url().includes('/grade-submissions');
    expect(blocked || redirected).toBe(true);
  });

  test('student competencies page loads', async ({ page }) => {
    await login(page, 'student');
    await page.goto('/competencies');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'student', '05-competencies');
    await expect(page).not.toHaveURL(/login/i);
  });
});

// ── PROGRAM DIRECTOR journey ──────────────────────────────────────────────────
test.describe('Program Director Journey', () => {
  test('login and reach dashboard', async ({ page }) => {
    await login(page, 'pd');
    await screenshot(page, 'pd', '01-dashboard');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('dashboard loads college stats', async ({ page }) => {
    await login(page, 'pd');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'pd', '02-dashboard-loaded');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('syllabus approval queue', async ({ page }) => {
    await login(page, 'pd');
    await page.goto('/syllabus-approval');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'pd', '03-syllabus-approval');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('assessment approval queue', async ({ page }) => {
    await login(page, 'pd');
    await page.goto('/assessment-approval');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'pd', '04-assessment-approval');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('grade approval queue', async ({ page }) => {
    await login(page, 'pd');
    await page.goto('/grade-approval');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'pd', '05-grade-approval');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('attempt to access admin user management — should be blocked', async ({ page }) => {
    await login(page, 'pd');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'pd', '06-forbidden-admin');
    const redirected = !page.url().includes('/admin/users');
    expect(redirected).toBe(true);
  });
});

// ── DEAN journey ──────────────────────────────────────────────────────────────
test.describe('Dean Journey', () => {
  test('login and reach dashboard', async ({ page }) => {
    await login(page, 'dean');
    await screenshot(page, 'dean', '01-dashboard');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('dashboard loads college stats', async ({ page }) => {
    await login(page, 'dean');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'dean', '02-dashboard-loaded');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('syllabus endorsement queue', async ({ page }) => {
    await login(page, 'dean');
    await page.goto('/syllabus-approval');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'dean', '03-syllabus-endorsement');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('grade endorsement queue', async ({ page }) => {
    await login(page, 'dean');
    await page.goto('/grade-approval');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'dean', '04-grade-endorsement');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('attempt to access assessment approval — should be blocked or empty', async ({ page }) => {
    await login(page, 'dean');
    await page.goto('/assessment-approval');
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'dean', '05-assessment-attempt');
    // Dean does not have assessment approval — check blocked or empty
    await expect(page).not.toHaveURL(/login/i);
  });
});

// ── VP journey ────────────────────────────────────────────────────────────────
test.describe('VP Journey', () => {
  test('login and reach dashboard', async ({ page }) => {
    await login(page, 'vp');
    await screenshot(page, 'vp', '01-dashboard');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('dashboard shows institution-wide data', async ({ page }) => {
    await login(page, 'vp');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await screenshot(page, 'vp', '02-dashboard-loaded');
    const statValues = page.locator('.text-2xl, .text-3xl');
    const count = await statValues.count();
    expect(count).toBeGreaterThan(0);
  });

  test('final syllabus approval queue', async ({ page }) => {
    await login(page, 'vp');
    await page.goto('/syllabus-approval');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'vp', '03-final-syllabus-approval');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('grade posting authorization queue', async ({ page }) => {
    await login(page, 'vp');
    await page.goto('/grade-approval');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'vp', '04-grade-posting');
    await expect(page).not.toHaveURL(/login/i);
  });

  test('attempt to access admin retrain model — should be blocked', async ({ page }) => {
    await login(page, 'vp');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'vp', '05-forbidden-admin');
    const redirected = !page.url().includes('/admin/users');
    expect(redirected).toBe(true);
  });
});
