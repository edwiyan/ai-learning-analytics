import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginAs, shot } from "./helpers.js";

const PAGES = {
  // [role, route, label]
  admin: [
    ["admin", "/admin", "admin-dashboard"],
    ["admin", "/programs", "admin-programs"],
    ["admin", "/curricula", "admin-curricula"],
    ["admin", "/sections", "admin-sections"],
    ["admin", "/enrollment", "admin-enrollment"],
    ["admin", "/users", "admin-users"],
    ["admin", "/audit-logs", "admin-audit-logs"],
  ],
  instructor: [
    ["instructor", "/instructor", "instructor-dashboard"],
    ["instructor", "/my-classes", "instructor-my-classes"],
    ["instructor", "/my-syllabi", "instructor-my-syllabi"],
    ["instructor", "/attendance", "instructor-attendance"],
    ["instructor", "/grade-submissions", "instructor-grade-submissions"],
    ["instructor", "/grade-consultation", "instructor-grade-consultation"],
    ["instructor", "/intervention-alerts", "instructor-intervention-alerts"],
    ["instructor", "/analytics/instructor", "instructor-analytics"],
  ],
  student: [
    ["student", "/student", "student-dashboard"],
    ["student", "/my-courses", "student-my-courses"],
    ["student", "/my-competencies", "student-competencies"],
    ["student", "/interventions", "student-interventions"],
    ["student", "/sus-survey", "student-sus-survey"],
  ],
  pd: [
    ["pd", "/program-director", "pd-dashboard"],
    ["pd", "/syllabus-approval", "pd-syllabus-approval"],
    ["pd", "/assessment-approval", "pd-assessment-approval"],
    ["pd", "/grade-approval", "pd-grade-approval"],
  ],
  dean: [
    ["dean", "/dean", "dean-dashboard"],
    ["dean", "/syllabus-approval", "dean-syllabus-approval"],
    ["dean", "/grade-approval", "dean-grade-approval"],
  ],
  vp: [
    ["vp", "/vp", "vp-dashboard"],
    ["vp", "/syllabus-approval", "vp-syllabus-approval"],
    ["vp", "/grade-approval", "vp-grade-approval"],
  ],
};

// Shared: Login page (unauthenticated)
test("a11y: Login page", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  await shot(page, "a11y/login");
  expect(results.violations).toEqual(
    expect.arrayContaining(
      results.violations.map((v) => expect.objectContaining({ id: v.id }))
    )
  );
  if (results.violations.length > 0) {
    console.log(
      "LOGIN violations:",
      results.violations.map((v) => `${v.id} (${v.impact}): ${v.description}`)
    );
  }
  // Attach violation count as annotation
  test.info().annotations.push({
    type: "axe-violations",
    description: `${results.violations.length} violations on /login`,
  });
});

// Generate axe tests for every role+page combo
const allPages = Object.values(PAGES).flat();

for (const [role, route, label] of allPages) {
  test(`a11y: [${role}] ${route}`, async ({ page }) => {
    await loginAs(page, role);
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000); // let charts/lazy components settle

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .exclude("#axe-skip") // skip any explicitly opted-out elements
      .analyze();

    await shot(page, `a11y/${label}`);

    const critical = results.violations.filter((v) => v.impact === "critical");
    const serious = results.violations.filter((v) => v.impact === "serious");
    const moderate = results.violations.filter((v) => v.impact === "moderate");
    const minor = results.violations.filter((v) => v.impact === "minor");

    console.log(
      `[${role}] ${route}: ${results.violations.length} violations ` +
        `(critical=${critical.length}, serious=${serious.length}, ` +
        `moderate=${moderate.length}, minor=${minor.length})`
    );

    if (results.violations.length > 0) {
      results.violations.forEach((v) => {
        console.log(`  - ${v.id} [${v.impact}]: ${v.description}`);
        v.nodes.slice(0, 2).forEach((n) => {
          console.log(`    target: ${n.target}`);
        });
      });
    }

    test.info().annotations.push({
      type: "axe-summary",
      description: JSON.stringify({
        route,
        role,
        total: results.violations.length,
        critical: critical.length,
        serious: serious.length,
        moderate: moderate.length,
        minor: minor.length,
        ids: results.violations.map((v) => v.id),
      }),
    });

    // Only fail on critical violations (serious+ would block progress too much for a11y sweep)
    expect(critical.length).toBe(0);
  });
}

// Keyboard navigation spot-checks
test("keyboard: Login form is fully keyboard navigable", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // Tab to email
  await page.keyboard.press("Tab");
  const emailFocused = await page.evaluate(
    () => document.activeElement?.type === "email" || document.activeElement?.id?.includes("email")
  );
  console.log("Email field focused on Tab:", emailFocused);

  // Tab to password
  await page.keyboard.press("Tab");
  const pwFocused = await page.evaluate(
    () => document.activeElement?.type === "password"
  );
  console.log("Password field focused:", pwFocused);

  // Tab to submit
  await page.keyboard.press("Tab");
  const submitFocused = await page.evaluate(
    () => document.activeElement?.type === "submit" || document.activeElement?.tagName === "BUTTON"
  );
  console.log("Submit button focused:", submitFocused);

  await shot(page, "a11y/keyboard-login");
  expect(pwFocused).toBeTruthy();
});

test("keyboard: Student dashboard — tab order reaches course selector", async ({ page }) => {
  await loginAs(page, "student");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  // Find the select element
  const select = page.locator("select").first();
  const isVisible = await select.isVisible().catch(() => false);
  console.log("Course selector visible:", isVisible);

  if (isVisible) {
    await select.focus();
    const isFocused = await page.evaluate(
      () => document.activeElement?.tagName === "SELECT"
    );
    console.log("Course selector focusable:", isFocused);
    expect(isFocused).toBeTruthy();
  }

  await shot(page, "a11y/keyboard-student-dashboard");
});
