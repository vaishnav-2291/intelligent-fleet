import { test, expect } from '@playwright/test';

test.describe('Interactive Map & Route Optimization Tests', () => {
  test('Map loads Leaflet instance, displays corridor markers, HUD telemetry, and route polyline', async ({ page }) => {
    // 1. Sign in
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });

    // 2. Navigate to Dispatch & Routing
    await page.click('button:has-text("Dispatch & Routing")');
    await expect(page.locator('text=Dispatch & Corridor Routing')).toBeVisible({ timeout: 10000 });

    // 3. Verify Leaflet Map Container
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });

    // 4. Verify Origin & Destination custom DivIcon markers
    const originMarker = page.locator('.custom-fleet-marker.origin-marker');
    await expect(originMarker.first()).toBeVisible({ timeout: 10000 });

    const destMarker = page.locator('.custom-fleet-marker.destination-marker');
    await expect(destMarker.first()).toBeVisible({ timeout: 10000 });

    // 5. Verify Route Polyline SVG paths rendered in Leaflet overlay pane
    const polylines = page.locator('.leaflet-overlay-pane svg path');
    await expect(polylines.first()).toBeVisible({ timeout: 10000 });

    // Assert stacked highlighted route polylines exist and have road geometry points
    const pathCount = await polylines.count();
    expect(pathCount).toBeGreaterThanOrEqual(2);

    const pathD = await polylines.first().getAttribute('d');
    expect(pathD).toBeTruthy();
    const coordinateCommands = (pathD.match(/[ML]/g) || []).length;
    expect(coordinateCommands).toBeGreaterThan(15);

    // Verify prominent stroke styling for highlighted route
    const strokeColors = await polylines.evaluateAll(paths => paths.map(p => p.getAttribute('stroke')));
    const hasHighlightColor = strokeColors.some(c => c === '#00D2FF' || c === '#070A12' || c === '#60A5FA');
    expect(hasHighlightColor).toBe(true);

    // 6. Verify Distance & Duration Telemetry in Map HUD
    await expect(page.locator('text=/\\d+\\s*km/').first()).toBeVisible();
    await expect(page.locator('text=/\\d+h\\s*\\d*m/').first()).toBeVisible();

    // 7. Verify Corridors, Route Legend, and Route controls
    await expect(page.locator('text=Kongu Industrial Ring')).toBeVisible();
    await expect(page.locator('text=Origin Dispatch Hub')).toBeVisible();
    await expect(page.locator('text=Destination Delivery Station')).toBeVisible();
    await expect(page.locator('text=Interactive Leaflet')).toBeVisible();

    // 8. Verify Non-Intrusive Route Legend
    const legend = page.locator('[data-testid="map-route-legend"]');
    await expect(legend).toBeVisible();
    await expect(legend).toContainText('OPTIMIZED ROUTE');
    await expect(legend).toContainText('OSRM ROAD NETWORK');
  });

  test('Basemap regression check: vector basemap layer is present, no key-required watermark, and no mock terminology', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    // 1. Map container is visible
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });

    // 2. Route polyline is visible and has multiple geometry points
    const polylines = page.locator('.leaflet-overlay-pane svg path');
    await expect(polylines.first()).toBeVisible({ timeout: 10000 });
    const pathD = await polylines.first().getAttribute('d');
    const coordinateCommands = (pathD.match(/[ML]/g) || []).length;
    expect(coordinateCommands).toBeGreaterThan(15);

    // 3. Basemap layer is present in the DOM (MapLibre vector canvas or tile layer)
    const tilePane = page.locator('.leaflet-tile-pane');
    await expect(tilePane).toBeAttached({ timeout: 10000 });
    const basemapLayer = page.locator('.leaflet-tile-pane canvas, .leaflet-tile-pane .leaflet-gl-layer, .maplibregl-canvas, .leaflet-tile-pane img');
    await expect(basemapLayer.first()).toBeAttached({ timeout: 10000 });

    // 4. Origin and Destination markers exist
    await expect(page.locator('[data-testid="origin-marker"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="destination-marker"]')).toBeVisible({ timeout: 10000 });

    // 5. Key-required watermark is strictly absent from the rendered map and document
    await expect(page.locator('text=/api\\s*key\\s*required/i')).not.toBeVisible();

    // 6. No mock / demo / fake / MOBILE_GPS terminology in rendered UI
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/\b(MOCK_DEMO|Fake GPS|Mock Data|Demo Simulation|MOBILE_GPS)\b/i);
  });
});

