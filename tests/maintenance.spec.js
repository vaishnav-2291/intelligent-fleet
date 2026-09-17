import { test, expect } from '@playwright/test';

test.describe('Maintenance Module Tests', () => {
  test('Live API GET /api/maintenance returns service records with priority', async ({ request }) => {
    const res = await request.get('/api/maintenance');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(5);

    const item = json.data[0];
    expect(item).toHaveProperty('maintenanceId');
    expect(item).toHaveProperty('vehicleId');
    expect(item).toHaveProperty('maintenanceType');
    expect(item).toHaveProperty('priority');
    expect(item).toHaveProperty('status');
  });

  test('Live API GET /api/maintenance/MT103 returns record details', async ({ request }) => {
    const res = await request.get('/api/maintenance/MT103');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.maintenanceId).toBe('MT103');
    expect(json.data.vehicleId).toBe('VH103');
    expect(json.data.maintenanceType).toBe('tyre_rotation');
  });

  test('UI displays Upcoming Maintenance Due card on Dashboard and navigates to Maintenance Queue', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    await expect(page.locator('text=Upcoming Maintenance Due').first()).toBeVisible({ timeout: 10000 });

    // Navigate to Maintenance Queue tab via Sidebar
    await page.click('button:has-text("Maintenance Queue")');
    await expect(page.locator('h2:has-text("Authoritative Maintenance Queue")')).toBeVisible({ timeout: 10000 });

    // Verify maintenance records table and MT103 record are rendered
    await expect(page.locator('text=MT103').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Tyre rotation and pressure inspection').first()).toBeVisible({ timeout: 10000 });
  });

  test('UI clicking Upcoming Maintenance Due card on Overview navigates directly to Maintenance Queue', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    const card = page.locator('text=Upcoming Maintenance Due').first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    await expect(page.locator('h2:has-text("Authoritative Maintenance Queue")')).toBeVisible({ timeout: 10000 });
  });
});
