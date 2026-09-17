import { test, expect } from '@playwright/test';

/**
 * Presentation Polish & Forbidden User-Facing Terminology Test Suite
 * 
 * Verifies that the rendered, visible UI across all primary pages contains ZERO occurrences of:
 * - MOCK_DEMO
 * - Demo Location
 * - Demo Data
 * - Demo Simulation
 * - Simulation Only
 * - Optional for Demo
 * - Fake GPS
 * - Simulated Location
 * - Demo Access
 * - Demo Mode
 * - Mock Data
 * - Mock Location
 */

const FORBIDDEN_TERMS = [
  'MOCK_DEMO',
  'Demo Location',
  'Demo Data',
  'Demo Simulation',
  'Simulation Only',
  'Optional for Demo',
  'Fake GPS',
  'Simulated Location',
  'Demo Access',
  'Demo Mode',
  'Mock Data',
  'Mock Location'
];

function assertNoForbiddenTerms(visibleText, pageName) {
  for (const term of FORBIDDEN_TERMS) {
    const regex = new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'i');
    const hasForbidden = regex.test(visibleText);
    if (hasForbidden) {
      console.error(`[Forbidden Term Detected] Found "${term}" in rendered text on ${pageName}:`);
      const matchingLines = visibleText.split('\n').filter((l) => regex.test(l));
      console.error('Matching line(s):', matchingLines);
    }
    expect(
      hasForbidden,
      `Forbidden term "${term}" must NOT appear in visible UI on ${pageName}`
    ).toBe(false);
  }
}

test.describe('Final Frontend Presentation Polish Suite', () => {

  test('1. Login Page has zero forbidden user-facing terms', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=Welcome back');

    const visibleText = await page.locator('body').innerText();
    assertNoForbiddenTerms(visibleText, 'Login Page');
  });

  test('2. Dashboard Overview has zero forbidden user-facing terms', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.waitForSelector('h1:has-text("Dashboard Overview")');

    const visibleText = await page.locator('body').innerText();
    assertNoForbiddenTerms(visibleText, 'Dashboard Overview');
  });

  test('3. Fleet Roster has zero forbidden user-facing terms', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Fleet Roster")');
    await page.waitForSelector('h2:has-text("Fleet Roster")');

    const visibleText = await page.locator('body').innerText();
    assertNoForbiddenTerms(visibleText, 'Fleet Roster');
  });

  test('4. Driver Roster has zero forbidden user-facing terms', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Driver Roster")');
    await page.waitForSelector('h2:has-text("Registered Drivers")');

    const visibleText = await page.locator('body').innerText();
    assertNoForbiddenTerms(visibleText, 'Driver Roster');
  });

  test('5. Dispatch & Routing (including map popup and location panel) has zero forbidden terms', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');
    await page.waitForSelector('h2:has-text("Dispatch & Corridor Routing")');

    // Click first vehicle marker to inspect popup text
    await page.evaluate(() => {
      const el = document.querySelector('[data-vehicle-id]');
      if (el) {
        const marker = el.closest('.leaflet-marker-icon') || el;
        marker.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    });
    await page.waitForSelector('.leaflet-popup-content', { timeout: 8000 });

    const visibleText = await page.locator('body').innerText();
    assertNoForbiddenTerms(visibleText, 'Dispatch & Routing with Popup');
  });

  test('6. Add Vehicle page has zero forbidden user-facing terms', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Add Vehicle")');
    await page.waitForSelector('h2:has-text("Onboard New Vehicle Asset")');

    const visibleText = await page.locator('body').innerText();
    assertNoForbiddenTerms(visibleText, 'Add Vehicle Page');
  });

  test('7. Add Driver page has zero forbidden user-facing terms', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Add Driver")');
    await page.waitForSelector('h2:has-text("Onboard New Driver Account")');

    const visibleText = await page.locator('body').innerText();
    assertNoForbiddenTerms(visibleText, 'Add Driver Page');
  });

  test('8. Help & Documentation has zero forbidden user-facing terms', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Help & Documentation")');
    await page.waitForSelector('text=Intelligent Fleet User Manual');

    const visibleText = await page.locator('body').innerText();
    assertNoForbiddenTerms(visibleText, 'Help & Documentation Page');
  });

  test('9. Driver Portal (including Live Location Control) has zero forbidden user-facing terms', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Fleet Driver")');
    await page.click('button:has-text("Sign In to System")');
    await page.waitForSelector('text=Driver Portal');

    const visibleText = await page.locator('body').innerText();
    assertNoForbiddenTerms(visibleText, 'Driver Portal');
  });

  test('10. Intelligent Fleet Assistant Chat Panel has zero forbidden user-facing terms', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.waitForSelector('h1:has-text("Dashboard Overview")');

    // Open AI Chat Panel
    await page.click('[data-testid="ai-chat-launcher"]');
    await page.waitForSelector('[data-testid="ai-chat-panel"]');

    const chatText = await page.locator('[data-testid="ai-chat-panel"]').innerText();
    assertNoForbiddenTerms(chatText, 'Intelligent Fleet Assistant Panel');
  });

  test('11. Map Driver Marker Popup has zero forbidden user-facing terms', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await page.click('button:has-text("Dispatch & Routing")');
    await page.waitForSelector('h2:has-text("Dispatch & Corridor Routing")');

    // Click first driver marker on map if available
    const driverCount = await page.locator('[data-driver-id]').count();
    if (driverCount > 0) {
      await page.evaluate(() => {
        const el = document.querySelector('[data-driver-id]');
        if (el) {
          const marker = el.closest('.leaflet-marker-icon') || el;
          marker.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      });
      await page.waitForSelector('.leaflet-popup-content', { timeout: 8000 });
      const popupText = await page.locator('.leaflet-popup-content').innerText();
      assertNoForbiddenTerms(popupText, 'Map Driver Popup');
    }
  });

});
