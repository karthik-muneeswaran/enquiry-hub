import { test, expect } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs in as admin and accesses admin dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@enquiry.dev');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Admin should land on admin dashboard or be able to navigate there
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('h1, [data-testid="page-title"]').first()).toBeVisible();
  });

  test('agent cannot access admin routes', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'agent@enquiry.dev');
    await page.fill('input[name="password"]', 'agent123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(properties|admin)/);

    // Try to access admin-only route
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/(unauthorized|login|properties)/);
  });

  test('logout clears session and blocks protected routes', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@enquiry.dev');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|properties)/);

    // Logout
    await page.click('button:has-text("Logout"), [data-testid="logout-button"]');
    await expect(page).toHaveURL(/\/login/);

    // Verify protected route redirects back to login
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });
});
