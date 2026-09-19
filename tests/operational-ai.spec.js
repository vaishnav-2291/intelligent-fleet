import { test, expect } from '@playwright/test';
import { FLEET_AI_UNAVAILABLE_MESSAGE, isStrictFleetText, isStrictFleetResponse } from '../src/services/snsApi.js';

test.describe('Operational Fleet AI: Direct Live Backend Execution', () => {

  // -------------------------------------------------------------------------
  // 1. DRIVER: Which drivers are currently active?
  // -------------------------------------------------------------------------
  test('1. "Which drivers are currently active?" returns live active drivers from backend', async ({ request }) => {
    let res;
    let json;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await request.post('/api/ai/chat', {
        data: {
          message: 'Which drivers are currently active?',
          sessionId: 'e2e-driver-test'
        }
      });
      expect(res.status()).toBe(200);
      json = await res.json();
      if (json.success && json.message && json.message.includes('active drivers')) {
        break;
      }
      await new Promise((r) => setTimeout(r, 2500));
    }

    expect(json.success).toBe(true);
    expect(json.module).toBe('fleet_ai');
    expect(json.intent).toBe('DRIVER');
    expect(json.operation).toBe('QUERY_DRIVERS');

    // Authoritative check: live backend has 8 active drivers
    expect(json.message).toContain('active drivers');
    expect(json.message).toContain('DR001');
    expect(json.message).toContain('Arun Kumar');
    expect(json.data.activeDriversCount).toBeGreaterThanOrEqual(8);
    expect(isStrictFleetText(json.message)).toBe(true);
    expect(isStrictFleetResponse(json, json.message)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 2. VEHICLE: Show all vehicles
  // -------------------------------------------------------------------------
  test('2. "Show all vehicles" returns live vehicle inventory roster', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Show all vehicles',
        sessionId: 'e2e-vehicle-test'
      }
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.module).toBe('fleet_ai');
    expect(json.intent).toBe('VEHICLE');
    expect(json.operation).toBe('QUERY_VEHICLES');

    // Authoritative check: live MongoDB vehicles
    expect(json.message).toContain('Live Fleet Inventory');
    expect(json.message).toContain(`${json.data.total} vehicles`);
    expect(json.message).toContain('VH104');
    expect(json.data.total).toBeGreaterThanOrEqual(10);
    expect(json.result.length).toBe(json.data.total);
    expect(isStrictFleetText(json.message)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. VEHICLE SPECIFIC: Where is VH104?
  // -------------------------------------------------------------------------
  test('3. "Where is VH104?" returns live location and status from backend', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Where is VH104?',
        sessionId: 'e2e-vh104-test'
      }
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.intent).toBe('VEHICLE');
    expect(json.operation).toBe('QUERY_VEHICLES');

    // Authoritative check: VH104 is in Tiruppur with status maintenance
    expect(json.message).toContain('VH104');
    expect(json.message).toContain('Tiruppur');
    expect(json.message).toContain('maintenance');
    expect(json.data.vehicle.vehicleId).toBe('VH104');
    expect(isStrictFleetText(json.message)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. TRIP: Show all ongoing trips
  // -------------------------------------------------------------------------
  test('4. "Show all ongoing trips" returns live in-progress trips', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Show all ongoing trips',
        sessionId: 'e2e-trips-test'
      }
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.intent).toBe('TRIP');
    expect(json.operation).toBe('QUERY_TRIPS');

    // Authoritative check: ongoing trips include TR001, TR102, TR106, TR109
    expect(json.message).toContain('ongoing trip');
    expect(json.data.ongoingCount).toBeGreaterThanOrEqual(1);
    expect(json.result.length).toBeGreaterThanOrEqual(1);
    expect(isStrictFleetText(json.message)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. MAINTENANCE: Which vehicles are under maintenance?
  // -------------------------------------------------------------------------
  test('5. "Which vehicles are under maintenance?" returns live maintenance data', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Which vehicles are under maintenance?',
        sessionId: 'e2e-maint-test'
      }
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.intent).toBe('MAINTENANCE');
    expect(json.operation).toBe('QUERY_MAINTENANCE');

    // Authoritative check: VH104 has maintenance status, and pending services exist
    expect(json.message).toContain('VH104');
    expect(json.message).toContain('maintenance');
    expect(json.data.pendingCount).toBeGreaterThanOrEqual(1);
    expect(isStrictFleetText(json.message)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 6. FUEL: Which vehicles have low fuel?
  // -------------------------------------------------------------------------
  test('6. "Which vehicles have low fuel?" returns live low-fuel vehicles (<50%)', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Which vehicles have low fuel?',
        sessionId: 'e2e-fuel-test'
      }
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.intent).toBe('FUEL');
    expect(json.operation).toBe('QUERY_FUEL');

    // Authoritative check: VH104 (45%) and VH109 (49%) have <50% fuel
    expect(json.message).toContain('VH104');
    expect(json.message).toContain('45%');
    expect(json.data.lowFuelCount).toBe(2);
    expect(isStrictFleetText(json.message)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. SAFETY: Show current safety alerts
  // -------------------------------------------------------------------------
  test('7. "Show current safety alerts" returns live safety alerts', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Show current safety alerts',
        sessionId: 'e2e-safety-test'
      }
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.intent).toBe('SAFETY_ALERT');
    expect(json.operation).toBe('QUERY_SAFETY');

    // Authoritative check: live safety alerts (total 11, 7 open, 2 critical)
    expect(json.message).toContain('Safety Alerts');
    expect(json.message).toContain('SA109');
    expect(json.data.totalAlerts).toBe(11);
    expect(json.data.openCount).toBe(7);
    expect(json.data.criticalCount).toBe(2);
    expect(isStrictFleetText(json.message)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 8. ANALYTICS: Give me fleet analytics
  // -------------------------------------------------------------------------
  test('8. "Give me fleet analytics" returns authoritative aggregated metrics', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Give me fleet analytics',
        sessionId: 'e2e-analytics-test'
      }
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.intent).toBe('ANALYTICS');
    expect(json.operation).toBe('QUERY_ANALYTICS');

    // Authoritative check: metrics from live MongoDB
    expect(json.message).toContain('Fleet Analytics');
    expect(json.message).toContain(`${json.data.totalVehicles} total vehicles`);
    expect(json.data.totalVehicles).toBeGreaterThanOrEqual(10);
    expect(json.data.totalDrivers).toBeGreaterThanOrEqual(10);
    expect(isStrictFleetText(json.message)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 9. ROUTE OPTIMIZATION: Optimize the route from Coimbatore to Chennai via Erode and Salem
  // -------------------------------------------------------------------------
  test('9. "Optimize the route from Coimbatore to Chennai via Erode and Salem" calls backend POST /api/routes/optimize', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Optimize the route from Coimbatore to Chennai via Erode and Salem',
        sessionId: 'e2e-route-test'
      }
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.intent).toBe('ROUTE');
    expect(json.operation).toBe('OPTIMIZE_ROUTE');

    // Authoritative check: real response from /api/routes/optimize
    expect(json.message).toContain('Route optimization completed successfully');
    expect(json.message).toContain('Coimbatore → Erode → Salem → Chennai');
    expect(json.data.origin).toBe('Coimbatore');
    expect(json.data.destination).toBe('Chennai');
    expect(json.data.waypoints).toEqual(['Erode', 'Salem']);
    expect(json.data.optimizedStops).toEqual(['Coimbatore', 'Erode', 'Salem', 'Chennai']);
    expect(json.data.stopCount).toBe(4);
    expect(isStrictFleetText(json.message)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 10. BROWSER UI INTEGRATION TEST: Operational queries in the Chat Box
  // -------------------------------------------------------------------------
  test('10. Frontend AI Assistant UI executes real backend queries without Gemini dependency', async ({ page }) => {
    // 1. Sign in as Admin
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 15000 });

    // 2. Open AI Chat Launcher
    await page.click('[data-testid="ai-chat-launcher"]');
    const chatPanel = page.locator('[data-testid="ai-chat-panel"]');
    await expect(chatPanel).toBeVisible();

    const input = page.locator('[data-testid="ai-chat-input"]');
    await expect(input).toBeVisible();

    // 3. Ask question: "Which drivers are currently active?"
    await input.fill('Which drivers are currently active?');
    await page.click('[data-testid="ai-chat-send"]');

    // Wait for response bubble
    const aiMessage = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]');
    await expect(aiMessage.first()).toBeVisible({ timeout: 15000 });
    const replyText = await aiMessage.first().innerText();

    expect(replyText).not.toContain(FLEET_AI_UNAVAILABLE_MESSAGE);
    expect(replyText.toLowerCase()).toContain('active driver');
    expect(replyText).toContain('DR001');

    // 4. Ask second question: "Where is VH104?"
    await input.fill('Where is VH104?');
    await page.click('[data-testid="ai-chat-send"]');

    const secondReply = aiMessage.nth(1);
    await expect(secondReply).toBeVisible({ timeout: 15000 });
    const reply2Text = await secondReply.innerText();

    expect(reply2Text).not.toContain(FLEET_AI_UNAVAILABLE_MESSAGE);
    expect(reply2Text).toContain('VH104');
    expect(reply2Text).toContain('Tiruppur');

    // 5. Verify "Focus VH104 on Map" button renders
    const focusBtn = page.locator('[data-testid="chat-view-map-VH104"]');
    await expect(focusBtn).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 11. BROWSER UI INTEGRATION TEST: AI Route Optimization -> Dispatch Map
  // -------------------------------------------------------------------------
  test('11. AI Route Query synchronizes automatically with Dispatch & Routing Leaflet map', async ({ page }) => {
    // 1. Sign in as Admin
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 15000 });

    // 2. Open AI Chat Launcher
    await page.click('[data-testid="ai-chat-launcher"]');
    const chatPanel = page.locator('[data-testid="ai-chat-panel"]');
    await expect(chatPanel).toBeVisible();

    const input = page.locator('[data-testid="ai-chat-input"]');
    await expect(input).toBeVisible();

    // 3. Ask route optimization question
    await input.fill('Optimize the route from Coimbatore to Chennai via Erode and Salem');
    await page.click('[data-testid="ai-chat-send"]');

    // 4. Verify AI response bubble succeeds
    const aiMessage = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]');
    await expect(aiMessage.first()).toBeVisible({ timeout: 20000 });
    const replyText = await aiMessage.first().innerText();

    expect(replyText).not.toContain(FLEET_AI_UNAVAILABLE_MESSAGE);
    expect(replyText).toContain('Route optimization completed successfully');
    expect(replyText).toContain('Coimbatore');
    expect(replyText).toContain('Chennai');
    expect(replyText).toContain('Erode');
    expect(replyText).toContain('Salem');

    // 5. Verify action button is provided in AI chat message
    const focusRouteBtn = page.locator('[data-testid="chat-view-focus-route"]');
    await expect(focusRouteBtn).toBeVisible();

    // 6. Verify Dispatch & Routing view is automatically active
    await expect(page.locator('text=Dispatch & Corridor Routing')).toBeVisible({ timeout: 10000 });

    // 7. Verify origin, destination, and waypoints in Dispatch & Routing
    const originSelect = page.locator('[data-testid="origin-select"]');
    await expect(originSelect).toHaveValue('Coimbatore');

    const destSelect = page.locator('[data-testid="destination-select"]');
    await expect(destSelect).toHaveValue('Chennai');

    // Intermediate waypoints in the list
    await expect(page.locator('text=Erode Waystation').first()).toBeVisible();
    await expect(page.locator('text=Salem Waystation').first()).toBeVisible();

    // 8. Verify Leaflet map container and markers
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });

    await expect(page.locator('[data-testid="origin-marker"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="destination-marker"]')).toBeVisible({ timeout: 10000 });

    const waypointMarkers = page.locator('[data-testid="waypoint-marker"]');
    await expect(waypointMarkers.first()).toBeVisible({ timeout: 10000 });
    expect(await waypointMarkers.count()).toBe(2);

    // 9. Verify actual OSRM road-following polyline appears
    const polylines = page.locator('.leaflet-overlay-pane svg path');
    await expect(polylines.first()).toBeVisible({ timeout: 15000 });
    const pathCount = await polylines.count();
    expect(pathCount).toBeGreaterThanOrEqual(2);

    const pathD = await polylines.first().getAttribute('d');
    expect(pathD).toBeTruthy();
    const coordinateCommands = (pathD.match(/[ML]/g) || []).length;
    // Highway polyline from Coimbatore to Chennai contains dozens to hundreds of geometry points
    expect(coordinateCommands).toBeGreaterThan(20);

    // 10. Verify Route Summary shows actual calculated distance and duration
    await expect(page.locator('text=/\\d+\\s*km/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/\\d+h\\s*\\d*m/').first()).toBeVisible();

    // 11. Verify live vehicle and driver markers remain visible
    const vehicleMarkers = page.locator('[data-testid="vehicle-marker"]');
    const driverMarkers = page.locator('[data-testid="driver-marker"]');
    expect(await vehicleMarkers.count()).toBeGreaterThan(0);
    expect(await driverMarkers.count()).toBeGreaterThan(0);

    // Wait for Leaflet map animation/movement to finish settling if active
    await page.waitForFunction(() => {
      const mapEl = document.querySelector('.leaflet-container');
      // @ts-ignore
      const leafletMap = mapEl?._leaflet_map;
      return leafletMap ? !leafletMap._animatingZoom : true;
    }, { timeout: 5000 }).catch(() => {});

    await page.waitForTimeout(600);

    const routeBoundsCheck = await page.evaluate(() => {
      const mapEl = document.querySelector('.leaflet-container');
      const originMarker = document.querySelector('[data-testid="origin-marker"]');
      const destMarker = document.querySelector('[data-testid="destination-marker"]');
      const wpMarkers = document.querySelectorAll('[data-testid="waypoint-marker"]');
      if (!mapEl || !originMarker || !destMarker || wpMarkers.length < 2) return { error: 'missing elements' };

      // @ts-ignore
      const map = mapEl._leaflet_map;
      if (!map) return { error: 'missing leaflet map instance' };

      const mapRect = mapEl.getBoundingClientRect();
      const originRect = originMarker.getBoundingClientRect();
      const destRect = destMarker.getBoundingClientRect();
      const wpRects = Array.from(wpMarkers).map(w => w.getBoundingClientRect());

      // 1. Verify markers are framed inside the visible map container viewport
      const isInside = (r) => (
        r.top >= mapRect.top - 10 &&
        r.bottom <= mapRect.bottom + 10 &&
        r.left >= mapRect.left - 10 &&
        r.right <= mapRect.right + 10
      );

      const allMarkersInside = isInside(originRect) && isInside(destRect) && wpRects.every(isInside);

      // 2. Verify Leaflet map viewport bounds contain the complete route bounds (Coimbatore, Erode, Salem, Chennai)
      const mapBounds = map.getBounds();
      const coimbatore = [11.0168, 76.9558];
      const erode = [11.3410, 77.7172];
      const salem = [11.6643, 78.1460];
      const chennai = [13.0827, 80.2707];

      const containsAllKeyPoints = 
        mapBounds.contains(coimbatore) &&
        mapBounds.contains(erode) &&
        mapBounds.contains(salem) &&
        mapBounds.contains(chennai);

      return {
        allMarkersInside,
        containsAllKeyPoints,
        viewportContainsCompleteRoute: allMarkersInside && containsAllKeyPoints,
        mapBounds: {
          south: mapBounds.getSouth(),
          north: mapBounds.getNorth(),
          west: mapBounds.getWest(),
          east: mapBounds.getEast()
        }
      };
    });

    expect(routeBoundsCheck.allMarkersInside).toBe(true);
    expect(routeBoundsCheck.containsAllKeyPoints).toBe(true);
    expect(routeBoundsCheck.viewportContainsCompleteRoute).toBe(true);

    // 13. Test clicking action button refocuses the route
    await focusRouteBtn.click();
    await expect(page.locator('[data-testid="origin-marker"]')).toBeVisible();
    await expect(page.locator('[data-testid="destination-marker"]')).toBeVisible();
  });
});
