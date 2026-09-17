/**
 * Security Test Suite: Driver Role Isolation
 */
import { test, expect } from '@playwright/test';

const DRIVER_PHONE    = '9123456789';
const DRIVER_PASSWORD = 'driver123';
const ADMIN_PHONE     = '9876543210';
const ADMIN_PASSWORD  = 'admin123';

async function signIn(page, phone, password) {
  await page.goto('/');
  await page.fill('#phone-input', phone);
  await page.fill('#password-input', password);
  await page.click('button:has-text("Sign In to System")');
}

async function getToken(request, phone, password) {
  const res = await request.post('/api/auth/login', { data: { identifier: phone, password } });
  const data = await res.json();
  return data.token;
}

test('Driver login lands on Driver Portal only', async ({ page }) => {
  await signIn(page, DRIVER_PHONE, DRIVER_PASSWORD);
  await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('h1:has-text("Dashboard Overview")')).not.toBeVisible({ timeout: 3000 });
});

test('Real driver does NOT see Admin Dashboard button', async ({ page }) => {
  await signIn(page, DRIVER_PHONE, DRIVER_PASSWORD);
  await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });
  const adminBtn = page.locator('button:has-text("Admin Dashboard")');
  await expect(adminBtn).not.toBeVisible({ timeout: 3000 });
  await expect(page.locator('[data-testid="admin-dashboard-return-btn"]')).toHaveCount(0);
});

test('Driver cannot escalate via URL navigation', async ({ page }) => {
  await signIn(page, DRIVER_PHONE, DRIVER_PASSWORD);
  await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });

  // Navigating to /?view=admin resets in-memory React state (no persistence in this session)
  // The critical assertion is: Admin Dashboard must NEVER appear
  await page.goto('/?view=admin');

  // Either: login page is shown (session not persisted = secure), OR Driver Portal is shown
  // Admin Dashboard must NEVER render
  await expect(page.locator('h1:has-text("Dashboard Overview")')).not.toBeVisible({ timeout: 5000 });

  // Confirm we end up at login or driver portal — not admin
  const loginBtn = page.locator('button:has-text("Sign In to System")');
  const driverPortal = page.locator('text=Driver Portal');
  const isLogin = await loginBtn.isVisible().catch(() => false);
  const isDriverPortal = await driverPortal.first().isVisible().catch(() => false);
  expect(isLogin || isDriverPortal).toBe(true);
});

test('DRIVER token is rejected with 403 on POST /api/vehicles', async ({ request }) => {
  const token = await getToken(request, DRIVER_PHONE, DRIVER_PASSWORD);
  const res = await request.post('/api/vehicles', {
    headers: { Authorization: `Bearer ${token}` },
    data: { vehicleId: 'VH-TEST-001', registrationNumber: 'TN-TEST-001', type: 'Mini Truck' }
  });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.success).toBe(false);
});

test('DRIVER token is rejected with 403 on POST /api/drivers', async ({ request }) => {
  const token = await getToken(request, DRIVER_PHONE, DRIVER_PASSWORD);
  const res = await request.post('/api/drivers', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Test Driver', licenseNumber: 'TN-TEST-LIC', phone: '9000000001' }
  });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.success).toBe(false);
});

test('DRIVER token is rejected with 403 on GET /api/audit-logs', async ({ request }) => {
  const token = await getToken(request, DRIVER_PHONE, DRIVER_PASSWORD);
  const res = await request.get('/api/audit-logs', { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.success).toBe(false);
});

test('Admin login lands on Admin Dashboard', async ({ page }) => {
  await signIn(page, ADMIN_PHONE, ADMIN_PASSWORD);
  await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });
});

test('Admin can switch to driver preview and return to Admin Dashboard', async ({ page }) => {
  await signIn(page, ADMIN_PHONE, ADMIN_PASSWORD);
  await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });
  await page.click('button:has-text("Switch to Driver View")');
  await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 8000 });
  const returnBtn = page.locator('button:has-text("Admin Dashboard")');
  await expect(returnBtn).toBeVisible({ timeout: 5000 });
  await returnBtn.click();
  await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 8000 });
});

test('Demo quick-fill for Fleet Driver populates driver credentials', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Fleet Driver")');
  const phoneVal = await page.inputValue('#phone-input');
  expect(phoneVal).toBe('9123456789');
  await expect(page.locator('button:has-text("Sign In to System")')).toBeVisible();
});

test('Logout returns user to login page', async ({ page }) => {
  await signIn(page, DRIVER_PHONE, DRIVER_PASSWORD);
  await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });
  await page.click('button:has-text("Sign Out")');
  await expect(page.locator('button:has-text("Sign In to System")')).toBeVisible({ timeout: 8000 });
});
