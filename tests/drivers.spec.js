import { test, expect } from '@playwright/test';

test.describe('Driver Module Tests', () => {
  test('Live API GET /api/drivers returns valid schema and active drivers', async ({ request }) => {
    const res = await request.get('/api/drivers');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(10);

    const driver = json.data[0];
    expect(driver).toHaveProperty('driverId');
    expect(driver).toHaveProperty('name');
    expect(driver).toHaveProperty('phone');
    expect(driver).toHaveProperty('status');
    expect(driver).toHaveProperty('licenseNumber');
  });

  test('Live API GET /api/drivers/DR110 returns driver details', async ({ request }) => {
    const res = await request.get('/api/drivers/DR110');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.driverId).toBe('DR110');
    expect(json.data.name).toBe('Rahul Dev');
    expect(json.data.status).toBe('active');
  });

  test('UI displays Driver Roster with active status', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    // Click Driver Roster tab
    await page.click('button:has-text("Driver Roster")');
    await expect(page.locator('h2:has-text("Registered Drivers")')).toBeVisible({ timeout: 10000 });

    // Verify driver cards exist
    await expect(page.locator('text=Vehicle:').first()).toBeVisible();
  });
});
