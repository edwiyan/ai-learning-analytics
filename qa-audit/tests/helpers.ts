import { Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

export const CREDS = {
  admin:      { email: 'admin@ailas.edu',                          password: 'Admin@1234',    role: 'admin' },
  student:    { email: 'andrea.reyes@students.btech.edu',          password: 'Student@1234',  role: 'student' },
  instructor: { email: 'maria.santos@btech.edu',                   password: 'Demo@1234',     role: 'instructor' },
  pd:         { email: 'pd@ailas.edu',                             password: 'PD@1234',       role: 'program_director' },
  dean:       { email: 'dean@ailas.edu',                           password: 'Dean@1234',     role: 'dean' },
  vp:         { email: 'vp@ailas.edu',                             password: 'VP@1234',       role: 'vp_academic_affairs' },
};

export async function login(page: Page, role: keyof typeof CREDS) {
  const cred = CREDS[role];
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', cred.email);
  await page.fill('input[type="password"], input[name="password"]', cred.password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

export async function screenshot(page: Page, role: string, name: string) {
  const dir = path.join(__dirname, '..', 'screenshots', role);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    fullPage: true,
  });
}

export async function screenshotVisual(page: Page, name: string) {
  const dir = path.join(__dirname, '..', 'screenshots', 'visual');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

export async function getApiToken(role: keyof typeof CREDS): Promise<string> {
  const cred = CREDS[role];
  const resp = await fetch('http://localhost:8000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cred.email, password: cred.password }),
  });
  const data = await resp.json() as any;
  return data.access_token;
}

export async function apiGet(token: string, path: string) {
  const resp = await fetch(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: resp.status, body: await resp.json().catch(() => null) };
}

export async function apiPost(token: string, path: string, body: object = {}) {
  const resp = await fetch(`http://localhost:8000${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: resp.status, body: await resp.json().catch(() => null) };
}
