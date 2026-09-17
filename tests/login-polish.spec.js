import { test, expect } from '@playwright/test';

test.describe('Login Enterprise UI & Functionality Polish Suite', () => {

  test('1. Fresh landing on login does not show stale signed-out toast', async ({ page }) => {
    await page.goto('/');

    // Ensure on login page
    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible({ timeout: 10000 });

    // Toast should NOT be present on fresh page load
    const signedOutToast = page.locator('text=Signed out successfully.');
    await expect(signedOutToast).not.toBeVisible();

    // Verify Enterprise Branding
    await expect(page.locator('text=INTELLIGENT FLEET').first()).toBeVisible();
    await expect(page.locator('text=Enterprise Portal')).toBeVisible();
    await expect(page.locator('text=INTELLIGENT FLEET NETWORK').first()).toBeVisible();
  });

  test('2. Quick Demo Roles: Selection highlighting and credential population without auto-submit', async ({ page }) => {
    await page.goto('/');

    const adminBtn = page.locator('button:has-text("Admin / Manager")');
    const driverBtn = page.locator('button:has-text("Fleet Driver")');
    const phoneInput = page.locator('#phone-input');
    const passwordInput = page.locator('#password-input');

    // Click Admin / Manager
    await adminBtn.click();
    await expect(phoneInput).toHaveValue('9876543210');
    await expect(passwordInput).toHaveValue('admin123');
    // Still on login page (no auto-submit)
    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible();

    // Click Fleet Driver
    await driverBtn.click();
    await expect(phoneInput).toHaveValue('9123456789');
    await expect(passwordInput).toHaveValue('driver123');
    // Still on login page
    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible();
  });

  test('3. Password show/hide toggle works with accessible aria-labels', async ({ page }) => {
    await page.goto('/');

    const passwordInput = page.locator('#password-input');
    const toggleBtn = page.locator('button[aria-label*="password"]');

    // Default: password type and Show password aria-label
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(toggleBtn).toHaveAttribute('aria-label', 'Show password');

    // Toggle to visible
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(toggleBtn).toHaveAttribute('aria-label', 'Hide password');

    // Toggle back to masked
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(toggleBtn).toHaveAttribute('aria-label', 'Show password');
  });

  test('4. Empty and invalid inputs produce actionable error alerts', async ({ page }) => {
    await page.goto('/');

    const phoneInput = page.locator('#phone-input');
    const passwordInput = page.locator('#password-input');
    const submitBtn = page.locator('button:has-text("Sign In to System")');

    // Clear inputs
    await phoneInput.fill('');
    await passwordInput.fill('');

    // Submit button is disabled when fields are empty
    await expect(submitBtn).toBeDisabled();

    // Fill invalid credentials
    await phoneInput.fill('0000000000');
    await passwordInput.fill('wrongpassword');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Actionable error alert rendered
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
    const errText = await errorAlert.innerText();
    expect(errText).toContain('Invalid credentials');
  });

  test('5. Logout lifecycle: toast appears on explicit sign out and vanishes on reload', async ({ page }) => {
    await page.goto('/');

    // 1. Log in as Admin
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });

    // 2. Explicit Sign Out
    const signOutBtn = page.locator('button[data-testid="sign-out-button"]');
    await signOutBtn.click();

    // 3. User redirected to login and toast appears
    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible({ timeout: 10000 });
    const toast = page.locator('text=Signed out successfully.');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // 4. Reload page - toast should NOT persist
    await page.reload();
    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Signed out successfully.')).not.toBeVisible();
  });

  test('6. Left hero panel renders features and title hierarchy', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('text=ENTERPRISE FLEET OPERATIONS').first()).toBeVisible();
    await expect(page.locator('h1:has-text("INTELLIGENT FLEET NETWORK")')).toBeVisible();
    await expect(page.locator('text=AI-assisted fleet operations')).toBeVisible();
    await expect(page.locator('text=Fleet Operations').first()).toBeVisible();
    await expect(page.locator('text=Route Optimization').first()).toBeVisible();
    await expect(page.locator('text=AI Fleet Assistant').first()).toBeVisible();
  });
});
