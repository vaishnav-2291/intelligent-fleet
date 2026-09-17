import { test, expect } from '@playwright/test';

/**
 * Driver Device GPS Telemetry & Mobile Location Ingestion Test Suite
 * Validates continuous mobile geolocation streaming, RBAC enforcement,
 * honest MOBILE_GPS provenance, UI controls, and pristine database teardown.
 */

const TEST_DRIVER_ID = 'DR001'; // Arun Kumar in MongoDB Atlas
const MOCK_LATITUDE = 11.0250;
const MOCK_LONGITUDE = 77.0150;
const MOCK_ACCURACY = 12.5;

test.describe('Driver Live Mobile GPS Telemetry Suite', () => {
  test.describe.configure({ mode: 'serial' });

  // Clean up any test coordinate modifications so MongoDB Atlas stays clean
  test.afterAll(async ({ request }) => {
    console.log('[Teardown]: Restoring test driver coordinates to null in MongoDB Atlas...');
    try {
      // Login as Admin to clear driver coordinates
      const loginRes = await request.post('/api/auth/login', {
        data: { phone: '9876543210', password: 'admin123' }
      });
      const loginData = await loginRes.json();
      const adminToken = loginData.token;

      if (adminToken) {
        const resetRes = await request.patch(`/api/drivers/${TEST_DRIVER_ID}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {
            latitude: null,
            longitude: null,
            accuracy: null,
            coordinatesSource: null,
            locationTimestamp: null
          }
        });
        console.log(`[Teardown]: Reset status: ${resetRes.status()}`);
      }
    } catch (err) {
      console.warn('[Teardown Warning]: Failed to reset test driver coordinates:', err.message);
    }
  });

  test('1. Driver portal loads with Driver Live Location control visible', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');

    // Confirm Driver Portal is visible
    await expect(page.locator('text=Driver Portal')).toBeVisible({ timeout: 10000 });

    // Verify Driver Live Location control container and toggle button
    const control = page.locator('[data-testid="driver-live-location-control"]');
    await expect(control).toBeVisible();

    const toggleBtn = page.locator('[data-testid="toggle-location-sharing"]');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toContainText('Share Live Location');

    // Initial GPS status is OFFLINE / Inactive
    const statusIndicator = page.locator('[data-testid="gps-status-indicator"]');
    await expect(statusIndicator).toContainText('Location Sharing Inactive');
  });

  test('2. Permission explanation information banner is visible before sharing', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');

    const permInfo = page.locator('[data-testid="gps-permission-info"]');
    await expect(permInfo).toBeVisible();
    await expect(permInfo).toContainText('Share Live Location');
    await expect(permInfo).toContainText('browser will request permission');
  });

  test('3. Enabling location sharing with granted geolocation transmits telemetry and updates UI', async ({ context, page }) => {
    // Grant geolocation permissions and mock genuine device GPS fix
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: MOCK_LATITUDE,
      longitude: MOCK_LONGITUDE,
      accuracy: MOCK_ACCURACY
    });

    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');

    // Intercept telemetry API call
    const telemetryPromise = page.waitForRequest(
      req => req.url().includes('/api/locations/driver') && req.method() === 'POST'
    );

    // Click Share Live Location
    await page.click('[data-testid="toggle-location-sharing"]');

    // Wait for telemetry transmission
    const telemetryReq = await telemetryPromise;
    expect(telemetryReq).toBeDefined();

    const postData = JSON.parse(telemetryReq.postData() || '{}');
    expect(postData.latitude).toBeCloseTo(MOCK_LATITUDE, 3);
    expect(postData.longitude).toBeCloseTo(MOCK_LONGITUDE, 3);
    expect(postData.source).toBe('MOBILE_GPS');

    // Verify UI reflects active state
    const statusIndicator = page.locator('[data-testid="gps-status-indicator"]');
    await expect(statusIndicator).toContainText('Broadcasting Live GPS', { timeout: 10000 });

    // Verify Latitude, Longitude, and Accuracy readouts
    const latDisplay = page.locator('[data-testid="gps-latitude"]');
    await expect(latDisplay).toBeVisible();
    await expect(latDisplay).toContainText('11.025');

    const lngDisplay = page.locator('[data-testid="gps-longitude"]');
    await expect(lngDisplay).toBeVisible();
    await expect(lngDisplay).toContainText('77.015');

    const accDisplay = page.locator('[data-testid="gps-accuracy"]');
    await expect(accDisplay).toBeVisible();
    await expect(accDisplay).toContainText('12.5m');

    // Verify Last Sync time appears
    const lastSync = page.locator('[data-testid="gps-last-sync"]');
    await expect(lastSync).toBeVisible();
  });

  test('4. Disabling location sharing stops geolocation watch and resets UI state', async ({ context, page }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: MOCK_LATITUDE,
      longitude: MOCK_LONGITUDE,
      accuracy: MOCK_ACCURACY
    });

    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');

    // Start sharing
    await page.click('[data-testid="toggle-location-sharing"]');
    await expect(page.locator('[data-testid="gps-status-indicator"]')).toContainText('Broadcasting Live GPS', { timeout: 10000 });

    // Stop sharing
    const stopBtn = page.locator('[data-testid="toggle-location-sharing"]');
    await expect(stopBtn).toContainText('Stop Live Location');
    await stopBtn.click();

    // Verify reset to inactive
    await expect(stopBtn).toContainText('Share Live Location');
    await expect(page.locator('[data-testid="gps-status-indicator"]')).toContainText('Location Sharing Inactive');
  });

  test('5. Geolocation permission denied or unavailable returns safely to neutral inactive state without blocking route', async ({ context, page }) => {
    // Clear permissions to simulate denied access
    await context.clearPermissions();

    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');

    // Click Share Live Location (browser rejects or throws PERMISSION_DENIED)
    await page.click('[data-testid="toggle-location-sharing"]');

    // Button reverts to Share Live Location in neutral state
    const toggleBtn = page.locator('[data-testid="toggle-location-sharing"]');
    await expect(toggleBtn).toContainText('Share Live Location', { timeout: 10000 });

    // Status returns to neutral Location Sharing Inactive
    const statusIndicator = page.locator('[data-testid="gps-status-indicator"]');
    await expect(statusIndicator).toContainText('Location Sharing Inactive');

    // Never renders red Location Telemetry Error banner or raw HTTP status codes
    await expect(page.locator('text=Location Telemetry Error')).not.toBeVisible();
    await expect(page.locator('text=/502|500|404|403/')).not.toBeVisible();
  });

  test('6. Authenticated Driver can submit location telemetry via direct API', async ({ request }) => {
    // 1. Sign in as driver
    const loginRes = await request.post('/api/auth/login', {
      data: { phone: '9123456789', password: 'driver123' }
    });
    expect(loginRes.status()).toBe(200);
    const loginData = await loginRes.json();
    const driverToken = loginData.token;
    expect(driverToken).toBeDefined();

    // 2. Transmit driver location telemetry
    const telRes = await request.post('/api/locations/driver', {
      headers: { Authorization: `Bearer ${driverToken}` },
      data: {
        driverId: TEST_DRIVER_ID,
        latitude: 11.0250,
        longitude: 77.0150,
        accuracy: 10.0,
        source: 'MOBILE_GPS',
        timestamp: new Date().toISOString()
      }
    });
    expect(telRes.status()).toBe(200);
    const telData = await telRes.json();
    expect(telData.success).toBe(true);
    expect(telData.data.coordinatesSource).toBe('MOBILE_GPS');
    expect(telData.data.isLiveGPS).toBe(true);
  });

  test('7. Driver cannot update another driver location (403 Forbidden)', async ({ request }) => {
    // Login as driver Arun Kumar (driverId: DR001)
    const loginRes = await request.post('/api/auth/login', {
      data: { phone: '9123456789', password: 'driver123' }
    });
    const { token } = await loginRes.json();

    // Attempt to update driver DR102
    const res = await request.post('/api/locations/driver', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        driverId: 'DR102',
        latitude: 11.0250,
        longitude: 77.0150
      }
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('8. Invalid coordinate parameters to /api/locations/driver are rejected with 400', async ({ request }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { phone: '9123456789', password: 'driver123' }
    });
    const { token } = await loginRes.json();

    // Out-of-bounds latitude
    const badLat = await request.post('/api/locations/driver', {
      headers: { Authorization: `Bearer ${token}` },
      data: { driverId: TEST_DRIVER_ID, latitude: 120.5, longitude: 77.0 }
    });
    expect(badLat.status()).toBe(400);

    // Negative accuracy
    const badAcc = await request.post('/api/locations/driver', {
      headers: { Authorization: `Bearer ${token}` },
      data: { driverId: TEST_DRIVER_ID, latitude: 11.0, longitude: 77.0, accuracy: -10 }
    });
    expect(badAcc.status()).toBe(400);
  });

  test('9. GET /api/locations/live returns driver with MOBILE_GPS provenance and isLiveGPS: true', async ({ request }) => {
    // Submit update first
    const loginRes = await request.post('/api/auth/login', {
      data: { phone: '9123456789', password: 'driver123' }
    });
    const { token } = await loginRes.json();

    await request.post('/api/locations/driver', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        driverId: TEST_DRIVER_ID,
        latitude: 11.0250,
        longitude: 77.0150,
        accuracy: 8.5,
        source: 'MOBILE_GPS'
      }
    });

    // Query /api/locations/live
    const liveRes = await request.get('/api/locations/live');
    expect(liveRes.status()).toBe(200);
    const liveData = await liveRes.json();

    const driver = liveData.drivers.find(d => d.driverId === TEST_DRIVER_ID);
    expect(driver).toBeDefined();
    expect(driver.coordinatesSource).toBe('MOBILE_GPS');
    expect(driver.isLiveGPS).toBe(true);
    expect(driver.latitude).toBeCloseTo(11.0250, 4);
    expect(driver.longitude).toBeCloseTo(77.0150, 4);
  });

  test('10. Interactive Fleet Map displays driver marker with MOBILE_GPS beacon and popup details', async ({ request, page }) => {
    // 1. Seed distinct coordinates for DR001 with MOBILE_GPS to avoid hub overlap
    const loginRes = await request.post('/api/auth/login', {
      data: { phone: '9123456789', password: 'driver123' }
    });
    const { token } = await loginRes.json();

    try {
      await request.post('/api/locations/driver', {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          driverId: TEST_DRIVER_ID,
          latitude: 11.0800,
          longitude: 77.0500,
          accuracy: 9.2,
          source: 'MOBILE_GPS'
        }
      });

      await page.goto('/');
      await page.click('button:has-text("Admin / Manager")');
      await page.click('button:has-text("Sign In to System")');
      await page.click('button:has-text("Dispatch & Routing")');

      // Confirm Leaflet map is visible
      const map = page.locator('.leaflet-container');
      await expect(map).toBeVisible({ timeout: 10000 });

      // Look for driver marker DR001 on the map
      const driverMarker = page.locator(`[data-driver-id="${TEST_DRIVER_ID}"]`).first();
      await expect(driverMarker).toBeVisible({ timeout: 10000 });

      // Verify satellite badge is rendered for mobile GPS driver
      await expect(driverMarker).toContainText('Arun');
      await expect(driverMarker).toContainText('📡');

      // Click marker to view popup (dispatch click on marker element for Leaflet)
      await page.evaluate((id) => {
        const el = document.querySelector(`[data-driver-id="${id}"]`);
        if (el) {
          const marker = el.closest('.leaflet-marker-icon') || el;
          marker.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      }, TEST_DRIVER_ID);

      const popup = page.locator('.leaflet-popup-content');
      await expect(popup).toBeVisible({ timeout: 10000 });

      const popupText = await popup.innerText();
      expect(popupText).toContain(TEST_DRIVER_ID);
      expect(popupText).toContain('Coordinate Source:');
      // UI maps MOBILE_GPS → 'Live Device GPS' (user-friendly label)
      expect(popupText).toContain('Live Device GPS');
      expect(popupText).toContain('Provenance:');
      expect(popupText).toMatch(/±\d+(\.\d+)?m/);
      // Internal provenance token must NOT be rendered in the popup
      expect(popupText).not.toContain('MOBILE_GPS');
    } finally {
      // Immediate cleanup so test driver never pollutes database
      const adminLoginRes = await request.post('/api/auth/login', {
        data: { phone: '9876543210', password: 'admin123' }
      });
      const adminData = await adminLoginRes.json();
      if (adminData.token) {
        await request.patch(`/api/drivers/${TEST_DRIVER_ID}`, {
          headers: { Authorization: `Bearer ${adminData.token}` },
          data: {
            latitude: null,
            longitude: null,
            accuracy: null,
            coordinatesSource: null,
            locationTimestamp: null
          }
        });
      }
    }
  });
});
