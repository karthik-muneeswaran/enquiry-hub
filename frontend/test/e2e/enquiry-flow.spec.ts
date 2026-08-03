import { test, expect } from '@playwright/test';

test.describe('Enquiry submission flow', () => {
  test('submits an enquiry from property detail page', async ({ page }) => {
    // Login as agent who can create enquiries
    await page.goto('/login');
    await page.fill('input[name="email"]', 'agent@enquiry.dev');
    await page.fill('input[name="password"]', 'agent123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(properties|admin)/);

    // Navigate to a property and click enquire
    await page.goto('/properties');
    await page.waitForSelector('[data-testid="property-card"]');
    await page.click('[data-testid="property-card"]:first-child a');
    await page.click('a:has-text("Make Enquiry"), button:has-text("Make Enquiry")');

    // Fill and submit the enquiry form
    await page.fill('input[name="name"]', 'Jane Doe');
    await page.fill('input[name="email"]', 'jane@example.com');
    await page.fill('input[name="phone"]', '+61400000000');
    await page.fill('textarea[name="message"]', 'I would like to schedule a viewing.');
    await page.check('input[name="consentGiven"]');
    await page.click('button[type="submit"]');

    // Verify success feedback
    await expect(page.locator('[role="alert"], [data-testid="toast"]')).toContainText(/success|submitted/i);
  });

  test('shows validation errors for empty required fields', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'agent@enquiry.dev');
    await page.fill('input[name="password"]', 'agent123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(properties|admin)/);

    await page.goto('/property/test-property/enquiry');
    await page.click('button[type="submit"]');

    // Expect validation messages for required fields
    await expect(page.locator('text=/required|must not be empty/i').first()).toBeVisible();
  });

  test('handles duplicate enquiry with 409 warning', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'agent@enquiry.dev');
    await page.fill('input[name="password"]', 'agent123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(properties|admin)/);

    // Mock the API to return 409 for duplicate
    await page.route('**/api/v1/enquiry', (route) => {
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'DUPLICATE_ENQUIRY', statusCode: 409, message: 'Duplicate enquiry' },
          request_id: 'req_test',
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/property/test-property/enquiry');
    await page.fill('input[name="name"]', 'Jane Doe');
    await page.fill('input[name="email"]', 'jane@example.com');
    await page.fill('input[name="phone"]', '+61400000000');
    await page.fill('textarea[name="message"]', 'Duplicate test.');
    await page.check('input[name="consentGiven"]');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=/duplicate|already submitted/i').first()).toBeVisible();
  });
});
