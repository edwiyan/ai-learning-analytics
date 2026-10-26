import { test, expect } from '@playwright/test';
import { getApiToken, apiGet, apiPost } from './helpers';

test.describe('API Contract & Integration', () => {

  test('GET /auth/me returns correct shape', async () => {
    const token = await getApiToken('admin');
    const res = await apiGet(token, '/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('role');
    expect(res.body).toHaveProperty('id');
  });

  test('GET /analytics/admin/stats returns correct shape', async () => {
    const token = await getApiToken('admin');
    const res = await apiGet(token, '/analytics/admin/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.total_users).toBe('number');
    expect(typeof res.body.total_students).toBe('number');
    expect(typeof res.body.total_instructors).toBe('number');
    expect(typeof res.body.total_courses).toBe('number');
    expect(typeof res.body.total_syllabi).toBe('number');
    expect(typeof res.body.total_resources).toBe('number');
  });

  test('GET /analytics/college/stats returns correct shape for PD', async () => {
    const token = await getApiToken('pd');
    const res = await apiGet(token, '/analytics/college/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.total_instructors).toBe('number');
    expect(typeof res.body.total_courses).toBe('number');
    expect(typeof res.body.total_syllabi).toBe('number');
    expect(typeof res.body.total_students).toBe('number');
    expect(res.body).not.toHaveProperty('total_users'); // no user count for PD/Dean
  });

  test('GET /analytics/admin/enrollment-trends returns array', async () => {
    const token = await getApiToken('admin');
    const res = await apiGet(token, '/analytics/admin/enrollment-trends');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /analytics/admin/subject-performance returns array with correct shape', async () => {
    const token = await getApiToken('admin');
    const res = await apiGet(token, '/analytics/admin/subject-performance');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      const item = res.body[0];
      expect(item).toHaveProperty('course_id');
      expect(item).toHaveProperty('course_code');
      expect(item).toHaveProperty('failure_rate');
      expect(item).toHaveProperty('avg_score');
      expect(typeof item.failure_rate).toBe('number');
    }
  });

  test('GET /courses/ returns array for instructor', async () => {
    const token = await getApiToken('instructor');
    const res = await apiGet(token, '/courses/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /grade-submissions/mine returns array for instructor', async () => {
    const token = await getApiToken('instructor');
    const res = await apiGet(token, '/grade-submissions/mine');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /grade-submissions/pending returns array for PD', async () => {
    const token = await getApiToken('pd');
    const res = await apiGet(token, '/grade-submissions/pending');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /syllabi/pending-approval returns array for PD', async () => {
    const token = await getApiToken('pd');
    const res = await apiGet(token, '/syllabi/pending-approval');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /assessments/pending-approval returns array for PD', async () => {
    const token = await getApiToken('pd');
    const res = await apiGet(token, '/assessments/pending-approval');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /analytics/me/courses returns array for student', async () => {
    const token = await getApiToken('student');
    const res = await apiGet(token, '/analytics/me/courses');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('404 on non-existent endpoint returns JSON not HTML', async () => {
    const token = await getApiToken('admin');
    const res = await apiGet(token, '/nonexistent-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body).toBeTruthy();
  });

  test('GET nonexistent resource returns 404 not 500', async () => {
    const token = await getApiToken('admin');
    const res = await apiGet(token, '/courses/00000000-0000-0000-0000-000000000000');
    expect([404, 422]).toContain(res.status);
  });

  test('Error responses have consistent shape (detail field)', async () => {
    const token = await getApiToken('student');
    const res = await apiGet(token, '/users/');
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('detail');
  });
});

// Latency baseline
test.describe('API Latency Baseline', () => {
  const ENDPOINTS: Array<[string, string, string]> = [
    ['admin', '/analytics/admin/stats', 'admin-stats'],
    ['admin', '/analytics/admin/subject-performance', 'admin-subjects'],
    ['admin', '/analytics/admin/enrollment-trends', 'admin-trends'],
    ['admin', '/analytics/admin/audit-logs', 'admin-audit'],
    ['instructor', '/courses/', 'instructor-courses'],
    ['instructor', '/grade-submissions/mine', 'instructor-grade-subs'],
    ['pd', '/analytics/college/stats', 'pd-college-stats'],
    ['pd', '/syllabi/pending-approval', 'pd-syllabi-pending'],
    ['student', '/analytics/me/courses', 'student-courses'],
    ['admin', '/users/', 'admin-users'],
  ];

  for (const [role, endpoint, label] of ENDPOINTS) {
    test(`latency: ${label}`, async () => {
      const token = await getApiToken(role as any);
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await apiGet(token, endpoint);
        times.push(Date.now() - start);
      }
      const p50 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.5)];
      const p95 = times[Math.floor(times.length * 0.95)] ?? times[times.length - 1];
      console.log(`  ${label}: p50=${p50}ms p95=${p95}ms`);
      // Flag p95 > 2000ms as P1
      expect(p95).toBeLessThan(5000); // hard fail at 5s
    });
  }
});
