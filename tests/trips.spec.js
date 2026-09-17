import { test, expect } from '@playwright/test';

test.describe('Trip Module Tests', () => {
  test('Live API GET /api/trips returns list of trips with valid corridor properties', async ({ request }) => {
    const res = await request.get('/api/trips');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(5);

    const trip = json.data[0];
    expect(trip).toHaveProperty('tripId');
    expect(trip).toHaveProperty('origin');
    expect(trip).toHaveProperty('destination');
    expect(trip).toHaveProperty('status');
  });

  test('Live API GET /api/trips/TR110 returns specific trip information', async ({ request }) => {
    const res = await request.get('/api/trips/TR110');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.tripId).toBe('TR110');
    expect(json.data.origin).toBe('Coimbatore');
    expect(json.data.destination).toBe('Madurai');
  });

  test('Trip creation requires authentication and valid endpoints', async ({ request }) => {
    // 1. Unauthenticated creation attempt -> 401
    const unauthRes = await request.post('/api/trips', {
      data: {
        origin: 'Coimbatore',
        destination: 'Chennai'
      }
    });
    expect(unauthRes.status()).toBe(401);

    // 2. Authenticated creation missing fields -> 400
    const adminLogin = await request.post('/api/auth/login', {
      data: { identifier: '9876543210', password: 'admin123' }
    });
    const { token } = await adminLogin.json();

    const badRes = await request.post('/api/trips', {
      headers: { Authorization: `Bearer ${token}` },
      data: { origin: '' }
    });
    expect(badRes.status()).toBe(400);
  });

  test('UI displays Ongoing & Recent Trips Table on Dashboard', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    // Ongoing trips table should be visible
    const tableHeader = page.locator('h2:has-text("Ongoing & Recent Trips")');
    await expect(tableHeader.first()).toBeVisible({ timeout: 10000 });
  });
});
