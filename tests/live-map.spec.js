import { test, expect } from '@playwright/test';

test.describe('Live Map & Backend Coordinate Architecture Tests', () => {
  test('Backend API returns enriched coordinates with honest provenance labeling', async ({ request }) => {
    // 1. Vehicles endpoint returns numerical coordinates and provenance
    const vRes = await request.get('/api/vehicles');
    expect(vRes.status()).toBe(200);
    const vJson = await vRes.json();
    expect(vJson.success).toBe(true);
    expect(Array.isArray(vJson.data)).toBe(true);
    expect(vJson.data.length).toBeGreaterThan(0);

    const sampleVehicle = vJson.data[0];
    expect(typeof sampleVehicle.latitude).toBe('number');
    expect(typeof sampleVehicle.longitude).toBe('number');
    expect(sampleVehicle.coordinatesSource).toBeDefined();
    expect(sampleVehicle.isLiveGPS).toBeDefined();
    console.log('[Enriched Vehicle Sample]:', {
      id: sampleVehicle.vehicleId,
      lat: sampleVehicle.latitude,
      lng: sampleVehicle.longitude,
      source: sampleVehicle.coordinatesSource,
      isLiveGPS: sampleVehicle.isLiveGPS
    });

    // 2. Drivers endpoint returns numerical coordinates
    const dRes = await request.get('/api/drivers');
    expect(dRes.status()).toBe(200);
    const dJson = await dRes.json();
    expect(dJson.success).toBe(true);
    expect(Array.isArray(dJson.data)).toBe(true);
    const sampleDriver = dJson.data[0];
    expect(typeof sampleDriver.latitude).toBe('number');
    expect(typeof sampleDriver.longitude).toBe('number');

    // 3. Consolidated live location endpoint returns full snapshot
    const locRes = await request.get('/api/locations/live');
    expect(locRes.status()).toBe(200);
    const locJson = await locRes.json();
    expect(locJson.success).toBe(true);
    expect(locJson.counts.positionedVehicles).toBeGreaterThan(0);
    expect(locJson.counts.positionedDrivers).toBeGreaterThan(0);
    expect(Array.isArray(locJson.vehicles)).toBe(true);
  });

  test('Map renders backend vehicle and driver markers with popups', async ({ page }) => {
    // Sign in to access Dispatch & Routing
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });

    // Navigate to Dispatch & Routing
    await page.click('button:has-text("Dispatch & Routing")');
    await expect(page.locator('text=Dispatch & Corridor Routing')).toBeVisible({ timeout: 10000 });

    // Map container exists
    const map = page.locator('.leaflet-container');
    await expect(map).toBeVisible({ timeout: 10000 });

    // Verify Vehicle Markers rendered from backend data
    const vehicleMarkers = page.locator('[data-vehicle-id]');
    await expect(vehicleMarkers.first()).toBeVisible({ timeout: 10000 });
    const vCount = await vehicleMarkers.count();
    expect(vCount).toBeGreaterThan(0);
    console.log(`[Map Verification]: Found ${vCount} live vehicle markers on Leaflet canvas.`);

    // Wait for markers and click the vehicle marker's Leaflet container to open details popup
    await page.evaluate(() => {
      const el = document.querySelector('[data-vehicle-id]');
      if (el) {
        const marker = el.closest('.leaflet-marker-icon') || el;
        marker.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    });
    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible({ timeout: 10000 });
    const popupText = await popup.innerText();
    expect(popupText).toMatch(/Fuel Level:|Vehicle/);
    expect(popupText).toContain('Coordinate Source:');
    console.log('[Vehicle Popup Verification]:', popupText.replace(/\n+/g, ' '));
  });

  test('Trip route visualization supports Madurai and OSRM highway geometry', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');

    // Select Madurai as destination terminal
    const destSelect = page.locator('[data-testid="destination-select"]');
    await destSelect.selectOption('Madurai');

    // Route calculation HUD should reflect updated road distance and ETA
    await expect(page.locator('text=/\\d+\\s*km/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/\\d+h\\s*\\d*m/').first()).toBeVisible();

    // Verify Destination Marker for Madurai exists on map
    const destMarker = page.locator('.custom-fleet-marker.destination-marker');
    await expect(destMarker.first()).toBeVisible();
    await expect(destMarker.filter({ hasText: 'Madurai' })).toBeVisible();
  });

  test('AI Chat provides contextual map action to focus referenced vehicle', async ({ page }) => {
    // Mock /api/ai/chat to prevent consuming SNS Agent Workbench credits
    await page.route('/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Vehicle VH104 currently has 78% fuel level and is stationed at Coimbatore Hub.',
          answer: 'Vehicle VH104 currently has 78% fuel level and is stationed at Coimbatore Hub.',
          source: 'mock_test_guard'
        })
      });
    });

    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    // Open AI Chat
    await page.click('[data-testid="ai-chat-launcher"]');
    const input = page.locator('[data-testid="ai-chat-input"]');
    await expect(input).toBeVisible();

    // Ask about VH104
    await input.fill('What is the fuel level of VH104?');
    await page.click('[data-testid="ai-chat-send"]');

    // Wait for AI response
    const aiMessage = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]');
    await expect(aiMessage.first()).toBeVisible({ timeout: 15000 });

    // Focus on Map button should appear for VH104
    const focusBtn = page.locator('[data-testid="chat-view-map-VH104"]');
    await expect(focusBtn).toBeVisible({ timeout: 5000 });

    // Click "Focus VH104 on Map"
    await focusBtn.click();

    // Verifies navigation to Dispatch & Routing view
    await expect(page.locator('text=Dispatch & Corridor Routing')).toBeVisible({ timeout: 10000 });

    // Verifies map container is active
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });
});
