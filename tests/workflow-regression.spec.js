import { test, expect } from '@playwright/test';

test.describe('Workflow End-to-End Regression Suite', () => {
  test('Complete Fleet Operations and AI Workflow Regression', async ({ page }) => {
    // 1. App load
    await page.goto('/');
    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible();

    // 2. Authentication flow
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');

    // 3. Dashboard telemetry verification
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Travelling').first()).toBeVisible();
    await expect(page.locator('text=Active Drivers Today').first()).toBeVisible();

    // 4. Dispatch & Routing tab
    await page.click('button:has-text("Dispatch & Routing")');
    await expect(page.locator('text=Dispatch & Corridor Routing')).toBeVisible({ timeout: 10000 });

    // 5. Driver Roster tab
    await page.click('button:has-text("Driver Roster")');
    await expect(page.locator('h2:has-text("Registered Drivers")')).toBeVisible({ timeout: 10000 });

    // 6. Fleet Roster tab
    await page.click('button:has-text("Fleet Roster")');
    await expect(page.locator('h2:has-text("Fleet Roster")')).toBeVisible({ timeout: 10000 });

    // 7. Interactive AI Fleet Chat Assistant
    const launcher = page.locator('[data-testid="ai-chat-launcher"]');
    await expect(launcher).toBeVisible();
    await launcher.click();

    const chatInput = page.locator('[data-testid="ai-chat-input"]');
    await expect(chatInput).toBeVisible();

    // Ask live query
    await chatInput.fill('What is the fuel level of VH104?');
    await page.click('[data-testid="ai-chat-send"]');

    // Verify AI response arrives with live data
    const aiMessage = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]').first();
    await expect(aiMessage).toBeVisible({ timeout: 15000 });
    const replyText = await aiMessage.innerText();
    expect(replyText).toContain('VH104');
    expect(replyText).toContain('45%');

    // Close chat
    await page.click('button[title="Close FleetAI"]');
    await expect(page.locator('[data-testid="ai-chat-panel"]')).not.toBeVisible();

    // 8. Sign Out
    await page.click('button:has-text("Sign Out")');
    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible({ timeout: 5000 });
  });
});
