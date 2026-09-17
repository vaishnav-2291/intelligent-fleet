import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('Fleet Management application loads successfully with branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Intelligent Fleet/i);

    // Verify main login / app header branding
    const header = page.locator('text=Intelligent Fleet');
    await expect(header.first()).toBeVisible();

    // Verify system portal container
    await expect(page.locator('text=Enterprise Portal')).toBeVisible();
  });

  test('Static resources load with valid status codes', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.service).toBe('fleet-backend-gateway');
  });
});
