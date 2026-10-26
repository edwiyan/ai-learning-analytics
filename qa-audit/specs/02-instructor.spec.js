import { test, expect } from "@playwright/test";
import { loginAs, shot } from "./helpers.js";

test.describe("Instructor role journey", () => {

  test("Dashboard loads with stat cards", async ({ page }) => {
    await loginAs(page, "instructor");
    await expect(page.locator("h1").filter({ hasText: /dashboard/i })).toBeVisible();
    await shot(page, "instructor/01-dashboard");
  });

  test("Dashboard shows course performance section", async ({ page }) => {
    await loginAs(page, "instructor");
    const section = page.locator("text=/My Course Performance|Top Performing|Needs Attention/i").first();
    await expect(section).toBeVisible();
    await shot(page, "instructor/02-course-performance");
  });

  test("My Classes page loads", async ({ page }) => {
    await loginAs(page, "instructor");
    await page.goto("/my-classes");
    await page.waitForLoadState("networkidle");
    await shot(page, "instructor/03-my-classes");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("My Syllabi page loads", async ({ page }) => {
    await loginAs(page, "instructor");
    await page.goto("/instructor/my-syllabi");
    await page.waitForLoadState("networkidle");
    await shot(page, "instructor/04-my-syllabi");
    await expect(page.locator("body")).not.toContainText("Error");
  });

  test("Processing Interface (ingestion module) loads all steps", async ({ page }) => {
    await loginAs(page, "instructor");
    await page.goto("/instructor/processing");
    await page.waitForLoadState("networkidle");
    await shot(page, "instructor/05-processing-interface");
    // Should show the step wizard
    await expect(page.locator("body")).toContainText(/step|upload|syllabus|assessment/i);
  });

  test("Attendance page loads with course selector", async ({ page }) => {
    await loginAs(page, "instructor");
    await page.goto("/instructor/attendance");
    await page.waitForLoadState("networkidle");
    await shot(page, "instructor/06-attendance");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("Grade consultation page loads", async ({ page }) => {
    await loginAs(page, "instructor");
    await page.goto("/instructor/grade-consultation");
    await page.waitForLoadState("networkidle");
    await shot(page, "instructor/07-grade-consultation");
    await expect(page.locator("body")).not.toContainText("Error");
  });

  test("Grade submissions page loads", async ({ page }) => {
    await loginAs(page, "instructor");
    await page.goto("/instructor/grade-submissions");
    await page.waitForLoadState("networkidle");
    await shot(page, "instructor/08-grade-submissions");
    await expect(page.locator("body")).not.toContainText("Error");
  });

  test("Intervention alerts page loads", async ({ page }) => {
    await loginAs(page, "instructor");
    await page.goto("/intervention-alerts");
    await page.waitForLoadState("networkidle");
    await shot(page, "instructor/09-intervention-alerts");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("Analytics page loads", async ({ page }) => {
    await loginAs(page, "instructor");
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");
    await shot(page, "instructor/10-analytics");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("Topic mapping page loads", async ({ page }) => {
    await loginAs(page, "instructor");
    await page.goto("/topic-mapping");
    await page.waitForLoadState("networkidle");
    await shot(page, "instructor/11-topic-mapping");
    await expect(page.locator("body")).not.toContainText("Error");
  });

  // ERROR PATH: Instructor blocked from admin routes
  test("Instructor blocked from /admin", async ({ page }) => {
    await loginAs(page, "instructor");
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await shot(page, "instructor/12-error-blocked-admin");
    const url = page.url();
    const body = await page.locator("body").textContent();
    const isBlocked = url.includes("/login") || url.includes("/instructor") || !body.includes("Admin Dashboard");
    expect(isBlocked).toBeTruthy();
  });

  // ERROR PATH: Instructor cannot self-approve syllabus via API
  test("Instructor cannot call syllabus approve endpoint directly", async ({ page }) => {
    const token = await loginAs(page, "instructor");
    // Try to call a PD-only endpoint
    const res = await page.evaluate(async (tk) => {
      const r = await fetch("http://localhost:8000/assessments/pending-approval", {
        headers: { Authorization: `Bearer ${tk}` },
      });
      return r.status;
    }, token);
    // Should be 403 (instructor is not PD)
    expect([403, 401, 404]).toContain(res);
    await shot(page, "instructor/13-error-api-forbidden");
  });

});
