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

  test('1. Location update UI exists on Dispatch & Routing tab', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    // Navigate to Dispatch & Routing tab
    const dispatchTab = page.locator('button:has-text("Dispatch & Routing")');
    await expect(dispatchTab).toBeVisible({ timeout: 10000 });
    await dispatchTab.click();

    // Verify location update panel exists
    const panel = page.locator('[data-testid="location-update-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Verify key controls exist
    await expect(page.locator('[data-testid="entity-type-vehicle"]')).toBeVisible();
    await expect(page.locator('[data-testid="entity-type-driver"]')).toBeVisible();
    await expect(page.locator('[data-testid="entity-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="latitude-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="longitude-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="source-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="submit-location-update"]')).toBeVisible();
  });

  test('2. Authenticated admin can update coordinates via API & UI', async ({ request }) => {
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

  test('3. Invalid latitude (> 90) is strictly rejected with 400 Bad Request', async ({ request, page }) => {
    // API Check
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

    // UI Check
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    await page.fill('[data-testid="latitude-input"]', '125.0');
    await page.fill('[data-testid="longitude-input"]', '77.0200');
    await page.click('[data-testid="submit-location-update"]');

    const clientErr = page.locator('[data-testid="update-error-message"]');
    await expect(clientErr).toBeVisible();
    await expect(clientErr).toContainText('Latitude');
  });

  test('4. Invalid longitude (> 180) is strictly rejected with 400 Bad Request', async ({ request, page }) => {
    // API Check
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

    // UI Check
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    await page.fill('[data-testid="latitude-input"]', '11.0500');
    await page.fill('[data-testid="longitude-input"]', '195.0');
    await page.click('[data-testid="submit-location-update"]');

    const clientErr = page.locator('[data-testid="update-error-message"]');
    await expect(clientErr).toBeVisible();
    await expect(clientErr).toContainText('Longitude');
  });

  test('5. Unauthorized and forbidden updates are strictly rejected', async ({ request }) => {
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
    // Fetch individual vehicle record directly from backend
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
    expect(target.isLiveGPS).toBe(false); // Manual entry must NOT claim to be live GPS
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

  test('9. Admin submits update via UI, map highlights entity and opens marker popup with telemetry details', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    // Select VH104
    await page.selectOption('[data-testid="entity-select"]', TEST_VEHICLE_ID);

    // Enter coordinates and MANUAL source
    await page.fill('[data-testid="latitude-input"]', '11.0500');
    await page.fill('[data-testid="longitude-input"]', '77.0200');
    await page.selectOption('[data-testid="source-select"]', 'MANUAL');

    // Submit
    await page.click('[data-testid="submit-location-update"]');

    // Verify success banner
    const statusMsg = page.locator('[data-testid="update-status-message"]');
    await expect(statusMsg).toBeVisible({ timeout: 10000 });
    await expect(statusMsg).toContainText('Successfully updated');

    // Map auto-centers and opens the popup for the updated entity
    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible({ timeout: 10000 });

    const popupText = await popup.innerText();
    expect(popupText).toContain(TEST_VEHICLE_ID);
    expect(popupText).toContain('Latitude:');
    expect(popupText).toContain('11.0500');
    expect(popupText).toContain('Longitude:');
    expect(popupText).toContain('77.0200');
    expect(popupText).toContain('Coordinate Source:');
    expect(popupText).toContain('MANUAL');
    expect(popupText).toContain('Location Timestamp:');
  });

  test('10. Manual source is explicitly labeled MANUAL and NOT labeled LIVE_GPS', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    // Select VH104 and submit
    await page.selectOption('[data-testid="entity-select"]', TEST_VEHICLE_ID);
    await page.fill('[data-testid="latitude-input"]', '11.0500');
    await page.fill('[data-testid="longitude-input"]', '77.0200');
    await page.selectOption('[data-testid="source-select"]', 'MANUAL');
    await page.click('[data-testid="submit-location-update"]');

    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible({ timeout: 10000 });

    const popupText = await popup.innerText();
    expect(popupText).toContain('MANUAL');
    expect(popupText).not.toContain('Coordinate Source: LIVE_GPS');
  });

  test('11. Applying MOCK_DEMO preset updates map marker locally without sending PATCH request to MongoDB and without 400 error', async ({ page }) => {
    let patchAttempted = false;
    await page.route('**/api/vehicles/**', (route) => {
      if (route.request().method() === 'PATCH') {
        patchAttempted = true;
      }
      route.continue();
    });

    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    // Select VH104
    await page.selectOption('[data-testid="entity-select"]', TEST_VEHICLE_ID);

    // Enter demo coordinates for Salem Station directly
    await page.fill('[data-testid="latitude-input"]', '11.6643');
    await page.fill('[data-testid="longitude-input"]', '78.1460');

    // Explicitly select MOCK_DEMO source
    await page.selectOption('[data-testid="source-select"]', 'MOCK_DEMO');

    // Click submit button (APPLY DEMO LOCATION)
    await page.click('[data-testid="submit-location-update"]');

    // Status message appears with success and Operational Location note
    const statusMsg = page.locator('[data-testid="update-status-message"]');
    await expect(statusMsg).toBeVisible({ timeout: 10000 });
    await expect(statusMsg).toContainText('Successfully updated');
    await expect(statusMsg).toContainText('Operational Location');

    // Confirm no PATCH request was made to MongoDB
    expect(patchAttempted).toBe(false);

    // Confirm map popup reflects the entity and Demo Location
    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible({ timeout: 10000 });
    const popupText = await popup.innerText();
    expect(popupText).toContain(TEST_VEHICLE_ID);
    expect(popupText).toContain('11.6643');
    expect(popupText).toContain('78.1460');
  });
});

