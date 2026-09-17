import { test, expect } from '@playwright/test';

test.describe('Vehicle Module Tests', () => {
  test('Live API GET /api/vehicles returns valid structure with live vehicles', async ({ request }) => {
    const res = await request.get('/api/vehicles');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(10);

    // Verify schema fields on sample vehicle
    const vehicle = json.data[0];
    expect(vehicle).toHaveProperty('vehicleId');
    expect(vehicle).toHaveProperty('registrationNumber');
    expect(vehicle).toHaveProperty('status');
    expect(vehicle).toHaveProperty('fuelLevel');
    expect(vehicle).toHaveProperty('location');
    expect(vehicle).toHaveProperty('mileage');
  });

  test('Live API GET /api/vehicles/VH104 returns correct authoritative telemetry', async ({ request }) => {
    const res = await request.get('/api/vehicles/VH104');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    const v = json.data;
    expect(v.vehicleId).toBe('VH104');
    expect(v.fuelLevel).toBe(45);
    expect(v.location).toBe('Tiruppur');
    expect(v.status).toBe('maintenance');
  });

  test('UI displays live Fleet Roster with status and telemetry', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    // Navigate to Fleet Roster
    await page.click('button:has-text("Fleet Roster")');
    await expect(page.locator('h2:has-text("Fleet Roster")')).toBeVisible({ timeout: 10000 });

    // Verify vehicle cards appear
    await expect(page.locator('text=Fuel Level:').first()).toBeVisible();
  });
});
