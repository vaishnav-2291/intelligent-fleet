import { test, expect } from '@playwright/test';

/**
 * FINAL DATA CONSISTENCY + IDENTITY RECONCILIATION AUDIT TEST SUITE
 * Validates complete alignment across:
 * MongoDB Atlas via FleetBackend -> Express Gateway -> Web Dashboard -> AI Chat -> Dispatch -> Driver Portal
 */

const TEST_VEHICLE_ID = 'VH104';
const TEST_DRIVER_ID = 'DR104';
const TEST_TRIP_ID = 'TR104';
const DEMO_DRIVER_ID = 'DR001';

test.describe('Data Consistency & Identity Reconciliation Suite', () => {

  test('1. Current vehicle IDs appear consistently in backend and gateway', async ({ request }) => {
    const res = await request.get('/api/vehicles');
    expect(res.status()).toBe(200);
    const json = await res.json();
    const list = json.data || json;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(11);

    const vehicleIds = list.map(v => v.vehicleId);
    expect(vehicleIds).toContain('VH001');
    expect(vehicleIds).toContain('VH101');
    expect(vehicleIds).toContain('VH104');
    expect(vehicleIds).toContain('VH110');
  });

  test('2. Current driver IDs appear consistently in backend and gateway', async ({ request }) => {
    const res = await request.get('/api/drivers');
    expect(res.status()).toBe(200);
    const json = await res.json();
    const list = json.data || json;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(11);

    const driverIds = list.map(d => d.driverId);
    expect(driverIds).toContain('DR001');
    expect(driverIds).toContain('DR101');
    expect(driverIds).toContain('DR104');
    expect(driverIds).toContain('DR110');

    // Confirm DR001 name is Arun Kumar
    const dr001 = list.find(d => d.driverId === 'DR001');
    expect(dr001.name).toBe('Arun Kumar');
  });

  test('3. Current trip IDs appear consistently in backend and gateway', async ({ request }) => {
    const res = await request.get('/api/trips');
    expect(res.status()).toBe(200);
    const json = await res.json();
    const list = json.data || json;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(11);

    const tripIds = list.map(t => t.tripId);
    expect(tripIds).toContain('TR001');
    expect(tripIds).toContain('TR101');
    expect(tripIds).toContain('TR104');
    expect(tripIds).toContain('TR110');
  });

  test('4. Dashboard vehicle equals backend vehicle', async ({ page, request }) => {
    // 1. Fetch live vehicle record from gateway/backend
    const apiRes = await request.get(`/api/vehicles/${TEST_VEHICLE_ID}`);
    expect(apiRes.status()).toBe(200);
    const apiData = (await apiRes.json()).data;
    expect(apiData.vehicleId).toBe(TEST_VEHICLE_ID);
    expect(apiData.registrationNumber).toBe('TN38AB1104');

    // 2. Open dashboard and navigate to Fleet Roster
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Fleet Roster")');
    await expect(page.locator('h2:has-text("Fleet Roster")')).toBeVisible({ timeout: 10000 });

    // 3. Confirm Fleet Roster row matches live backend record
    const vehicleRow = page.locator(`text=${TEST_VEHICLE_ID}`);
    await expect(vehicleRow.first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${apiData.registrationNumber}`).first()).toBeVisible();
  });

  test('5. Dashboard driver equals backend driver', async ({ page, request }) => {
    // 1. Fetch live driver record from backend
    const apiRes = await request.get(`/api/drivers/${TEST_DRIVER_ID}`);
    expect(apiRes.status()).toBe(200);
    const apiData = (await apiRes.json()).data;
    expect(apiData.driverId).toBe(TEST_DRIVER_ID);
    expect(apiData.name).toBe('Dinesh Kumar');

    // 2. Open dashboard and navigate to Driver Roster
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Driver Roster")');
    await expect(page.locator('h2:has-text("Registered Drivers")')).toBeVisible({ timeout: 10000 });

    // 3. Confirm Driver Roster displays driver
    await expect(page.locator(`text=${TEST_DRIVER_ID}`).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h4', { hasText: apiData.name })).toBeVisible({ timeout: 10000 });
  });

  test('6. Dashboard trip equals backend trip', async ({ page, request }) => {
    // 1. Fetch live trip record from backend
    const apiRes = await request.get(`/api/trips/${TEST_TRIP_ID}`);
    expect(apiRes.status()).toBe(200);
    const apiData = (await apiRes.json()).data;
    expect(apiData.tripId).toBe(TEST_TRIP_ID);
    expect(apiData.origin).toBe('Tiruppur');
    expect(apiData.destination).toBe('Bangalore');

    // 2. Open dashboard
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });

    // 3. Confirm Ongoing & Recent Trips Table contains trip corridor matching live backend record
    await expect(page.locator('h2:has-text("Ongoing & Recent Trips")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${apiData.origin}`).first()).toBeVisible();
    await expect(page.locator(`text=${apiData.destination}`).first()).toBeVisible();
  });

  test('7. AI Chat vehicle equals backend vehicle', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: { message: `What is the status of vehicle ${TEST_VEHICLE_ID}?`, sessionId: 'reconcile-test-v' }
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    // VH104 is under maintenance in Tiruppur
    expect(data.message).toContain(TEST_VEHICLE_ID);
    expect(data.message.toLowerCase()).toContain('maintenance');
    expect(data.message).toContain('Tiruppur');
  });

  test('8. AI Chat driver equals backend driver', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: { message: `Who is driver ${TEST_DRIVER_ID}?`, sessionId: 'reconcile-test-d' }
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain(TEST_DRIVER_ID);
    expect(data.message).toContain('Dinesh Kumar');
  });

  test('9. AI Chat trip equals backend trip', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: { message: `What is the status of trip ${TEST_TRIP_ID}?`, sessionId: 'reconcile-test-t' }
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain(TEST_TRIP_ID);
    expect(data.message).toContain('Tiruppur');
    expect(data.message).toContain('Bangalore');
  });

  test('10. Dispatch dropdown uses current live IDs', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });

    // Open Dispatch & Routing View
    const dispatchNav = page.locator('button:has-text("Dispatch"), button[title*="Dispatch"]');
    await dispatchNav.first().click();

    // Verify driver select has all 11 options
    const driverSelect = page.locator('[data-testid="driver-dispatch-select"]');
    await expect(driverSelect).toBeVisible({ timeout: 10000 });
    const driverOptions = await driverSelect.locator('option').allTextContents();
    expect(driverOptions.length).toBe(11);
    expect(driverOptions.some(o => o.includes('DR001') && o.includes('Arun Kumar'))).toBe(true);
    expect(driverOptions.some(o => o.includes('DR104') && o.includes('Dinesh Kumar'))).toBe(true);
    expect(driverOptions.some(o => o.includes('DR110') && o.includes('Rahul Dev'))).toBe(true);
  });

  test('11. Driver duty update targets same current driver', async ({ page, request }) => {
    // Sign in as driver
    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Verify driver name in header is Arun Kumar
    await expect(page.locator('text=Arun Kumar').first()).toBeVisible();
    await expect(page.locator('text=ID: #DR001').first()).toBeVisible();

    // Ensure driver starts in ready/offline state if left active from an earlier test
    const goOfflineIfActive = page.locator('[data-testid="go-offline-button"]');
    if (await goOfflineIfActive.isVisible()) {
      await goOfflineIfActive.click();
      await expect(page.locator('[data-testid="start-duty-button"]')).toBeVisible({ timeout: 5000 });
    }

    // Verify status duty mutation writes to DR001
    const dutyRequestPromise = page.waitForRequest(
      req => req.url().includes('/api/drivers/duty') && req.method() === 'POST'
    );
    const startBtn = page.locator('[data-testid="start-duty-button"]');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click({ force: true });
    const req = await dutyRequestPromise;
    const body = JSON.parse(req.postData() || '{}');
    expect(body.driverId).toBe(DEMO_DRIVER_ID);
    expect(body.status).toBe('active');

    // Confirm status becomes ACTIVE before ending duty
    await expect(page.locator('[data-testid="driver-status-badge"]')).toHaveText(/ACTIVE/i, { timeout: 10000 });

    // Reset back to offline
    const offlineRequestPromise = page.waitForRequest(
      req => req.url().includes('/api/drivers/duty') && req.method() === 'POST'
    );
    const goOfflineBtn = page.locator('[data-testid="go-offline-button"]');
    await expect(goOfflineBtn).toBeVisible({ timeout: 10000 });
    await goOfflineBtn.click();
    await offlineRequestPromise;
    await expect(page.locator('[data-testid="start-duty-button"]')).toBeVisible({ timeout: 10000 });
  });

  test('12. Unknown ID returns "That record was not found in the current fleet database." instead of hallucinating', async ({ request }) => {
    // Non-existent vehicle
    const vRes = await request.post('/api/ai/chat', {
      data: { message: 'What is the status of vehicle VH999?', sessionId: 'unknown-id-test' }
    });
    const vData = await vRes.json();
    expect(vData.success).toBe(true);
    expect(vData.message).toContain('That record was not found in the current fleet database.');

    // Non-existent driver
    const dRes = await request.post('/api/ai/chat', {
      data: { message: 'Who is driver DR999?', sessionId: 'unknown-id-test' }
    });
    const dData = await dRes.json();
    expect(dData.success).toBe(true);
    expect(dData.message).toContain('That record was not found in the current fleet database.');

    // Non-existent trip
    const tRes = await request.post('/api/ai/chat', {
      data: { message: 'What is the status of trip TR999?', sessionId: 'unknown-id-test' }
    });
    const tData = await tRes.json();
    expect(tData.success).toBe(true);
    expect(tData.message).toContain('That record was not found in the current fleet database.');
  });

  test('13. Mock route coordinates do not alter operational identities', async ({ request }) => {
    const res = await request.get('/api/vehicles/VH101');
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;

    // Operational identity fields are preserved from DB
    expect(data.vehicleId).toBe('VH101');
    expect(data.registrationNumber).toBe('TN38AB1101');
    expect(data.status).toBe('active');
    expect(data.driverId).toBe('DR101');

    // Coords enriched with MOCK_DEMO or live without overwriting database attributes
    if (data.coordinatesSource) {
      expect(['MOCK_DEMO', 'LIVE_GPS', 'MOBILE_GPS']).toContain(data.coordinatesSource);
    }
  });

  test('14. Workbench tools align with live production endpoints and schema', async ({ request }) => {
    // Check all operational endpoints that Workbench tools call
    const endpoints = [
      '/api/vehicles',
      '/api/drivers',
      '/api/trips',
      '/api/maintenance',
      '/api/fuel',
      '/api/safety-alerts'
    ];

    for (const ep of endpoints) {
      const res = await request.get(ep);
      expect(res.status()).toBe(200);
      const json = await res.json();
      const records = json.data || json;
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBe(11);
    }
  });
});
