// Shared helpers for all QA specs

export const BASE = "http://localhost:8000";

export const CREDS = {
  admin:      { email: "admin@ailas.edu",                         password: "Admin@1234",    home: "/admin" },
  student:    { email: "andrea.reyes@students.btech.edu",         password: "Student@1234",  home: "/student" },
  instructor: { email: "maria.santos@btech.edu",                  password: "Demo@1234",     home: "/instructor" },
  pd:         { email: "pd@ailas.edu",                            password: "PD@1234",       home: "/program-director" },
  dean:       { email: "dean@ailas.edu",                          password: "Dean@1234",     home: "/dean" },
  vp:         { email: "vp@ailas.edu",                            password: "VP@1234",       home: "/vp" },
};

/** Inject JWT into localStorage so we bypass the UI login form (fast path). */
export async function loginAs(page, role) {
  const { email, password, home } = CREDS[role];

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${role}: ${res.status}`);
  const { access_token } = await res.json();

  await page.goto("/login");
  await page.evaluate((token) => localStorage.setItem("access_token", token), access_token);
  await page.goto(home);
  await page.waitForLoadState("networkidle");
  return access_token;
}

/** Login through the actual UI form (used in admin spec for UI coverage). */
export async function loginViaUI(page, role) {
  const { email, password } = CREDS[role];
  await page.goto("/login");
  await page.locator('input[type="email"], input[name="email"]').fill(email);
  await page.locator('input[type="password"], input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
}

/** Save a full-page screenshot. */
export async function shot(page, name) {
  await page.screenshot({
    path: `qa-audit/screenshots/${name}.png`,
    fullPage: true,
  });
}

/** Clear auth and go to login. */
export async function logout(page) {
  await page.evaluate(() => localStorage.removeItem("access_token"));
  await page.goto("/login");
}
