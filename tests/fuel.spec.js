import { test, expect } from '@playwright/test';

test.describe('Fuel Module Tests', () => {
  test('Live API GET /api/fuel returns fuel telemetry records', async ({ request }) => {
    const res = await request.get('/api/fuel');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(5);

    const record = json.data[0];
    expect(record).toHaveProperty('fuelRecordId');
    expect(record).toHaveProperty('vehicleId');
    expect(record).toHaveProperty('fuelLevel');
    expect(record).toHaveProperty('fuelConsumedLiters');
  });

  test('Live API GET /api/fuel/FR104 returns VH104 consumption anomaly telemetry', async ({ request }) => {
    const res = await request.get('/api/fuel/FR104');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.fuelRecordId).toBe('FR104');
    expect(json.data.vehicleId).toBe('VH104');
    expect(json.data.fuelLevel).toBe(45);
    expect(json.data.anomalyType).toBe('consumption_spike');
    expect(json.data.status).toBe('anomaly');
  });

  test('UI displays Fuel Anomalies Flagged telemetry card and navigates to Fuel Telemetry', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    await expect(page.locator('text=Fuel Anomalies Flagged').first()).toBeVisible({ timeout: 10000 });

    // Navigate to Fuel Telemetry tab via Sidebar
    await page.click('button:has-text("Fuel Telemetry")');
    await expect(page.locator('h2:has-text("Live Fuel Telemetry & Anomaly Detection")')).toBeVisible({ timeout: 10000 });

    // Verify fuel telemetry table renders VH104 and consumption_spike
    await expect(page.locator('text=VH104').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=consumption_spike').first()).toBeVisible({ timeout: 10000 });
  });

  test('UI clicking Fuel Anomalies Flagged card on Overview navigates directly to Fuel Telemetry', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    const card = page.locator('text=Fuel Anomalies Flagged').first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    await expect(page.locator('h2:has-text("Live Fuel Telemetry & Anomaly Detection")')).toBeVisible({ timeout: 10000 });
  });
});
