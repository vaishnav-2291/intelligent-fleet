import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Capture all 9 production verification screenshots', async ({ page }) => {
  const artifactDir = path.resolve('C:/Users/vaish/.gemini/antigravity-ide/brain/34afcdcd-65eb-44d8-860e-cb7b438df545/screenshots');
  const rootArtifactDir = path.resolve('C:/Users/vaish/.gemini/antigravity-ide/brain/34afcdcd-65eb-44d8-860e-cb7b438df545');
  const repoDir = path.resolve(__dirname, 'screenshots');

  [artifactDir, repoDir, rootArtifactDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const saveScreenshots = async (filename) => {
    const p1 = path.join(artifactDir, filename);
    const p2 = path.join(repoDir, filename);
    await page.screenshot({ path: p1, fullPage: false });
    fs.copyFileSync(p1, p2);
    if (filename === '09_driver_portal.png') {
      fs.copyFileSync(p1, path.join(rootArtifactDir, 'driver_portal_assigned_route.png'));
    }
    if (filename === '05_dispatch_routing.png') {
      fs.copyFileSync(p1, path.join(rootArtifactDir, 'dispatch_routing_map.png'));
    }
    console.log(`[Captured]: ${filename}`);
  };

  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('[Capture]: Navigating to base URL...');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // 1. Login View
  console.log('Capturing 01_login.png...');
  await page.waitForSelector('h1:has-text("Welcome back")');
  await page.waitForTimeout(500);
  await saveScreenshots('01_login.png');

  // Sign in as Admin
  await page.click('button:has-text("Admin / Manager")');
  await page.click('button:has-text("Sign In to System")');
  await page.waitForSelector('h1:has-text("Dashboard Overview")');
  await page.waitForTimeout(1000);

  // 2. Admin Dashboard - Overview
  console.log('Capturing 02_dashboard.png...');
  await saveScreenshots('02_dashboard.png');

  // 3. Fleet Roster
  console.log('Capturing 03_fleet_roster.png...');
  await page.click('button:has-text("Fleet Roster")');
  await page.waitForSelector('h2:has-text("Fleet Roster")');
  await page.waitForTimeout(800);
  await saveScreenshots('03_fleet_roster.png');

  // 4. Driver Roster
  console.log('Capturing 04_driver_roster.png...');
  await page.click('button:has-text("Driver Roster")');
  await page.waitForSelector('text=Registered Drivers');
  await page.waitForTimeout(800);
  await saveScreenshots('04_driver_roster.png');

  // 5. Dispatch & Routing
  console.log('Capturing 05_dispatch_routing.png...');
  await page.click('button:has-text("Dispatch & Routing")');
  await page.waitForSelector('.leaflet-container');

  // Select DR001 and configure route with intermediate stop
  const driverSelect = page.locator('[data-testid="driver-dispatch-select"]');
  if (await driverSelect.isVisible()) {
    await driverSelect.selectOption('DR001');
  }
  const originSelect = page.locator('[data-testid="origin-select"]');
  if (await originSelect.isVisible()) {
    await originSelect.selectOption('Coimbatore');
  }
  const destSelect = page.locator('[data-testid="destination-select"]');
  if (await destSelect.isVisible()) {
    await destSelect.selectOption('Chennai');
  }
  const stopSelect = page.locator('[data-testid="stop-add-select"]');
  await expect(stopSelect).toBeVisible({ timeout: 10000 });
  await stopSelect.selectOption('Salem');
  await page.click('[data-testid="add-stop-btn"]');
  await expect(page.locator('[data-testid="waypoint-marker"]').first()).toBeVisible({ timeout: 10000 });

  // Click dispatch button to record dispatch
  const dispatchBtn = page.locator('[data-testid="dispatch-button"]');
  if (await dispatchBtn.isVisible()) {
    await dispatchBtn.click();
    await page.waitForTimeout(1000);
  }

  await expect(page.locator('.leaflet-overlay-pane svg path').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="origin-marker"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="destination-marker"]')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(2000);
  await saveScreenshots('05_dispatch_routing.png');

  // 6. Add Vehicle Form
  console.log('Capturing 06_add_vehicle.png...');
  await page.click('button:has-text("Add Vehicle")');
  await page.waitForSelector('h2:has-text("Onboard New Vehicle Asset")');
  await page.waitForTimeout(600);
  await saveScreenshots('06_add_vehicle.png');

  // 7. Add Driver Form
  console.log('Capturing 07_add_driver.png...');
  await page.click('button:has-text("Add Driver")');
  await page.waitForSelector('h2:has-text("Onboard New Driver Account")');
  await page.waitForTimeout(600);
  await saveScreenshots('07_add_driver.png');

  // 8. Help & Documentation
  console.log('Capturing 08_help.png...');
  await page.click('button:has-text("Help & Documentation")');
  await page.waitForSelector('text=Intelligent Fleet User Manual & Documentation');
  await page.waitForTimeout(800);
  await saveScreenshots('08_help.png');

  // 9. Driver Portal - Real Authenticated Driver Session with Assigned Route
  console.log('Capturing 09_driver_portal.png...');
  // Sign out from Admin session
  const adminSignOut = page.locator('button:has-text("Sign Out")');
  if (await adminSignOut.isVisible()) {
    await adminSignOut.click();
  } else {
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/');
  }
  await page.waitForSelector('button:has-text("Fleet Driver")');
  await page.click('button:has-text("Fleet Driver")');
  await page.click('button:has-text("Sign In to System")');
  await page.waitForSelector('text=Driver Portal');

  // If in READY state, click START DUTY NOW to transition to active duty
  const startDutyBtn = page.locator('[data-testid="start-duty-button"]');
  if (await startDutyBtn.isVisible()) {
    await startDutyBtn.click();
  }

  // Wait for the enterprise Driver Route view and Leaflet map road polyline
  await page.waitForSelector('[data-testid="driver-route-view"]', { timeout: 15000 });
  await page.waitForSelector('.leaflet-container', { timeout: 15000 });
  await page.waitForSelector('.leaflet-overlay-pane svg path', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Set viewport height to capture both route card and full Leaflet map
  await page.setViewportSize({ width: 1440, height: 1350 });
  await page.waitForTimeout(1000);

  // Capture clean Driver Portal with assigned route
  await saveScreenshots('09_driver_portal.png');

  console.log('All 9 screenshots captured successfully.');
});
