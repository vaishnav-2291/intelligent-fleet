import { test, expect } from '@playwright/test';

test.describe('Safety Alerts Module Tests', () => {
  test('Live API GET /api/safety-alerts returns safety violations and alerts', async ({ request }) => {
    const res = await request.get('/api/safety-alerts');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(5);

    const alert = json.data[0];
    expect(alert).toHaveProperty('alertId');
    expect(alert).toHaveProperty('vehicleId');
    expect(alert).toHaveProperty('severity');
    expect(alert).toHaveProperty('status');
  });

  test('Live API GET /api/safety-alerts/SA109 returns critical overspeed details', async ({ request }) => {
    const res = await request.get('/api/safety-alerts/SA109');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.alertId).toBe('SA109');
    expect(json.data.alertType).toBe('overspeed');
    expect(json.data.severity).toBe('critical');
    expect(json.data.speedKmph).toBe(112);
  });

  test('UI navigates to Safety Alerts and displays radar incidents', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    // Navigate to Safety Alerts tab
    await page.click('button:has-text("Safety Alerts")');
    await expect(page.locator('h2:has-text("Fleet Safety & Incident Radar")')).toBeVisible({ timeout: 10000 });

    // Verify critical alert SA109 is displayed
    await expect(page.locator('text=SA109').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Critical overspeed event detected.').first()).toBeVisible({ timeout: 10000 });
  });
});
