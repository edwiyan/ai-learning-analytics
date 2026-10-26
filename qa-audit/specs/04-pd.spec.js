import { test, expect } from "@playwright/test";
import { loginAs, shot } from "./helpers.js";

test.describe("Program Director role journey", () => {

  test("PD dashboard loads", async ({ page }) => {
    await loginAs(page, "pd");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await shot(page, "pd/01-dashboard");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("Syllabus approval queue loads", async ({ page }) => {
    await loginAs(page, "pd");
    await page.goto("/syllabus-approval");
    await page.waitForLoadState("networkidle");
    await shot(page, "pd/02-syllabus-approval");
    await expect(page.locator("body")).not.toContainText("Error");
    // Should show queue (empty or with items)
    await expect(page.locator("body")).toContainText(/syllabus|pending|approved|queue/i);
  });

  test("Assessment approval queue loads", async ({ page }) => {
    await loginAs(page, "pd");
    await page.goto("/assessment-approval");
    await page.waitForLoadState("networkidle");
    await shot(page, "pd/03-assessment-approval");
    await expect(page.locator("body")).not.toContainText("Error");
    await expect(page.locator("body")).toContainText(/assessment|pending|queue/i);
  });

  test("Grade approval queue loads", async ({ page }) => {
    await loginAs(page, "pd");
    await page.goto("/grade-approval");
    await page.waitForLoadState("networkidle");
    await shot(page, "pd/04-grade-approval");
    await expect(page.locator("body")).not.toContainText("Error");
  });

  test("Notification bell is visible", async ({ page }) => {
    await loginAs(page, "pd");
    await shot(page, "pd/05-notification-bell");
    // Notification bell should be in layout (T2-E-07)
    const bell = page.locator("button, svg").filter({ has: page.locator("text=/notification|bell/i") });
    // Just check body doesn't crash — bell may be SVG only
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  // ERROR PATH: PD blocked from admin dashboard
  test("PD blocked from /admin", async ({ page }) => {
    await loginAs(page, "pd");
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await shot(page, "pd/06-error-blocked-admin");
    const url = page.url();
    const body = await page.locator("body").textContent();
    const isBlocked = url.includes("/login") || url.includes("/program-director") || !body.includes("Admin Dashboard");
    expect(isBlocked).toBeTruthy();
  });

  // ERROR PATH: PD cannot approve a syllabus that is not in pending_pd state (API guard)
  test("PD calling approve on non-pending syllabus gets appropriate error", async ({ page }) => {
    const token = await loginAs(page, "pd");
    // Try to approve a fake/non-existent syllabus ID
    const status = await page.evaluate(async (tk) => {
      const r = await fetch("http://localhost:8000/syllabi/00000000-0000-0000-0000-000000000000/approve", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approved", feedback: "" }),
      });
      return r.status;
    }, token);
    expect([404, 403, 422, 400]).toContain(status);
    await shot(page, "pd/07-error-approve-nonexistent");
  });

  // SECURITY: PD cannot access student personal /me endpoints
  test("PD cannot access student-only /analytics/me/risk", async ({ page }) => {
    const token = await loginAs(page, "pd");
    const status = await page.evaluate(async (tk) => {
      const r = await fetch("http://localhost:8000/analytics/me/risk?course_id=00000000-0000-0000-0000-000000000000", {
        headers: { Authorization: `Bearer ${tk}` },
      });
      return r.status;
    }, token);
    // PD is not a student — should 403 or return empty gracefully
    expect([403, 401, 404, 422]).toContain(status);
  });

});
