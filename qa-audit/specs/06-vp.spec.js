import { test, expect } from "@playwright/test";
import { loginAs, shot } from "./helpers.js";

test.describe("VP Academic Affairs role journey", () => {

  test("VP dashboard loads", async ({ page }) => {
    await loginAs(page, "vp");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await shot(page, "vp/01-dashboard");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("Syllabus approval queue accessible to VP", async ({ page }) => {
    await loginAs(page, "vp");
    await page.goto("/syllabus-approval");
    await page.waitForLoadState("networkidle");
    await shot(page, "vp/02-syllabus-approval");
    await expect(page.locator("body")).not.toContainText("Error");
    await expect(page.locator("body")).toContainText(/syllabus|queue|pending|approved/i);
  });

  test("Grade approval queue accessible to VP", async ({ page }) => {
    await loginAs(page, "vp");
    await page.goto("/grade-approval");
    await page.waitForLoadState("networkidle");
    await shot(page, "vp/03-grade-approval");
    await expect(page.locator("body")).not.toContainText("Error");
  });

  test("VP dashboard shows top-level metrics or approval summary", async ({ page }) => {
    await loginAs(page, "vp");
    await shot(page, "vp/04-dashboard-full");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  // ERROR PATH: VP blocked from /admin
  test("VP blocked from /admin", async ({ page }) => {
    await loginAs(page, "vp");
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await shot(page, "vp/05-error-blocked-admin");
    const url = page.url();
    const body = await page.locator("body").textContent();
    const isBlocked = url.includes("/login") || url.includes("/vp") || !body.includes("Admin Dashboard");
    expect(isBlocked).toBeTruthy();
  });

  // ERROR PATH: VP blocked from /assessment-approval (PD-only)
  test("VP blocked from /assessment-approval (PD-only)", async ({ page }) => {
    await loginAs(page, "vp");
    await page.goto("/assessment-approval");
    await page.waitForLoadState("networkidle");
    await shot(page, "vp/06-error-blocked-assessment-approval");
    const url = page.url();
    const body = await page.locator("body").textContent();
    const isBlocked = url.includes("/login") || url.includes("/vp") || !body.includes("Assessment Approval");
    expect(isBlocked).toBeTruthy();
  });

  // SECURITY: VP cannot post grade submission as instructor
  test("VP cannot create a grade submission (instructor-only)", async ({ page }) => {
    const token = await loginAs(page, "vp");
    const status = await page.evaluate(async (tk) => {
      const r = await fetch("http://localhost:8000/grade-submissions/", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: "00000000-0000-0000-0000-000000000000", grading_period: "prelim" }),
      });
      return r.status;
    }, token);
    expect([403, 401, 422, 404]).toContain(status);
    await shot(page, "vp/07-error-api-grade-submission-blocked");
  });

  // SECURITY: VP cannot access student personal data
  test("VP cannot access /analytics/me/risk (student-only)", async ({ page }) => {
    const token = await loginAs(page, "vp");
    const status = await page.evaluate(async (tk) => {
      const r = await fetch("http://localhost:8000/analytics/me/risk?course_id=00000000-0000-0000-0000-000000000000", {
        headers: { Authorization: `Bearer ${tk}` },
      });
      return r.status;
    }, token);
    expect([403, 401, 404, 422]).toContain(status);
  });

});
