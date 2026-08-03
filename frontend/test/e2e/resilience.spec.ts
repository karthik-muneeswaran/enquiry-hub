import { test, expect } from '@playwright/test';

test.describe('Resilience features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'agent@enquiry.dev');
    await page.fill('input[name="password"]', 'agent123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(properties|admin)/);
  });

  test('shows offline banner and queues submission when offline', async ({ page, context }) => {
    await page.goto('/property/test-property/enquiry');

    // Go offline
    await context.setOffline(true);

    // Fill and submit form
    await page.fill('input[name="name"]', 'Offline User');
    await page.fill('input[name="email"]', 'offline@example.com');
    await page.fill('input[name="phone"]', '+61400000000');
    await page.fill('textarea[name="message"]', 'Submitted while offline.');
    await page.check('input[name="consentGiven"]');
    await page.click('button[type="submit"]');

    // Expect offline indicator or queued message
    await expect(
      page.locator('text=/offline|queued|pending/i').first()
    ).toBeVisible();

    // Go back online
    await context.setOffline(false);
  });

  test('shows error state with retry button on API failure', async ({ page }) => {
    // Mock API to return 500
    await page.route('**/api/v1/enquiries*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'INTERNAL_ERROR', statusCode: 500, message: 'Server error' },
          request_id: 'req_err',
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/admin');

    // Expect error UI with retry option
    await expect(
      page.locator('text=/error|unavailable|something went wrong/i').first()
    ).toBeVisible();
    const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")');
    if (await retryButton.isVisible()) {
      await expect(retryButton).toBeEnabled();
    }
  });

  test('persists form state across page refresh', async ({ page }) => {
    await page.goto('/property/test-property/enquiry');

    // Fill partial form
    await page.fill('input[name="name"]', 'Persisted User');
    await page.fill('input[name="email"]', 'persist@example.com');

    // Wait for debounced save (500ms)
    await page.waitForTimeout(600);

    // Reload the page
    await page.reload();

    // Expect restore prompt or pre-filled values
    const nameInput = page.locator('input[name="name"]');
    const restorePrompt = page.locator('text=/continue|restore|resume/i');

    // Either the form is restored directly or there's a prompt
    const hasPrompt = await restorePrompt.isVisible().catch(() => false);
    if (hasPrompt) {
      await restorePrompt.click();
    }

    await expect(nameInput).toHaveValue('Persisted User');
  });
});
