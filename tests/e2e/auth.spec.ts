import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("shows login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/FarmOps/);
    // Should have email and password fields
    await expect(page.locator("input[type=\"email\"], input[name=\"email\"]")).toBeVisible();
    await expect(page.locator("input[type=\"password\"], input[name=\"password\"]")).toBeVisible();
  });

  test("shows register page", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("text=Create Account")).toBeVisible();
  });

  test("redirects to login when accessing protected routes", async ({ page }) => {
    await page.goto("/dashboard");
    // Should redirect to login
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("login form has proper structure", async ({ page }) => {
    await page.goto("/login");
    // Should have a sign in heading or button
    const signInBtn = page.locator("button:has-text(\"Sign in\"), button:has-text(\"Login\"), button:has-text(\"Log in\")");
    await expect(signInBtn).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("shows 404 or redirect for non-existent pages", async ({ page }) => {
    const response = await page.goto("/nonexistent-page-xyz");
    // Should get either a 404 or redirect
    expect(response?.status()).not.toBe(200);
  });
});
