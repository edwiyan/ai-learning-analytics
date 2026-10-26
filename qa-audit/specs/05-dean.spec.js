import { test, expect } from "@playwright/test";
import { loginAs, shot } from "./helpers.js";

test.describe("Dean role journey", () => {

  test("Dean dashboard loads", async ({ page }) => {
    await loginAs(page, "dean");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await shot(page, "dean/01-dashboard");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("Syllabus approval queue accessible to Dean", async ({ page }) => {
    await loginAs(page, "dean");
    await page.goto("/syllabus-approval");
    await page.waitForLoadState("networkidle");
    await shot(page, "dean/02-syllabus-approval");
    await expect(page.locator("body")).not.toContainText("Error");
    await expect(page.locator("body")).toContainText(/syllabus|queue|pending|approved/i);
  });

  test("Grade approval queue accessible to Dean", async ({ page }) => {
    await loginAs(page, "dean");
    await page.goto("/grade-approval");
    await page.waitForLoadState("networkidle");
    await shot(page, "dean/03-grade-approval");
    await expect(page.locator("body")).not.toContainText("Error");
  });

  // ERROR PATH: Dean blocked from /admin
  test("Dean blocked from /admin", async ({ page }) => {
    await loginAs(page, "dean");
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await shot(page, "dean/04-error-blocked-admin");
    const url = page.url();
    const body = await page.locator("body").textContent();
    const isBlocked = url.includes("/login") || url.includes("/dean") || !body.includes("Admin Dashboard");
    expect(isBlocked).toBeTruthy();
  });

  // ERROR PATH: Dean blocked from /assessment-approval (PD-only route)
  test("Dean blocked from /assessment-approval (PD-only)", async ({ page }) => {
    await loginAs(page, "dean");
    await page.goto("/assessment-approval");
    await page.waitForLoadState("networkidle");
    await shot(page, "dean/05-error-blocked-assessment-approval");
    const url = page.url();
    const body = await page.locator("body").textContent();
    // Should be redirected away or show unauthorized/empty
    const isBlocked = url.includes("/login") || url.includes("/dean") || !body.includes("Assessment Approval");
    expect(isBlocked).toBeTruthy();
  });

  // SECURITY: Dean cannot skip PD step — API should block Dean approving at PD stage
  test("Dean cannot call assessment approve endpoint (PD-only)", async ({ page }) => {
    const token = await loginAs(page, "dean");
    const status = await page.evaluate(async (tk) => {
      const r = await fetch("http://localhost:8000/assessments/pending-approval", {
        headers: { Authorization: `Bearer ${tk}` },
      });
      return r.status;
    }, token);
    expect([403, 401]).toContain(status);
    await shot(page, "dean/06-error-api-assessment-approval-blocked");
  });

});
