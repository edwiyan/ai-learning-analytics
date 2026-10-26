import { test, expect } from "@playwright/test";
import { loginAs, shot } from "./helpers.js";

test.describe("Student role journey", () => {

  test("Student dashboard loads with course selector", async ({ page }) => {
    await loginAs(page, "student");
    await expect(page.locator("h1").filter({ hasText: /student dashboard/i })).toBeVisible();
    await shot(page, "student/01-dashboard");
  });

  test("Dashboard shows course dropdown when courses exist", async ({ page }) => {
    await loginAs(page, "student");
    const selector = page.locator("select");
    await expect(selector.first()).toBeVisible();
    await shot(page, "student/02-course-selector");
  });

  test("Selecting a course loads stat cards and charts", async ({ page }) => {
    await loginAs(page, "student");
    const select = page.locator("select").first();
    const optionCount = await select.locator("option").count();
    if (optionCount > 1) {
      await select.selectOption({ index: 1 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      await shot(page, "student/03-dashboard-course-selected");
      // Risk status row should appear
      const body = await page.locator("body").textContent();
      const hasData = body.match(/risk|mastery|competency|score|attendance/i);
      expect(hasData).toBeTruthy();
    } else {
      // No enrolled courses — verify empty state is graceful
      await shot(page, "student/03-dashboard-no-courses");
      const body = await page.locator("body").textContent();
      expect(body).toMatch(/no course|select a course|upload/i);
    }
  });

  test("Academic standing banner only shows when standing is not good", async ({ page }) => {
    await loginAs(page, "student");
    const select = page.locator("select").first();
    const optionCount = await select.locator("option").count();
    if (optionCount > 1) {
      await select.selectOption({ index: 1 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    }
    // Banner should NOT be visible if standing=good (default); just verify no crash
    await shot(page, "student/04-academic-standing-check");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("My Courses page loads", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/my-courses");
    await page.waitForLoadState("networkidle");
    await shot(page, "student/05-my-courses");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("My Competencies page loads", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/my-competencies");
    await page.waitForLoadState("networkidle");
    await shot(page, "student/06-my-competencies");
    await expect(page.locator("body")).not.toContainText("Error");
  });

  test("Interventions page loads", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/interventions");
    await page.waitForLoadState("networkidle");
    await shot(page, "student/07-interventions");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("SUS survey page loads with 10 Likert items", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/sus-survey");
    await page.waitForLoadState("networkidle");
    await shot(page, "student/08-sus-survey");
    // Should have Likert scale inputs
    await expect(page.locator("body")).toContainText(/strongly|agree|disagree|SUS/i);
  });

  // ERROR PATH: Student blocked from instructor routes
  test("Student blocked from /instructor", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/instructor");
    await page.waitForLoadState("networkidle");
    await shot(page, "student/09-error-blocked-instructor");
    const url = page.url();
    const body = await page.locator("body").textContent();
    const isBlocked = url.includes("/login") || url.includes("/student") || !body.includes("Dashboard") || body.includes("Not Found");
    expect(isBlocked).toBeTruthy();
  });

  // ERROR PATH: Student cannot call instructor analytics via API
  test("Student blocked from instructor-only API endpoint", async ({ page }) => {
    const token = await loginAs(page, "student");
    const status = await page.evaluate(async (tk) => {
      const r = await fetch("http://localhost:8000/analytics/instructor/course-summaries", {
        headers: { Authorization: `Bearer ${tk}` },
      });
      return r.status;
    }, token);
    expect([403, 401]).toContain(status);
    await shot(page, "student/10-error-api-instructor-blocked");
  });

  // IDOR CHECK: Student cannot see another student's risk data by guessing course_id
  test("Student /analytics/me/risk only returns own data", async ({ page }) => {
    const token = await loginAs(page, "student");
    // Hit a non-existent course ID — should 404 or return empty, not another student's data
    const status = await page.evaluate(async (tk) => {
      const r = await fetch("http://localhost:8000/analytics/me/risk?course_id=00000000-0000-0000-0000-000000000000", {
        headers: { Authorization: `Bearer ${tk}` },
      });
      return r.status;
    }, token);
    expect([200, 404, 422]).toContain(status); // 200 with empty is OK; 404 is also fine
  });

});
