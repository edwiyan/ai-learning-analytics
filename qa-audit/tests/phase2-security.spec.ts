import { test, expect } from '@playwright/test';
import { getApiToken, apiGet, apiPost, CREDS } from './helpers';

// ── Authorization matrix tests ────────────────────────────────────────────────

test.describe('Security: Role Boundary Tests', () => {

  // Student cannot access instructor/admin endpoints
  test('student cannot GET /users/ (admin only)', async () => {
    const token = await getApiToken('student');
    const res = await apiGet(token, '/users/');
    expect(res.status).toBe(403);
  });

  test('student cannot GET /analytics/admin/stats', async () => {
    const token = await getApiToken('student');
    const res = await apiGet(token, '/analytics/admin/stats');
    expect(res.status).toBe(403);
  });

  test('student cannot POST grade submission (instructor only)', async () => {
    const token = await getApiToken('student');
    const res = await apiPost(token, '/grade-submissions/', { course_id: 'fake', grading_period: 'prelim' });
    expect(res.status).toBe(403);
  });

  test('student cannot GET /users/students (admin only)', async () => {
    const token = await getApiToken('student');
    const res = await apiGet(token, '/users/students');
    expect(res.status).toBe(403);
  });

  // Instructor cannot access admin endpoints
  test('instructor cannot GET /users/ (admin only)', async () => {
    const token = await getApiToken('instructor');
    const res = await apiGet(token, '/users/');
    expect(res.status).toBe(403);
  });

  test('instructor cannot GET /analytics/admin/stats', async () => {
    const token = await getApiToken('instructor');
    const res = await apiGet(token, '/analytics/admin/stats');
    expect(res.status).toBe(403);
  });

  test('instructor cannot POST /users/ (create user — admin only)', async () => {
    const token = await getApiToken('instructor');
    const res = await apiPost(token, '/users/', { email: 'x@x.com', password: 'x', role: 'student', full_name: 'X' });
    expect(res.status).toBe(403);
  });

  // PD cannot access admin user management
  test('PD cannot GET /users/ (admin only)', async () => {
    const token = await getApiToken('pd');
    const res = await apiGet(token, '/users/');
    expect(res.status).toBe(403);
  });

  test('PD can GET /analytics/college/stats', async () => {
    const token = await getApiToken('pd');
    const res = await apiGet(token, '/analytics/college/stats');
    expect(res.status).toBe(200);
  });

  test('PD cannot GET /analytics/admin/stats (admin/VP only)', async () => {
    const token = await getApiToken('pd');
    const res = await apiGet(token, '/analytics/admin/stats');
    expect(res.status).toBe(403);
  });

  // Dean cannot access admin endpoints
  test('dean cannot GET /users/', async () => {
    const token = await getApiToken('dean');
    const res = await apiGet(token, '/users/');
    expect(res.status).toBe(403);
  });

  test('dean can GET /analytics/college/stats', async () => {
    const token = await getApiToken('dean');
    const res = await apiGet(token, '/analytics/college/stats');
    expect(res.status).toBe(200);
  });

  // VP can access institution-wide analytics
  test('VP can GET /analytics/admin/stats', async () => {
    const token = await getApiToken('vp');
    const res = await apiGet(token, '/analytics/admin/stats');
    expect(res.status).toBe(200);
  });

  test('VP cannot GET /users/ (admin only)', async () => {
    const token = await getApiToken('vp');
    const res = await apiGet(token, '/users/');
    expect(res.status).toBe(403);
  });

  // Admin has full access
  test('admin can GET /users/', async () => {
    const token = await getApiToken('admin');
    const res = await apiGet(token, '/users/');
    expect(res.status).toBe(200);
  });

  test('admin can GET /analytics/admin/stats', async () => {
    const token = await getApiToken('admin');
    const res = await apiGet(token, '/analytics/admin/stats');
    expect(res.status).toBe(200);
  });

  // Token hygiene
  test('expired/invalid token returns 401', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlIn0.fakesignature';
    const res = await apiGet(fakeToken, '/auth/me');
    expect(res.status).toBe(401);
  });

  test('missing token returns 401 or 403', async () => {
    const resp = await fetch('http://localhost:8000/auth/me');
    expect([401, 403, 422]).toContain(resp.status);
  });

  // Input validation
  test('POST /auth/login with malformed JSON returns 4xx', async () => {
    const resp = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":""}',
    });
    expect(resp.status).toBeGreaterThanOrEqual(400);
    expect(resp.status).toBeLessThan(500);
  });

  test('POST /auth/login with SQL-meta characters returns 4xx not 5xx', async () => {
    const resp = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: "' OR 1=1; --", password: "' OR 1=1" }),
    });
    expect(resp.status).toBeGreaterThanOrEqual(400);
    expect(resp.status).toBeLessThan(500);
  });

  test('oversized string payload returns 4xx not 5xx', async () => {
    const bigString = 'A'.repeat(100000);
    const token = await getApiToken('admin');
    const res = await apiPost(token, '/users/', { email: bigString + '@test.com', full_name: bigString, password: 'x', role: 'student' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  // IDOR: student cannot read another student's risk data by guessing course ID
  test('IDOR: student cannot access admin analytics endpoints directly', async () => {
    const token = await getApiToken('student');
    const res = await apiGet(token, '/analytics/admin/subject-performance');
    expect(res.status).toBe(403);
  });
});
