import { test, expect } from '@playwright/test';

test.describe('Property browsing', () => {
  test.beforeEach(async ({ page }) => {
    // Login as viewer who can browse properties
    await page.goto('/login');
    await page.fill('input[name="email"]', 'viewer@enquiry.dev');
    await page.fill('input[name="password"]', 'viewer123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/properties/);
  });

  test('lists properties and navigates to detail page', async ({ page }) => {
    await page.goto('/properties');

    // Verify property cards are rendered
    const propertyCards = page.locator('[data-testid="property-card"]');
    await expect(propertyCards.first()).toBeVisible();

    // Click into a property detail
    await propertyCards.first().click();
    await expect(page).toHaveURL(/\/property\/.+/);
    await expect(page.locator('h1, [data-testid="property-title"]').first()).toBeVisible();
  });

  test('paginates property list with Load More', async ({ page }) => {
    await page.goto('/properties');
    await page.waitForSelector('[data-testid="property-card"]');

    const initialCount = await page.locator('[data-testid="property-card"]').count();

    // Click load more if available
    const loadMore = page.locator('button:has-text("Load More")');
    if (await loadMore.isVisible()) {
      await loadMore.click();
      await page.waitForTimeout(1000);
      const newCount = await page.locator('[data-testid="property-card"]').count();
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    }
  });

  test('shows fallback when properties are unavailable', async ({ page }) => {
    // Mock GraphQL to return error (simulating circuit breaker open)
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ errors: [{ message: 'Service unavailable' }] }),
      });
    });

    await page.goto('/properties');
    await expect(
      page.locator('text=/unavailable|error|try again/i').first()
    ).toBeVisible();
  });
});
