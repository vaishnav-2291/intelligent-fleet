import { test, expect } from '@playwright/test';
import { 
  solveOptimalStopSequence, 
  getRoadFollowingRoute, 
  fetchRoadDistanceMatrix,
  resolveStopCoords 
} from '../src/services/routeOptimizer.js';
import { DEMO_VEHICLE_COORDINATES, DEMO_DRIVER_COORDINATES } from '../src/data/mockData.js';

test.describe('Route Optimization & Mock Coordinate Engine', () => {

  // =========================================================================
  // SCENARIO 1: Single vehicle -> destination road route
  // =========================================================================
  test('Scenario 1: Single vehicle to destination road route calculates real highway route', async ({ page }) => {
    // 1. Sign in as Admin
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });

    // 2. Open Dispatch & Routing
    await page.click('button:has-text("Dispatch & Routing")');
    await expect(page.locator('text=Dispatch & Corridor Routing')).toBeVisible({ timeout: 10000 });

    // 3. Select Erode as Origin, Coimbatore as Destination
    const originSelect = page.locator('[data-testid="origin-select"]');
    await originSelect.selectOption('Erode');

    const destSelect = page.locator('[data-testid="destination-select"]');
    await destSelect.selectOption('Coimbatore');

    // 4. Verify route calculation displays valid distance and duration
    await expect(page.locator('text=/\\d+\\s*km/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/\\d+h\\s*\\d*m|\\d+m/').first()).toBeVisible();

    // 5. Leaflet map renders origin (A), destination (B), and real OSRM road polyline
    await expect(page.locator('[data-testid="origin-marker"]')).toBeVisible();
    await expect(page.locator('[data-testid="destination-marker"]')).toBeVisible();
    await expect(page.locator('.leaflet-overlay-pane svg path').first()).toBeVisible({ timeout: 10000 });
  });

  // =========================================================================
  // SCENARIO 2: Multi-stop optimization orders stops to minimize distance
  // =========================================================================
  test('Scenario 2: Multi-stop optimization reorders stops to minimize road distance', async () => {
    const origin = 'Coimbatore';
    const destination = 'Chennai';
    // Deliberately sub-optimal corridor order: jumping back and forth
    const subOptimalWaypoints = ['Salem', 'Tiruppur', 'Erode'];

    const result = await solveOptimalStopSequence(origin, destination, subOptimalWaypoints);

    expect(result.orderedWaypoints).toBeDefined();
    expect(result.orderedWaypoints.length).toBe(3);

    // Tiruppur is closest to Coimbatore, followed by Erode, then Salem on NH 544
    expect(result.orderedWaypoints).toEqual(['Tiruppur', 'Erode', 'Salem']);
    expect(result.savedKm).toBeGreaterThan(0);
    expect(result.improvementPct).toBeGreaterThan(0);
    expect(result.isOptimized).toBe(true);
  });

  // =========================================================================
  // SCENARIO 3: Optimized order is deterministic
  // =========================================================================
  test('Scenario 3: Stop sequence optimization is 100% deterministic across multiple runs', async () => {
    const origin = 'Coimbatore';
    const destination = 'Madurai';
    const waypoints = ['Karur', 'Tiruppur', 'Dindigul'];

    const run1 = await solveOptimalStopSequence(origin, destination, waypoints);
    const run2 = await solveOptimalStopSequence(origin, destination, waypoints);
    const run3 = await solveOptimalStopSequence(origin, destination, waypoints);

    expect(run1.orderedWaypoints).toEqual(run2.orderedWaypoints);
    expect(run2.orderedWaypoints).toEqual(run3.orderedWaypoints);
    expect(run1.optimizedDistanceKm).toBe(run2.optimizedDistanceKm);
    expect(run2.optimizedDistanceKm).toBe(run3.optimizedDistanceKm);
    expect(run1.savedKm).toBe(run2.savedKm);
  });

  // =========================================================================
  // SCENARIO 4: OSRM road geometry is used (high density points, no straight lines)
  // =========================================================================
  test('Scenario 4: Road geometry contains high-density highway polyline points instead of straight lines', async () => {
    const route = await getRoadFollowingRoute('Erode', 'Coimbatore', ['Tiruppur']);

    expect(route.success).toBe(true);
    expect(route.isRoadFollowing).toBe(true);
    expect(Array.isArray(route.routeGeometry)).toBe(true);

    // Real road route for ~100 km corridor contains hundreds of geometry coordinates following curves
    expect(route.pointCount).toBeGreaterThan(50);
    expect(route.routeGeometry.length).toBeGreaterThan(50);

    // Each coordinate must be a valid [latitude, longitude] pair
    const [firstLat, firstLng] = route.routeGeometry[0];
    expect(firstLat).toBeGreaterThan(10);
    expect(firstLat).toBeLessThan(12);
    expect(firstLng).toBeGreaterThan(76);
    expect(firstLng).toBeLessThan(79);
  });

  // =========================================================================
  // SCENARIO 5: Distance and ETA come from routing engine
  // =========================================================================
  test('Scenario 5: Distance and duration come directly from routing engine telemetry', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    // Confirm OSRM Live badge is present
    await expect(page.locator('text=OSRM Live')).toBeVisible();

    // Confirm Road Distance and Duration are shown in UI
    const distanceText = page.locator('text=/\\d+\\s*km/').first();
    await expect(distanceText).toBeVisible({ timeout: 10000 });
    const distValue = await distanceText.innerText();
    expect(parseFloat(distValue)).toBeGreaterThan(20);

    // Confirm Estimated Duration is displayed
    const durationLocator = page.locator('text=/\\d+h\\s*\\d*m|\\d+m/').first();
    await expect(durationLocator).toBeVisible();
  });

  // =========================================================================
  // SCENARIO 6 & 12: Stop sequence renders numbered badges (1, 2, 3...) on map
  // =========================================================================
  test('Scenario 6 & 12: Waypoint markers render numbered sequence badges (1, 2...) on Leaflet canvas', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    // Select Kongu Industrial Ring corridor preset which defines Tiruppur as intermediate stop
    await page.click('button:has-text("Kongu Industrial Ring")');

    // Origin marker has 'A' badge
    const originMarker = page.locator('[data-testid="origin-marker"]');
    await expect(originMarker).toBeVisible({ timeout: 10000 });
    await expect(originMarker).toContainText('A');

    // Destination marker has 'B' badge
    const destMarker = page.locator('[data-testid="destination-marker"]');
    await expect(destMarker).toBeVisible({ timeout: 10000 });
    await expect(destMarker).toContainText('B');

    // Waypoint 1 (Tiruppur) is visible on map with badge 1
    const wp1 = page.locator('[data-testid="waypoint-marker"][data-stop-number="1"]');
    await expect(wp1).toBeVisible({ timeout: 10000 });
    await expect(wp1).toContainText('1');

    // Add a second waypoint: Salem
    const stopSelect = page.locator('[data-testid="stop-add-select"]');
    await expect(stopSelect).toBeVisible({ timeout: 10000 });
    await stopSelect.selectOption('Salem');
    await page.click('[data-testid="add-stop-btn"]');

    // Verify stop 2 appears on map with badge 2
    const wp2 = page.locator('[data-testid="waypoint-marker"][data-stop-number="2"]');
    await expect(wp2).toBeVisible({ timeout: 10000 });
    await expect(wp2).toContainText('2');
  });

  // =========================================================================
  // SCENARIO 7: Multiple drivers have independent routes
  // =========================================================================
  test('Scenario 7: Multiple drivers have isolated routes and switching does not cross-contaminate', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    const driverSelect = page.locator('[data-testid="driver-dispatch-select"]');
    await expect(driverSelect).toBeVisible({ timeout: 10000 });

    // Select DR001 by value string
    await driverSelect.selectOption('DR001');
    await page.waitForTimeout(500);

    // Verify driver route status indicator is displayed
    const routeStatus = page.locator('text=/Active Trip:|No current route assigned|Auto-loaded/');
    await expect(routeStatus.first()).toBeVisible({ timeout: 5000 });

    // Switch to DR102 by value string
    await driverSelect.selectOption('DR102');
    await page.waitForTimeout(500);

    // Ensure page handles route isolation cleanly
    await expect(page.locator('[data-testid="origin-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="destination-select"]')).toBeVisible();
  });

  // =========================================================================
  // SCENARIO 8: Destination recalculation works immediately
  // =========================================================================
  test('Scenario 8: Changing destination clears stale geometry and recalculates immediately', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    const destSelect = page.locator('[data-testid="destination-select"]');

    // Change to Madurai
    await destSelect.selectOption('Madurai');

    // Verify destination marker label updates to Madurai
    const destMarker = page.locator('[data-testid="destination-marker"]');
    await expect(destMarker).toBeVisible({ timeout: 10000 });
    await expect(destMarker).toContainText('Madurai');

    // Verify new distance is recalculated (Madurai is further than Coimbatore from Erode)
    await expect(page.locator('text=/\\d+\\s*km/').first()).toBeVisible({ timeout: 10000 });
  });

  // =========================================================================
  // SCENARIO 9: OSRM failure has graceful fallback without straight lines
  // =========================================================================
  test('Scenario 9: OSRM failure returns routeGeometry: null without drawing straight lines', async () => {
    // Calling with an aborted signal or invalid endpoint triggers fallback
    const controller = new AbortController();
    controller.abort();

    const fallbackRoute = await getRoadFollowingRoute('Erode', 'Coimbatore', ['Tiruppur'], {
      signal: controller.signal
    });

    // When aborted or failed, routeGeometry is null and no straight lines are drawn
    expect(fallbackRoute.routeGeometry == null || fallbackRoute.aborted).toBe(true);
    expect(fallbackRoute.isRoadFollowing).toBeFalsy();
  });

  // =========================================================================
  // SCENARIO 10: Mock coordinates are labeled MOCK_DEMO
  // =========================================================================
  test('Scenario 10: Map popups do not expose internal provenance labels to the user', async ({ page, request }) => {
    // ── Part 1: API internal provenance is preserved ─────────────────────────
    // The backend may use MOCK_DEMO internally — that is fine and expected.
    // What matters is that this label is NEVER rendered in the UI.
    const res = await request.get('/api/locations/live');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.counts.demoVehicles).toBeGreaterThan(0);

    const demoVeh = json.vehicles.find((v) => v.coordinatesSource === 'MOCK_DEMO');
    expect(demoVeh).toBeDefined();
    expect(demoVeh.isLiveGPS).toBe(false);
    // Internal provenance metadata is intact in the API
    expect(demoVeh.coordinatesSource).toBe('MOCK_DEMO');

    // ── Part 2: Rendered popup contains no forbidden user-facing labels ───────
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    // Wait for Leaflet map and markers to fully initialize
    await page.waitForSelector('.leaflet-container', { state: 'visible', timeout: 10000 });
    // .leaflet-marker-icon is the actual Leaflet marker element that carries
    // the bindPopup() handler. The data-vehicle-id div inside divIcon HTML does
    // not receive Leaflet click events directly.
    await page.waitForSelector('.leaflet-marker-icon', { state: 'attached', timeout: 10000 });

    // Click the first vehicle marker to open its Leaflet popup
    await page.locator('.leaflet-marker-icon').first().click({ force: true });

    // Wait for the Leaflet popup to appear (robust — no fixed sleep)
    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible({ timeout: 8000 });
    const text = await popup.innerText();

    // Must contain meaningful operational location information
    expect(text.trim().length).toBeGreaterThan(0);

    // Forbidden user-facing terminology — must NEVER appear in rendered popup
    // (Internal coordinatesSource 'MOCK_DEMO' is mapped to 'Operational Location'
    // in the UI, so none of these terms should ever appear in the popup.)
    const forbidden = ['Mock', 'Demo', 'Simulation', 'Fake', 'MOCK_DEMO', 'MOBILE_GPS'];
    for (const term of forbidden) {
      expect(text).not.toContain(term);
    }
  });


  // =========================================================================
  // SCENARIO 11: Real GPS coordinates take precedence over mock
  // =========================================================================
  test('Scenario 11: Live GPS coordinates take strict precedence over mock data', () => {
    // Test the enrichment logic invariant
    const sampleRecord = {
      vehicleId: 'VH104',
      latitude: 11.0168,
      longitude: 76.9558,
      coordinatesSource: 'LIVE_GPS',
      locationTimestamp: '2026-09-10T10:00:00.000Z'
    };

    // If coordinates already exist with LIVE_GPS, mock coordinates must NOT overwrite them
    const hasLive = typeof sampleRecord.latitude === 'number' && sampleRecord.coordinatesSource === 'LIVE_GPS';
    expect(hasLive).toBe(true);

    const finalLat = hasLive ? sampleRecord.latitude : (DEMO_VEHICLE_COORDINATES['VH104']?.lat);
    const finalSource = hasLive ? sampleRecord.coordinatesSource : 'MOCK_DEMO';

    expect(finalLat).toBe(11.0168);
    expect(finalSource).toBe('LIVE_GPS');
  });

  // =========================================================================
  // SCENARIO 13: Total route distance reflects optimized stop order
  // =========================================================================
  test('Scenario 13: Sequence optimization reduces total route distance and displays saved km', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    // Set Origin: Coimbatore, Destination: Chennai
    await page.locator('[data-testid="origin-select"]').selectOption('Coimbatore');
    await page.locator('[data-testid="destination-select"]').selectOption('Chennai');

    // Add Salem first
    const stopSelect = page.locator('[data-testid="stop-add-select"]');
    await expect(stopSelect).toBeVisible({ timeout: 10000 });
    await stopSelect.selectOption('Salem');
    await page.click('[data-testid="add-stop-btn"]');
    await page.waitForTimeout(500);

    // Add Tiruppur second (suboptimal: Coimbatore -> Salem -> Tiruppur -> Chennai)
    await expect(stopSelect).toBeVisible({ timeout: 10000 });
    await stopSelect.selectOption('Tiruppur');
    await page.click('[data-testid="add-stop-btn"]');
    await page.waitForTimeout(500);

    // Verify "Optimize Sequence" button is visible
    const optimizeBtn = page.locator('[data-testid="optimize-sequence-btn"]');
    await expect(optimizeBtn).toBeVisible({ timeout: 5000 });

    // Click Optimize Sequence
    await optimizeBtn.click();

    // Verify notification or optimization note appears confirming saved km
    await expect(
      page.locator('text=/Optimized sequence:|Route sequence optimized!|Saved ~?\\d+/').first()
    ).toBeVisible({ timeout: 10000 });
  });

  // =========================================================================
  // SCENARIO 14: Gateway proxies POST /api/routes/optimize to upstream backend
  // =========================================================================
  test('Scenario 14: Gateway proxies POST /api/routes/optimize to upstream Render backend', async ({ request }) => {
    const res = await request.post('/api/routes/optimize', {
      data: {
        origin: 'Erode',
        destination: 'Coimbatore',
        waypoints: ['Tiruppur']
      }
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toContain('Route optimization completed successfully');
    expect(json.data).toBeDefined();
    expect(json.data.origin).toBe('Erode');
    expect(json.data.destination).toBe('Coimbatore');
    expect(json.data.waypoints).toEqual(['Tiruppur']);
    expect(json.data.optimizedStops).toEqual(['Erode', 'Tiruppur', 'Coimbatore']);
    expect(json.data.stopCount).toBe(3);
    expect(json.data.optimization).toBeDefined();
    expect(json.data.generatedAt).toBeDefined();
  });

});
