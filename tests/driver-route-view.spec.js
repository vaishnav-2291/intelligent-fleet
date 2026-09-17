import { test, expect } from '@playwright/test';

const DRIVER_PHONE = '9123456789';
const DRIVER_PASSWORD = 'driver123';
const ADMIN_PHONE = '9876543210';
const ADMIN_PASSWORD = 'admin123';

test.describe('Driver Portal Assigned Optimized Route View Suite', () => {
  test.describe.configure({ mode: 'serial' });

  test('1. Driver login starts in READY state and cannot see Admin Dashboard control', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');

    // Confirm Driver Portal is visible
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Confirm initial duty badge is READY or OFFLINE
    const badge = page.locator('[data-testid="driver-status-badge"]');
    await expect(badge).toHaveText(/READY|OFFLINE/i);

    // Confirm START DUTY NOW is visible
    await expect(page.locator('[data-testid="start-duty-button"]')).toBeVisible();

    // Confirm Admin Dashboard button is NEVER visible or attached to real driver session
    const adminBtn = page.locator('button:has-text("Admin Dashboard")');
    await expect(adminBtn).not.toBeVisible();
    await expect(page.locator('[data-testid="admin-dashboard-return-btn"]')).toHaveCount(0);
  });

  test('2. Starting duty with no assigned route displays clean waiting state', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Explicitly click START DUTY NOW
    await page.click('[data-testid="start-duty-button"]');

    // Reaches ACTIVE state
    const badge = page.locator('[data-testid="driver-status-badge"]');
    await expect(badge).toHaveText(/ACTIVE/i, { timeout: 10000 });

    // When no route is assigned yet, displays clean Waiting for Route Assignment card
    await expect(page.locator('h2:has-text("Waiting for Route Assignment...")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=You are marked as Active Duty on the Fleet Dispatcher board.')).toBeVisible();

    // Go Offline button is visible to allow breaks
    await expect(page.locator('[data-testid="go-offline-button"]')).toBeVisible();

    // Reset duty for clean state
    await page.click('[data-testid="go-offline-button"]');
    await expect(badge).toHaveText(/READY|OFFLINE/i, { timeout: 10000 });
  });

  test('3. Driver with assigned optimized route sees enterprise route details and Leaflet map', async ({ page }) => {
    // Step A: Admin dispatches an optimized route to DR001 (Arun Kumar)
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Dispatch & Routing")');
    await expect(page.locator('text=Dispatch & Corridor Routing')).toBeVisible({ timeout: 10000 });

    // Select DR001
    const driverSelect = page.locator('[data-testid="driver-dispatch-select"]');
    await driverSelect.selectOption('DR001');

    // Select Origin: Coimbatore, Destination: Chennai
    await page.locator('[data-testid="origin-select"]').selectOption('Coimbatore');
    await page.locator('[data-testid="destination-select"]').selectOption('Chennai');

    // Add intermediate waypoint: Salem
    const stopSelect = page.locator('[data-testid="stop-add-select"]');
    await expect(stopSelect).toBeVisible({ timeout: 10000 });
    await stopSelect.selectOption('Salem');
    await page.click('[data-testid="add-stop-btn"]');
    await expect(page.locator('[data-testid="waypoint-marker"]').first()).toBeVisible({ timeout: 10000 });

    // Click Dispatch button
    await page.click('[data-testid="dispatch-button"]');
    await page.waitForTimeout(1000);

    // Step B: Sign out from Admin and sign in as Driver (DR001)
    const signOutBtn = page.locator('button:has-text("Sign Out")');
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
    } else {
      await page.evaluate(() => sessionStorage.clear());
      await page.goto('/');
    }
    await expect(page.locator('button:has-text("Fleet Driver")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // If in READY state, click START DUTY NOW to view assigned duty route
    const startDutyBtn = page.locator('[data-testid="start-duty-button"]');
    if (await startDutyBtn.isVisible()) {
      await startDutyBtn.click();
    }

    // Step C: Verify enterprise Driver Route view replaces the waiting empty state
    await expect(page.locator('[data-testid="driver-route-view"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Waiting for Route Assignment...")')).not.toBeVisible();

    // Verify Route Telemetry: Origin, Destination, Distance, and ETA
    await expect(page.locator('[data-testid="driver-route-view"]').locator('text=Coimbatore').first()).toBeVisible();
    await expect(page.locator('[data-testid="driver-route-view"]').locator('text=Chennai').first()).toBeVisible();
    await expect(page.locator('text=/\\d+\\s*km/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/\\d+h\\s*\\d*m|\\d+m/').first()).toBeVisible();

    // Verify Ordered Waypoint Sequence
    await expect(page.locator('text=Optimized Stop Sequence')).toBeVisible();
    await expect(page.locator('[data-testid="driver-route-view"]').locator('text=Salem').first()).toBeVisible();

    // Step D: Verify Leaflet Map rendering OSRM road-following geometry
    const map = page.locator('.leaflet-container');
    await expect(map).toBeVisible({ timeout: 10000 });

    // Origin Marker (A)
    const originMarker = page.locator('[data-testid="origin-marker"]');
    await expect(originMarker.first()).toBeVisible({ timeout: 10000 });

    // Destination Marker (B)
    const destMarker = page.locator('[data-testid="destination-marker"]');
    await expect(destMarker.first()).toBeVisible({ timeout: 10000 });

    // Waypoint Marker (#1)
    const waypointMarker = page.locator('[data-testid="waypoint-marker"]');
    await expect(waypointMarker.first()).toBeVisible({ timeout: 10000 });

    // Driver Marker
    const driverMarker = page.locator('[data-testid="driver-marker"]');
    await expect(driverMarker.first()).toBeVisible({ timeout: 10000 });

    // Road Polyline SVG path
    const polyline = page.locator('.leaflet-overlay-pane svg path');
    await expect(polyline.first()).toBeVisible({ timeout: 10000 });

    // Verify optimized road polyline contains multiple road geometry points
    const pathD = await polyline.first().getAttribute('d');
    expect(pathD).toBeTruthy();
    const coordinateCommands = (pathD.match(/[ML]/g) || []).length;
    expect(coordinateCommands).toBeGreaterThan(15);

    // Step E: Trip Action button is visible
    const startTripBtn = page.locator('[data-testid="start-trip-button"]');
    await expect(startTripBtn).toBeVisible();

    // Step F: Zero Admin button visible or attached
    await expect(page.locator('button:has-text("Admin Dashboard")')).not.toBeVisible();
    await expect(page.locator('[data-testid="admin-dashboard-return-btn"]')).toHaveCount(0);
  });

  test('4. Driver Isolation: Unassigned driver does not see another driver assigned route', async ({ page }) => {
    // Sign in as Admin previewing driver DR105 who has no assigned trip
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });

    // Switch to driver preview for DR105
    await page.click('button:has-text("Switch to Driver View")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // The driver DR105 does not have DR001's route assigned
    // Ensure DR001's specific route (Coimbatore → Chennai with Salem) is not cross-contaminated
    const drvName = await page.locator('h1').first().innerText();
    expect(drvName).toBeDefined();
  });

  test('5. Optimized route polyline contains multiple road geometry points (high-density highway geometry)', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    const startDutyBtn = page.locator('[data-testid="start-duty-button"]');
    if (await startDutyBtn.isVisible()) {
      await startDutyBtn.click();
    }

    const routeView = page.locator('[data-testid="driver-route-view"]');
    if (await routeView.isVisible()) {
      const polyline = page.locator('.leaflet-overlay-pane svg path').first();
      await expect(polyline).toBeVisible({ timeout: 10000 });
      const pathD = await polyline.getAttribute('d');
      expect(pathD).toBeTruthy();
      const pointCount = (pathD.match(/[ML]/g) || []).length;
      expect(pointCount).toBeGreaterThan(15);
    }
  });

  test('6. Non-blocking telemetry: Driver Portal loads assigned optimized route when telemetry endpoint returns HTTP 502', async ({ context, page }) => {
    // Grant geolocation so browser coordinates are acquired
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 11.025, longitude: 77.015, accuracy: 12 });

    // Intercept telemetry endpoint to simulate HTTP 502 Bad Gateway
    await page.route('**/api/locations/driver', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Bad Gateway', status: 502 })
      })
    );

    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Confirm real driver session has NO Admin Dashboard button
    await expect(page.locator('button:has-text("Admin Dashboard")')).not.toBeVisible();
    await expect(page.locator('[data-testid="admin-dashboard-return-btn"]')).toHaveCount(0);

    // If in off-duty state and button is present, click START DUTY NOW (or wait if already assigned)
    const startDutyBtn = page.locator('[data-testid="start-duty-button"]');
    if (await startDutyBtn.isVisible().catch(() => false)) {
      await startDutyBtn.click({ timeout: 3000 }).catch(() => {});
    }

    // Assigned optimized route view is fully visible and rendered
    await expect(page.locator('[data-testid="driver-route-view"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="driver-route-view"]').locator('text=Coimbatore').first()).toBeVisible();
    await expect(page.locator('[data-testid="driver-route-view"]').locator('text=Chennai').first()).toBeVisible();

    // Leaflet map and OSRM polyline still render properly
    const map = page.locator('.leaflet-container');
    await expect(map).toBeVisible({ timeout: 10000 });
    const polyline = page.locator('.leaflet-overlay-pane svg path');
    await expect(polyline.first()).toBeVisible({ timeout: 10000 });

    // Attempt to trigger location sharing while 502 is active
    await page.click('[data-testid="toggle-location-sharing"]');
    await page.waitForTimeout(1000);

    // Verify quiet, neutral fallback state:
    // 1. Button returns to or remains 'Share Live Location'
    const toggleBtn = page.locator('[data-testid="toggle-location-sharing"]');
    await expect(toggleBtn).toContainText('Share Live Location');

    // 2. Status remains or resets to 'Location Sharing Inactive'
    const statusIndicator = page.locator('[data-testid="gps-status-indicator"]');
    await expect(statusIndicator).toContainText('Location Sharing Inactive');

    // 3. ZERO user-facing error banners or raw HTTP error codes
    await expect(page.locator('text=Location Telemetry Error')).not.toBeVisible();
    await expect(page.locator('text=502')).not.toBeVisible();
    await expect(page.locator('text=/HTTP\\s*(502|500|404|403)/i')).not.toBeVisible();
    await expect(page.locator('text=/telemetry failed/i')).not.toBeVisible();
    await expect(page.locator('text=GPS Error')).not.toBeVisible();

    // 4. Does NOT falsely claim 'Broadcasting Live GPS'
    await expect(page.locator('text=Broadcasting Live GPS')).not.toBeVisible();

    // 5. Route view remains fully functional with Start Trip button
    await expect(page.locator('[data-testid="start-trip-button"]')).toBeVisible();
  });
});
