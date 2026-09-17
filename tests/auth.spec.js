import { test, expect } from '@playwright/test';

test.describe('Authentication & Authorization Tests', () => {
  test('User can sign in as Fleet Manager via UI and access Dashboard', async ({ page }) => {
    await page.goto('/');

    // Quick Fill Admin / Manager
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    // Dashboard Overview should become visible
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Tamil Nadu Logistics Corridor')).toBeVisible();

    // Verify Fleet Manager profile in TopHeader
    await expect(page.locator('text=Fleet Manager').first()).toBeVisible();
  });

  test('User can sign in as Driver via UI and access Driver Portal', async ({ page }) => {
    await page.goto('/');

    // Quick Fill Driver
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');

    // Driver Portal should become visible
    await expect(page.locator('text=Driver Portal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Sign Out")').first()).toBeVisible();
  });

  test('Invalid credentials display user-friendly error in UI', async ({ page }) => {
    await page.goto('/');

    // Fill invalid credentials
    await page.fill('input[placeholder*="phone"]', '0000000000');
    await page.fill('input[placeholder*="password"]', 'wrongpassword');
    await page.click('button:has-text("Sign In to System")');

    // Error alert should be visible
    const errorAlert = page.locator('div:has-text("Invalid credentials")');
    await expect(errorAlert.first()).toBeVisible({ timeout: 5000 });
  });

  test('Backend API enforces secure registration and JWT authentication', async ({ request }) => {
    const testPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

    // 1. Registration
    const regRes = await request.post('/api/auth/register', {
      data: {
        name: 'Automated Test User',
        phone: testPhone,
        password: 'securePassword123!',
        role: 'DISPATCHER'
      }
    });
    expect(regRes.status()).toBe(201);
    const regData = await regRes.json();
    expect(regData.success).toBe(true);
    expect(regData.user.role).toBe('DISPATCHER');
    expect(regData.token).toBeDefined();

    // 2. Duplicate registration rejection
    const dupRes = await request.post('/api/auth/register', {
      data: {
        name: 'Automated Test User Duplicate',
        phone: testPhone,
        password: 'securePassword123!'
      }
    });
    expect(dupRes.status()).toBe(409);

    // 3. Login with newly created credentials
    const loginRes = await request.post('/api/auth/login', {
      data: {
        identifier: testPhone,
        password: 'securePassword123!'
      }
    });
    expect(loginRes.status()).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.token).toBeDefined();

    // 4. Access /api/auth/me with Bearer token
    const meRes = await request.get('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${loginData.token}`
      }
    });
    expect(meRes.status()).toBe(200);
    const meData = await meRes.json();
    expect(meData.user.phone).toBe(testPhone);
    expect(meData.user.role).toBe('DISPATCHER');

    // 5. Access /api/auth/me without token -> 401 Unauthorized
    const unauthRes = await request.get('/api/auth/me');
    expect(unauthRes.status()).toBe(401);
  });

  test('Role-Based Access Control (RBAC) blocks unauthorized roles from admin resources', async ({ request }) => {
    // 1. Authenticate as DRIVER
    const driverLogin = await request.post('/api/auth/login', {
      data: {
        identifier: '9123456789',
        password: 'driver123'
      }
    });
    const driverData = await driverLogin.json();
    const driverToken = driverData.token;

    // 2. Attempt to access /api/audit-logs (Requires ADMIN or FLEET_MANAGER)
    const forbiddenRes = await request.get('/api/audit-logs', {
      headers: {
        Authorization: `Bearer ${driverToken}`
      }
    });
    expect(forbiddenRes.status()).toBe(403);
    const forbiddenData = await forbiddenRes.json();
    expect(forbiddenData.success).toBe(false);
    expect(forbiddenData.error).toContain('Access denied');

    // 3. Authenticate as ADMIN
    const adminLogin = await request.post('/api/auth/login', {
      data: {
        identifier: '9876543210',
        password: 'admin123'
      }
    });
    const adminData = await adminLogin.json();
    const adminToken = adminData.token;

    // 4. Access /api/audit-logs as ADMIN -> 200 OK
    const auditRes = await request.get('/api/audit-logs', {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    expect(auditRes.status()).toBe(200);
    const auditData = await auditRes.json();
    expect(auditData.success).toBe(true);
    expect(Array.isArray(auditData.data)).toBe(true);
  });
});
