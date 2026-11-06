import { expect, test, type Page } from "@playwright/test";

// The site shell (witus docs/shared-ui-ux-dx.md): every page, the 404 included, shows the header's
// exact "Sign in" link and the footer; nothing scrolls sideways at 320px; the mobile menu works
// from the keyboard. @smoke tests are the ones safe to run against a deployed URL.

const MISSING = "/this-page-does-not-exist-smoke";

async function expectShell(page: Page) {
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("@smoke home shows the header Sign in link and the footer", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expectShell(page);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: /WitUS\.online/ })).toBeVisible();
});

test("@smoke a missing path is a 404 that keeps the header and footer", async ({ page }) => {
  const res = await page.goto(MISSING);
  expect(res?.status()).toBe(404);
  await expectShell(page);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
});

test("@smoke a signed-out dashboard visit goes to sign in with the way back", async ({ page }) => {
  await page.goto("/dashboard/clubs");
  await expect(page).toHaveURL(/\/signin\?next=%2Fdashboard%2Fclubs$/);
  await expectShell(page);
});

test("no horizontal scroll on home, the 404 and sign-in", async ({ page }) => {
  for (const path of ["/", MISSING, "/signin"]) {
    await page.goto(path);
    await expectShell(page);
    await expectNoHorizontalScroll(page);
  }
});

test("the skip link is the first stop and moves focus to the content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("the menu opens, is walked and closes from the keyboard at 320px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-320", "the Menu button only exists below md");
  await page.goto("/");
  const menuButton = page.getByRole("button", { name: "Menu" });
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");

  // Tab from the top of the page until the Menu button has focus: it must be reachable.
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press("Tab");
    if (await menuButton.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(menuButton).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  const menu = page.locator(`[id="${await menuButton.getAttribute("aria-controls")}"]`);
  await expect(menu.getByRole("link", { name: "Episodes" })).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(menu.getByRole("link", { name: "Episodes" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toBeFocused();
  await expectNoHorizontalScroll(page);
});

test("the primary nav is reachable from the keyboard at desktop width", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "inline nav shows from md up");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  const episodes = page.getByRole("banner").getByRole("link", { name: "Episodes" });
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press("Tab");
    if (await episodes.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(episodes).toBeFocused();
});
