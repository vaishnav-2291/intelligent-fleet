import { test, expect } from '@playwright/test';

test.describe('Location Update & Live Telemetry Architecture Tests', () => {
  const TEST_VEHICLE_ID = 'VH104';
  const VALID_LAT = 11.0500;
  const VALID_LNG = 77.0200;

  let adminToken = '';
  let viewerToken = '';

  test.beforeAll(async ({ request }) => {
    // Obtain admin token
    const adminRes = await request.post('/api/auth/login', {
      data: { identifier: '9876543210', password: 'admin123' }
    });
    const adminData = await adminRes.json();
    adminToken = adminData.token;

    // Obtain viewer token
    const viewerRes = await request.post('/api/auth/login', {
      data: { identifier: '9876543214', password: 'viewer123' }
    });
    const viewerData = await viewerRes.json();
    viewerToken = viewerData.token;

    // Ensure test vehicle has distinct manual test coordinates
    await request.patch(`/api/vehicles/${TEST_VEHICLE_ID}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        latitude: VALID_LAT,
        longitude: VALID_LNG,
        coordinatesSource: 'MANUAL',
        locationTimestamp: new Date().toISOString()
      }
    });
  });

  // Automated Teardown: Clean up test vehicle in MongoDB Atlas
  test.afterAll(async ({ request }) => {
    console.log('[Teardown]: Restoring test vehicle coordinates to null in MongoDB Atlas...');
    if (adminToken) {
      try {
        const resetRes = await request.patch(`/api/vehicles/${TEST_VEHICLE_ID}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {
            latitude: null,
            longitude: null,
            coordinatesSource: null,
            locationTimestamp: null
          }
        });
        console.log(`[Teardown]: Reset status: ${resetRes.status()}`);
      } catch (err) {
        console.error('[Teardown error]:', err.message);
      }
    }
  });

  test('1. "Telemetry Dispatch & Coordinate Update" UI is completely removed from Dispatch & Routing tab', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    // Navigate to Dispatch & Routing tab
    const dispatchTab = page.locator('button:has-text("Dispatch & Routing")');
    await expect(dispatchTab).toBeVisible({ timeout: 10000 });
    await dispatchTab.click();

    // Verify Dispatch & Corridor Routing view itself loads properly
    await expect(page.locator('text=Dispatch & Corridor Routing')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });

    // Verify Telemetry Dispatch & Coordinate Update section is completely removed
    const panel = page.locator('[data-testid="location-update-panel"]');
    await expect(panel).not.toBeVisible();
    await expect(page.locator('text=Telemetry Dispatch & Coordinate Update')).not.toBeVisible();
    await expect(page.locator('text=Operational Coordinate Sync')).not.toBeVisible();
    await expect(page.locator('[data-testid="entity-type-vehicle"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="entity-type-driver"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="submit-location-update"]')).not.toBeVisible();
  });

  test('2. Authenticated admin can update coordinates via backend API', async ({ request }) => {
    const updateRes = await request.patch(`/api/vehicles/${TEST_VEHICLE_ID}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        latitude: VALID_LAT,
        longitude: VALID_LNG,
        coordinatesSource: 'MANUAL',
        locationTimestamp: new Date().toISOString()
      }
    });

    expect(updateRes.status()).toBe(200);
    const body = await updateRes.json();
    expect(body.success).toBe(true);
    expect(body.data?.latitude).toBe(VALID_LAT);
    expect(body.data?.longitude).toBe(VALID_LNG);
    expect(body.data?.coordinatesSource).toBe('MANUAL');
  });

  test('3. Invalid latitude (> 90) is strictly rejected with 400 Bad Request by API', async ({ request }) => {
    const badLatRes = await request.patch(`/api/vehicles/${TEST_VEHICLE_ID}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        latitude: 105.5,
        longitude: VALID_LNG,
        coordinatesSource: 'MANUAL'
      }
    });
    expect(badLatRes.status()).toBe(400);
    const errBody = await badLatRes.json();
    expect(errBody.success).toBe(false);
    expect(errBody.error || errBody.message).toContain('latitude');
  });

  test('4. Invalid longitude (> 180) is strictly rejected with 400 Bad Request by API', async ({ request }) => {
    const badLngRes = await request.patch(`/api/vehicles/${TEST_VEHICLE_ID}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        latitude: VALID_LAT,
        longitude: 210.0,
        coordinatesSource: 'MANUAL'
      }
    });
    expect(badLngRes.status()).toBe(400);
    const errBody = await badLngRes.json();
    expect(errBody.success).toBe(false);
    expect(errBody.error || errBody.message).toContain('longitude');
  });

  test('5. Unauthorized and forbidden updates are strictly rejected by API', async ({ request }) => {
    // Unauthenticated (no token) -> 401
    const unauthRes = await request.patch(`/api/vehicles/${TEST_VEHICLE_ID}`, {
      data: { latitude: VALID_LAT, longitude: VALID_LNG }
    });
    expect(unauthRes.status()).toBe(401);

    // Forbidden role (VIEWER role) -> 403
    const forbiddenRes = await request.patch(`/api/vehicles/${TEST_VEHICLE_ID}`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
      data: { latitude: VALID_LAT, longitude: VALID_LNG }
    });
    expect(forbiddenRes.status()).toBe(403);
  });

  test('6. Valid coordinates persist in MongoDB Atlas', async ({ request }) => {
    const getRes = await request.get(`/api/vehicles/${TEST_VEHICLE_ID}`);
    expect(getRes.status()).toBe(200);
    const body = await getRes.json();
    const veh = body.data || body;

    expect(veh.latitude).toBe(VALID_LAT);
    expect(veh.longitude).toBe(VALID_LNG);
    expect(veh.coordinatesSource).toBe('MANUAL');
  });

  test('7. GET /api/locations/live returns updated entity with honest provenance', async ({ request }) => {
    const liveRes = await request.get('/api/locations/live');
    expect(liveRes.status()).toBe(200);
    const body = await liveRes.json();

    const target = body.vehicles?.find((v) => (v.vehicleId || v.id) === TEST_VEHICLE_ID);
    expect(target).toBeDefined();
    expect(target.latitude).toBe(VALID_LAT);
    expect(target.longitude).toBe(VALID_LNG);
    expect(target.coordinatesSource).toBe('MANUAL');
    expect(target.isLiveGPS).toBe(false);
  });

  test('8. Map displays updated coordinates on Leaflet canvas', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    // Verify marker with data-vehicle-id="VH104" exists
    const marker = page.locator(`.vehicle-marker [data-vehicle-id="${TEST_VEHICLE_ID}"]`);
    await expect(marker).toBeVisible({ timeout: 10000 });
  });
});
