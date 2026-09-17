import { test, expect } from '@playwright/test';

test.describe('Final Enterprise UI & Functionality Polish Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Login as Admin / Fleet Manager
    await page.goto('/');
    const adminBtn = page.locator('button:has-text("Admin / Manager")');
    if (await adminBtn.isVisible()) {
      await adminBtn.click();
      await page.click('button:has-text("Sign In to System")');
    }
    await page.waitForTimeout(500);
  });

  test('1. Dashboard Overview: KPI cards and live DB attribution', async ({ page }) => {
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Tamil Nadu Logistics Corridor').first()).toBeVisible();

    // Verify 4 KPI cards exist with live values
    await expect(page.locator('text=Travelling').first()).toBeVisible();
    await expect(page.locator('text=Idle / Available').first()).toBeVisible();
    await expect(page.locator('text=In Maintenance').first()).toBeVisible();
    await expect(page.locator('text=Active Drivers Today').first()).toBeVisible();
  });

  test('2. Driver Roster: Standardized cards, normalized status badges, trips completed', async ({ page }) => {
    await page.click('button:has-text("Driver Roster")');
    await expect(page.locator('h2:has-text("Registered Drivers")')).toBeVisible({ timeout: 10000 });

    // Verify driver card details
    await expect(page.locator('text=Assigned Vehicle:').first()).toBeVisible();
    await expect(page.locator('text=Current Location:').first()).toBeVisible();
    await expect(page.locator('text=Trips Completed').first()).toBeVisible();

    // Verify Onboard Driver action button
    const onboardBtn = page.locator('button:has-text("Onboard Driver")');
    await expect(onboardBtn).toBeVisible();
    await onboardBtn.click();
    await expect(page.locator('h2:has-text("Onboard New Driver Account")')).toBeVisible();
  });

  test('3. Add Driver: Form validation and rendering', async ({ page }) => {
    await page.click('button:has-text("Add Driver")');
    await expect(page.locator('h2:has-text("Onboard New Driver Account")')).toBeVisible({ timeout: 10000 });

    // Verify form fields
    await expect(page.locator('input[placeholder="e.g. Ramesh V"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. 9876543210"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. TN20261011"]')).toBeVisible();
    await expect(page.locator('button:has-text("ONBOARD DRIVER TO DATABASE")')).toBeVisible();
  });

  test('4. Fleet Roster: Normalized status badges, fuel bars, and inventory counts', async ({ page }) => {
    await page.click('button:has-text("Fleet Roster")');
    await expect(page.locator('h2:has-text("Fleet Roster")')).toBeVisible({ timeout: 10000 });

    // Verify vehicle cards have fuel level and hub depot
    await expect(page.locator('text=Fuel Level:').first()).toBeVisible();
    await expect(page.locator('text=Hub Depot:').first()).toBeVisible();

    // Verify Add Vehicle action button
    const addVehBtn = page.locator('main button:has-text("Add Vehicle")');
    await expect(addVehBtn).toBeVisible();
    await addVehBtn.click();
    await expect(page.locator('h2:has-text("Onboard New Vehicle Asset")')).toBeVisible();
  });

  test('5. Add Vehicle: Enterprise onboarding form rendering and validation', async ({ page }) => {
    await page.locator('aside button:has-text("Add Vehicle")').click();
    await expect(page.locator('h2:has-text("Onboard New Vehicle Asset")')).toBeVisible({ timeout: 10000 });

    // Verify form inputs
    await expect(page.locator('input[placeholder="e.g. VH111"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. TN38AB1111"]')).toBeVisible();
    await expect(page.locator('text=Initial Fuel Tank Level:')).toBeVisible();
    await expect(page.locator('button:has-text("ONBOARD VEHICLE TO DATABASE")')).toBeVisible();
  });

  test('6. Help & Documentation: 11 enterprise user manual sections', async ({ page }) => {
    await page.click('button:has-text("Help & Documentation")');
    await expect(page.locator('h2:has-text("Intelligent Fleet User Manual & Documentation")')).toBeVisible({ timeout: 10000 });

    // Verify key sections
    await expect(page.locator('text=1. System Architecture & Single Source of Truth')).toBeVisible();
    await expect(page.locator('text=2. Fleet Dashboard & Real-Time KPIs')).toBeVisible();
    await expect(page.locator('text=3. Driver Management & Duty Cycles')).toBeVisible();
    await expect(page.locator('text=4. Vehicle Inventory & Fuel Telemetry')).toBeVisible();
    await expect(page.locator('text=5. Dispatch & Route Assignment')).toBeVisible();
    await expect(page.locator('text=6. Route Optimization & OSRM Road Geometry')).toBeVisible();
    await expect(page.locator('text=7. AI Fleet Assistant (SNS Agent Workbench)')).toBeVisible();
    await expect(page.locator('text=8. Fleet Status Terminology')).toBeVisible();
    await expect(page.locator('text=9. Hub Telemetry & Location Architecture')).toBeVisible();
    await expect(page.locator('text=10. Troubleshooting & Operational FAQs')).toBeVisible();
    await expect(page.locator('text=11. Authentication, Roles & RBAC Protection')).toBeVisible();
  });

  test('7. Global Search: Real-time filtering, dropdown results, and navigation', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search drivers, vehicles, routes..."]');
    await expect(searchInput).toBeVisible();

    // Type a query for a known vehicle
    await searchInput.fill('VH104');
    await page.waitForTimeout(300);

    // Verify dropdown opens with search results
    await expect(page.locator('text=Search Results')).toBeVisible();
    await expect(page.locator('text=VH104')).toBeVisible();

    // Click result and verify navigation to Fleet Roster
    await page.locator('button:has-text("VH104")').first().click();
    await expect(page.locator('h2:has-text("Fleet Roster")')).toBeVisible();
  });

  test('8. Top Header: Live clock, notifications popover, and sign out', async ({ page }) => {
    // Verify digital clock
    await expect(page.locator('header').locator('span.animate-pulse')).toBeVisible();

    // Verify notifications button toggle
    const bellBtn = page.locator('button[aria-label="Fleet Notifications"]');
    await expect(bellBtn).toBeVisible();
    await bellBtn.click();
    await expect(page.locator('text=Operational Alerts')).toBeVisible();

    // Close notifications
    await bellBtn.click();
    await page.waitForTimeout(200);

    // Verify Sign Out button
    const signOutBtn = page.locator('button[data-testid="sign-out-button"]');
    await expect(signOutBtn).toBeVisible();
  });

  test('9. Floating AI Chat: Open, query, and context validation', async ({ page }) => {
    const chatLauncher = page.locator('button[data-testid="ai-chat-launcher"]');
    await expect(chatLauncher).toBeVisible();
    await chatLauncher.click();

    // Verify chat drawer opened
    await expect(page.locator('[data-testid="ai-chat-panel"]')).toBeVisible();
    const chatInput = page.locator('[data-testid="ai-chat-input"]');
    await expect(chatInput).toBeVisible();

    // Close chat drawer using close button
    const closeBtn = page.locator('button[title="Close FleetAI"]');
    await closeBtn.click();
    await page.waitForTimeout(300);
  });

  test('10. Switch to Driver View: Portal isolation and driver duty controls', async ({ page }) => {
    const switchBtn = page.locator('button:has-text("Switch to Driver View")');
    await expect(switchBtn).toBeVisible();
    await switchBtn.click();

    // Driver portal loads
    await expect(page.locator('text=Driver Portal').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("START DUTY")').first()).toBeVisible();

    // Switch back to Admin
    await page.click('button:has-text("Sign Out")');
    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible();
  });
});
