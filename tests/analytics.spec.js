import { test, expect } from '@playwright/test';

test.describe('Analytics Module Tests', () => {
  test('Live API GET /api/analytics computes operational KPIs from live database', async ({ request }) => {
    const res = await request.get('/api/analytics');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    const data = json.data;

    expect(data.totalVehicles).toBeGreaterThanOrEqual(10);
    expect(data.totalDrivers).toBeGreaterThanOrEqual(10);
    expect(data.activeVehicles).toBeGreaterThanOrEqual(0);
    expect(data.averageFuel).toBeGreaterThan(0);
    expect(data.averageFuel).toBeLessThanOrEqual(100);
    expect(data).toHaveProperty('fleetUtilizationRate');
    expect(data).toHaveProperty('fuelAnomalies');
  });

  test('UI Dashboard Stat Cards display operational counts', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    // Stat card titles
    await expect(page.locator('text=Travelling').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Idle / Available').first()).toBeVisible();
    await expect(page.locator('text=In Maintenance').first()).toBeVisible();
    await expect(page.locator('text=Active Drivers Today').first()).toBeVisible();
  });

  test('UI navigates to Fleet Analytics and displays performance KPIs and recommendations', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    // Navigate to Fleet Analytics tab
    await page.click('button:has-text("Fleet Analytics")');
    await expect(page.locator('h2:has-text("Fleet Intelligence & Performance Analysis")')).toBeVisible({ timeout: 10000 });

    // Verify rate cards and strategic insights cards
    await expect(page.locator('text=Vehicle Utilization').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Operational Strengths').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Strategic AI Recommendations').first()).toBeVisible({ timeout: 10000 });
  });
});
