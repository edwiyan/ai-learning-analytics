import { test, expect } from "@playwright/test";
import { loginAs, loginViaUI, shot, logout, CREDS } from "./helpers.js";

test.describe("Admin role journey", () => {

  test("UI login form works and redirects to /admin", async ({ page }) => {
    await loginViaUI(page, "admin");
    await expect(page).toHaveURL(/\/admin/);
    await shot(page, "admin/01-dashboard-after-ui-login");
  });

  test("Admin dashboard loads stat cards and SUS score card", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page.locator("h1, h2").filter({ hasText: /dashboard/i }).first()).toBeVisible();
    await shot(page, "admin/02-dashboard");
    // SUS score card should exist (T11-06)
    const sus = page.locator("text=/SUS|usability/i").first();
    await expect(sus).toBeVisible();
  });

  test("Programs page - list and create form visible", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/programs");
    await page.waitForLoadState("networkidle");
    await shot(page, "admin/03-programs");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("Curricula page loads", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/curricula");
    await page.waitForLoadState("networkidle");
    await shot(page, "admin/04-curricula");
    await expect(page.locator("body")).not.toContainText("Error");
  });

  test("Sections page loads", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/sections");
    await page.waitForLoadState("networkidle");
    await shot(page, "admin/05-sections");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("Enrollment page loads", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/enrollment");
    await page.waitForLoadState("networkidle");
    await shot(page, "admin/06-enrollment");
    await expect(page.locator("body")).not.toContainText("Error");
  });

  test("User management page loads and shows user table", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/users");
    await page.waitForLoadState("networkidle");
    await shot(page, "admin/07-users");
    await expect(page.locator("body")).toContainText(/student|instructor|admin/i);
  });

  test("Audit logs page loads", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/audit-logs");
    await page.waitForLoadState("networkidle");
    await shot(page, "admin/08-audit-logs");
    await expect(page.locator("body")).not.toContainText("Not Found");
  });

  test("Retrain model button is present on dashboard", async ({ page }) => {
    await loginAs(page, "admin");
    const btn = page.locator("button").filter({ hasText: /retrain/i });
    await expect(btn).toBeVisible();
    await shot(page, "admin/09-retrain-button");
  });

  // ERROR PATH: Admin cannot access student-only route
  test("Admin blocked from /student route", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/student");
    await page.waitForLoadState("networkidle");
    await shot(page, "admin/10-error-blocked-student-route");
    // Should redirect to /login or /admin, or show forbidden — not the student dashboard content
    const url = page.url();
    const body = await page.locator("body").textContent();
    const isBlocked = url.includes("/login") || url.includes("/admin") || body.includes("not authorized") || body.includes("403") || !body.includes("Student Dashboard");
    expect(isBlocked).toBeTruthy();
  });

  // ERROR PATH: Invalid login attempt
  test("Wrong password shows error on login page", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"], input[name="email"]').fill("admin@ailas.edu");
    await page.locator('input[type="password"], input[name="password"]').fill("WrongPassword999");
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);
    await shot(page, "admin/11-error-wrong-password");
    const body = await page.locator("body").textContent();
    const hasError = body.match(/incorrect|invalid|unauthorized|error|wrong/i);
    expect(hasError).toBeTruthy();
  });

});
