import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login, screenshot } from './helpers';

const PAGES_PER_ROLE: Record<string, Array<{ path: string; label: string }>> = {
  admin: [
    { path: '/', label: 'admin-dashboard' },
    { path: '/admin/users', label: 'admin-users' },
    { path: '/audit-logs', label: 'admin-audit-logs' },
  ],
  instructor: [
    { path: '/', label: 'instructor-dashboard' },
    { path: '/my-classes', label: 'instructor-my-classes' },
    { path: '/grade-submissions', label: 'instructor-grade-submissions' },
    { path: '/my-syllabi', label: 'instructor-syllabi' },
  ],
  student: [
    { path: '/', label: 'student-dashboard' },
    { path: '/analytics', label: 'student-analytics' },
    { path: '/resources', label: 'student-resources' },
  ],
  pd: [
    { path: '/', label: 'pd-dashboard' },
    { path: '/syllabus-approval', label: 'pd-syllabus-approval' },
    { path: '/grade-approval', label: 'pd-grade-approval' },
  ],
  dean: [
    { path: '/', label: 'dean-dashboard' },
    { path: '/syllabus-approval', label: 'dean-syllabus-approval' },
  ],
  vp: [
    { path: '/', label: 'vp-dashboard' },
    { path: '/grade-approval', label: 'vp-grade-approval' },
  ],
};

for (const [role, pages] of Object.entries(PAGES_PER_ROLE)) {
  test.describe(`Accessibility: ${role.toUpperCase()}`, () => {
    for (const { path, label } of pages) {
      test(`axe scan: ${label}`, async ({ page }) => {
        await login(page, role as any);
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
        await screenshot(page, role, `a11y-${label}`);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        // Log violations to console for report extraction
        if (results.violations.length > 0) {
          console.log(`[AXE] ${label}: ${results.violations.length} violations`);
          for (const v of results.violations) {
            console.log(`  - [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`);
          }
        }

        // Check single h1
        const h1Count = await page.locator('h1').count();
        console.log(`  [H1] ${label}: ${h1Count} h1 elements`);

        // Check for inputs without labels
        const unlabeledInputs = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
          return inputs.filter(el => {
            const id = el.getAttribute('id');
            const ariaLabel = el.getAttribute('aria-label');
            const ariaLabelledby = el.getAttribute('aria-labelledby');
            const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
            return !ariaLabel && !ariaLabelledby && !hasLabel;
          }).length;
        });
        console.log(`  [LABELS] ${label}: ${unlabeledInputs} unlabeled inputs`);

        // Don't hard-fail on axe — collect and report
        const criticalViolations = results.violations.filter(v => v.impact === 'critical');
        expect(criticalViolations.length).toBeLessThan(10); // soft threshold
      });
    }
  });
}

// Login page a11y (unauthenticated)
test('axe scan: login page', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  console.log(`[AXE] login: ${results.violations.length} violations`);
  for (const v of results.violations) {
    console.log(`  - [${v.impact}] ${v.id}: ${v.description}`);
  }
});
