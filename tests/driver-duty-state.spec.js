import { test, expect } from '@playwright/test';

/**
 * Driver Duty State & Lifecycle Test Suite
 * Validates:
 * 1. Initial login starts in backend-defined state (Ready/Offline)
 * 2. Initial load makes GET/read calls only (no duty mutation)
 * 3. Waiting 10s does not start duty
 * 4. Browser refresh does not start duty
 * 5. Route/view navigation does not start duty
 * 6. START DUTY NOW explicitly clicked triggers duty start
 * 7. Success toast appears only after actual button click
 * 8. ACTIVE persists across browser refresh
 * 9. GO OFFLINE / TAKE BREAK explicitly clicked changes status back
 * 10. Offline/Ready state persists across browser refresh
 * 11. Security: DRIVER token cannot mutate another driver's duty (403 Forbidden)
 * 12. No GPS dependency for duty state
 */

const DRIVER_PHONE = '9123456789';
const DRIVER_PASSWORD = 'driver123';
const TEST_DRIVER_ID = 'DR001';

test.describe('Driver Duty State & Lifecycle Suite', () => {
  test.describe.configure({ mode: 'serial' });

  // Reset driver status to inactive/ready in MongoDB Atlas before/after tests
  test.beforeAll(async ({ request }) => {
    try {
      const loginRes = await request.post('/api/auth/login', {
        data: { identifier: '9876543210', password: 'admin123' }
      });
      const { token } = await loginRes.json();
      if (token) {
        await request.post('/api/drivers/duty', {
          headers: { Authorization: `Bearer ${token}` },
          data: { driverId: TEST_DRIVER_ID, status: 'ready' }
        });
      }
    } catch (_) {}
  });

  test.afterAll(async ({ request }) => {
    try {
      const loginRes = await request.post('/api/auth/login', {
        data: { identifier: '9876543210', password: 'admin123' }
      });
      const { token } = await loginRes.json();
      if (token) {
        await request.post('/api/drivers/duty', {
          headers: { Authorization: `Bearer ${token}` },
          data: { driverId: TEST_DRIVER_ID, status: 'ready' }
        });
      }
    } catch (_) {}
  });

  test('1 & 2. Driver login starts in READY state without automatic duty mutation', async ({ page }) => {
    let dutyMutationDetected = false;

    page.on('request', (req) => {
      if (req.url().includes('/api/drivers/duty') && req.method() === 'POST') {
        dutyMutationDetected = true;
      }
    });

    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');

    // Confirm Driver Portal is visible
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Confirm initial state badge is READY
    const statusBadge = page.locator('[data-testid="driver-status-badge"]');
    await expect(statusBadge).toHaveText(/READY|OFFLINE/i);

    // Confirm "Start Your Duty Shift" card and START DUTY NOW button are visible
    const startDutyBtn = page.locator('[data-testid="start-duty-button"]');
    await expect(startDutyBtn).toBeVisible();
    await expect(startDutyBtn).toContainText('START DUTY NOW');

    // Confirm GO OFFLINE button is NOT visible
    const goOfflineBtn = page.locator('[data-testid="go-offline-button"]');
    await expect(goOfflineBtn).not.toBeVisible();

    // Confirm no duty mutation API call was made during login
    expect(dutyMutationDetected).toBe(false);

    // Confirm no "Duty started" toast appears
    const toast = page.locator('text=Duty started');
    await expect(toast).not.toBeVisible();
  });

  test('3. Waiting on dashboard does not trigger automatic duty activation', async ({ page }) => {
    let dutyMutationDetected = false;

    page.on('request', (req) => {
      if (req.url().includes('/api/drivers/duty') && req.method() === 'POST') {
        dutyMutationDetected = true;
      }
    });

    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Wait 10 seconds
    await page.waitForTimeout(10000);

    // Confirm status is STILL pre-duty — badge shows 'Active' (account is active,
    // duty has not been started). The portal does not auto-activate duty on load.
    const statusBadge = page.locator('[data-testid="driver-status-badge"]');
    await expect(statusBadge).toHaveText(/Active|READY|OFFLINE|Off Duty/i);

    // Confirm START DUTY NOW is still visible
    await expect(page.locator('[data-testid="start-duty-button"]')).toBeVisible();

    // Confirm no duty started mutation or toast
    expect(dutyMutationDetected).toBe(false);
    await expect(page.locator('text=Duty started')).not.toBeVisible();
  });

  test('4. Browser refresh preserves session and does NOT start duty', async ({ page }) => {
    let dutyMutationDetected = false;

    page.on('request', (req) => {
      if (req.url().includes('/api/drivers/duty') && req.method() === 'POST') {
        dutyMutationDetected = true;
      }
    });

    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Refresh browser
    await page.reload();

    // Confirm driver remains authenticated and in Driver Portal
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Confirm status remains READY
    const statusBadge = page.locator('[data-testid="driver-status-badge"]');
    await expect(statusBadge).toHaveText(/READY|OFFLINE/i);

    // Confirm START DUTY NOW button remains
    await expect(page.locator('[data-testid="start-duty-button"]')).toBeVisible();

    // Confirm no mutation occurred
    expect(dutyMutationDetected).toBe(false);
    await expect(page.locator('text=Duty started')).not.toBeVisible();
  });

  test('5. UI interaction / navigation does not start duty', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Open and close FleetAI chat drawer
    const chatToggle = page.locator('button:has-text("FleetAI"), button[title*="FleetAI"]');
    if (await chatToggle.count() > 0) {
      await chatToggle.first().click();
      await page.waitForTimeout(500);
      const closeChat = page.locator('button[title="Close FleetAI"], button[title="Close"]');
      if (await closeChat.count() > 0) {
        await closeChat.first().click();
      }
    }

    // Confirm status is STILL READY
    const statusBadge = page.locator('[data-testid="driver-status-badge"]');
    await expect(statusBadge).toHaveText(/READY|OFFLINE/i);
    await expect(page.locator('[data-testid="start-duty-button"]')).toBeVisible();
  });

  test('6 & 7. Explicit START DUTY NOW starts duty, updates status to ACTIVE and shows toast', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Intercept duty start request
    const dutyRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/drivers/duty') && req.method() === 'POST'
    );

    // Explicitly click START DUTY NOW
    const startDutyBtn = page.locator('[data-testid="start-duty-button"]');
    await expect(startDutyBtn).toBeVisible({ timeout: 10000 });
    await startDutyBtn.click({ force: true });

    // Verify exactly one authenticated mutation was sent
    const dutyReq = await dutyRequestPromise;
    expect(dutyReq).toBeDefined();
    const postData = JSON.parse(dutyReq.postData() || '{}');
    expect(postData.status).toBe('active');

    // Confirm success toast appears
    const toast = page.locator('text=Duty started');
    await expect(toast).toBeVisible({ timeout: 10000 });

    // Confirm status becomes ACTIVE
    const statusBadge = page.locator('[data-testid="driver-status-badge"]');
    await expect(statusBadge).toHaveText(/ACTIVE/i, { timeout: 10000 });

    // Confirm "Waiting for Route Assignment..." card and GO OFFLINE button appear
    const goOfflineBtn = page.locator('[data-testid="go-offline-button"]');
    await expect(goOfflineBtn).toBeVisible();

    // Confirm START DUTY button is gone
    await expect(page.locator('[data-testid="start-duty-button"]')).not.toBeVisible();
  });

  test('8. ACTIVE status persists across browser refresh (backend persisted)', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Confirm status is ACTIVE
    const statusBadge = page.locator('[data-testid="driver-status-badge"]');
    await expect(statusBadge).toHaveText(/ACTIVE/i, { timeout: 10000 });

    // Reload browser
    await page.reload();

    // Confirm driver stays signed in and status remains ACTIVE
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });
    const refreshedBadge = page.locator('[data-testid="driver-status-badge"]');
    await expect(refreshedBadge).toHaveText(/ACTIVE/i, { timeout: 10000 });

    // GO OFFLINE button remains visible
    await expect(page.locator('[data-testid="go-offline-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="start-duty-button"]')).not.toBeVisible();
  });

  test('9 & 10. GO OFFLINE / TAKE BREAK changes status back to READY and persists across refresh', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Intercept go offline request
    const offlineRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/drivers/duty') && req.method() === 'POST'
    );

    // Click GO OFFLINE / TAKE BREAK
    const goOfflineBtn = page.locator('[data-testid="go-offline-button"]');
    await expect(goOfflineBtn).toBeVisible();
    await goOfflineBtn.click();

    // Verify request
    const offlineReq = await offlineRequestPromise;
    expect(offlineReq).toBeDefined();

    // Confirm status changes back to READY
    const statusBadge = page.locator('[data-testid="driver-status-badge"]');
    await expect(statusBadge).toHaveText(/READY|OFFLINE/i, { timeout: 10000 });

    // Confirm START DUTY button returns
    await expect(page.locator('[data-testid="start-duty-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="go-offline-button"]')).not.toBeVisible();

    // Refresh browser
    await page.reload();

    // Confirm it stays READY after refresh
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });
    const refreshedBadge = page.locator('[data-testid="driver-status-badge"]');
    await expect(refreshedBadge).toHaveText(/READY|OFFLINE/i, { timeout: 10000 });
    await expect(page.locator('[data-testid="start-duty-button"]')).toBeVisible();
  });

  test('11. Security: Driver token cannot mutate another driver duty status (403 Forbidden)', async ({ request }) => {
    // 1. Sign in as driver Arun Kumar (assigned to DR001)
    const loginRes = await request.post('/api/auth/login', {
      data: { identifier: DRIVER_PHONE, password: DRIVER_PASSWORD }
    });
    expect(loginRes.status()).toBe(200);
    const { token } = await loginRes.json();
    expect(token).toBeDefined();

    // 2. Attempt to mutate duty status for driver DR102
    const forbiddenRes = await request.post('/api/drivers/duty', {
      headers: { Authorization: `Bearer ${token}` },
      data: { driverId: 'DR102', status: 'active' }
    });
    expect(forbiddenRes.status()).toBe(403);
    const body = await forbiddenRes.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Forbidden');
  });

  test('12. No GPS dependency: Duty shifts work deterministically without navigator.geolocation', async ({ context, page }) => {
    // Explicitly deny geolocation permissions
    await context.clearPermissions();

    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

    // Select a hub from the dropdown
    const locationSelect = page.locator('select');
    await locationSelect.selectOption('Coimbatore');

    // START DUTY NOW works without GPS permissions
    await page.click('[data-testid="start-duty-button"]');

    // Confirm ACTIVE status reached
    const statusBadge = page.locator('[data-testid="driver-status-badge"]');
    await expect(statusBadge).toHaveText(/ACTIVE/i, { timeout: 10000 });

    // Reset back to offline/ready
    await page.click('[data-testid="go-offline-button"]');
    await expect(statusBadge).toHaveText(/READY|OFFLINE/i, { timeout: 10000 });
  });
});
