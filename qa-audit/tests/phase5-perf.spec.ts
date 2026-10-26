import { test, expect } from '@playwright/test';
import { login, screenshot } from './helpers';

const HEAVY_PAGES = [
  { role: 'admin' as const,      path: '/',          label: 'admin-dashboard' },
  { role: 'pd' as const,         path: '/',          label: 'pd-dashboard' },
  { role: 'vp' as const,         path: '/',          label: 'vp-dashboard' },
  { role: 'instructor' as const, path: '/my-classes', label: 'instructor-my-classes' },
  { role: 'student' as const,    path: '/analytics', label: 'student-analytics' },
];

test.describe('Performance: Page Load Timing', () => {
  for (const { role, path, label } of HEAVY_PAGES) {
    test(`load time: ${label}`, async ({ page }) => {
      await login(page, role);

      const startNav = Date.now();
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startNav;

      await page.waitForTimeout(1500);
      await screenshot(page, role, `perf-${label}`);

      // Collect performance metrics
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const apiCalls = resources.filter(r => r.name.includes('localhost:8000'));
        return {
          domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
          loadEvent: nav ? Math.round(nav.loadEventEnd) : null,
          apiCallCount: apiCalls.length,
          slowestApi: apiCalls.reduce((max, r) => r.duration > max.duration ? r : max, { duration: 0, name: '' } as any),
          totalTransfer: Math.round(resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024),
        };
      });

      console.log(`[PERF] ${label}:`);
      console.log(`  Wall-clock load: ${loadTime}ms`);
      console.log(`  DOM content loaded: ${metrics.domContentLoaded}ms`);
      console.log(`  API calls on mount: ${metrics.apiCallCount}`);
      console.log(`  Slowest API: ${metrics.slowestApi?.name} (${Math.round(metrics.slowestApi?.duration)}ms)`);
      console.log(`  Total transferred: ${metrics.totalTransfer}KB`);

      // Soft threshold: warn at 3s
      if (loadTime > 3000) {
        console.warn(`  WARNING: ${label} load time ${loadTime}ms exceeds 3s threshold`);
      }

      expect(loadTime).toBeLessThan(15000); // hard fail at 15s
    });
  }
});

test.describe('Performance: Re-render Check', () => {
  test('admin dashboard does not loop-fetch', async ({ page }) => {
    await login(page, 'admin');
    const apiCalls: string[] = [];
    page.on('request', req => {
      if (req.url().includes('localhost:8000')) apiCalls.push(req.url());
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // watch for 3 seconds after load
    const afterLoad = apiCalls.length;
    await page.waitForTimeout(3000); // 3 more seconds
    const delta = apiCalls.length - afterLoad;
    console.log(`[RENDER] admin-dashboard: ${afterLoad} calls on load, ${delta} extra calls in 3s idle`);
    expect(delta).toBeLessThan(5); // should not be polling after load
  });
});
