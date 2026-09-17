import { test, expect } from '@playwright/test';

test.describe('AI Fleet Chat Box Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and sign in to access dashboard
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });
  });

  test('Floating AI launcher opens the Chat Box panel', async ({ page }) => {
    const launcher = page.locator('[data-testid="ai-chat-launcher"]');
    await expect(launcher).toBeVisible();

    await launcher.click();
    const chatPanel = page.locator('[data-testid="ai-chat-panel"]');
    await expect(chatPanel).toBeVisible();
    await expect(page.locator('text=FleetAI').first()).toBeVisible();
    await expect(page.locator('[data-testid="ai-chat-input"]')).toBeVisible();
  });

  test('User can query "What is the fuel level of VH104?" and receive live data answer in Chat Box', async ({ page }) => {
    // Open chat
    await page.click('[data-testid="ai-chat-launcher"]');
    const input = page.locator('[data-testid="ai-chat-input"]');
    await expect(input).toBeVisible();

    // Type live vehicle fuel query
    await input.fill('What is the fuel level of VH104?');
    await page.click('[data-testid="ai-chat-send"]');

    // Loading indicator appears
    const loading = page.locator('[data-testid="ai-chat-loading"]');
    // AI Response appears
    const aiMessage = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]');
    await expect(aiMessage.first()).toBeVisible({ timeout: 15000 });

    const replyText = await aiMessage.first().innerText();
    // Live database value for VH104 is 45%
    expect(replyText).toContain('VH104');
    expect(replyText).toContain('45%');

    // Anti-hallucination check: No fictional endpoints
    expect(replyText).not.toContain('api.fleetmanagement.internal');
    expect(replyText).not.toContain('api.fleet-operations.com');
    expect(replyText).not.toContain('api.example.com');
  });

  test('Multi-turn conversation supports contextual follow-up questions', async ({ page }) => {
    await page.click('[data-testid="ai-chat-launcher"]');
    const input = page.locator('[data-testid="ai-chat-input"]');

    // Turn 1: Initial query
    await input.fill('What is the fuel level of VH104?');
    await input.press('Enter');

    const firstReply = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]').first();
    await expect(firstReply).toBeVisible({ timeout: 15000 });
    expect(await firstReply.innerText()).toContain('45%');

    // Turn 2: Contextual follow-up "Is that low?"
    await input.fill('Is that low?');
    await input.press('Enter');

    const secondReply = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]').nth(1);
    await expect(secondReply).toBeVisible({ timeout: 15000 });
    const reply2Text = await secondReply.innerText();
    expect(reply2Text.toLowerCase()).toContain('low');

    // Turn 3: Contextual follow-up "Where is that vehicle?"
    await input.fill('Where is that vehicle?');
    await input.press('Enter');

    const thirdReply = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]').nth(2);
    await expect(thirdReply).toBeVisible({ timeout: 15000 });
    const reply3Text = await thirdReply.innerText();
    // VH104 location is Tiruppur
    expect(reply3Text).toContain('Tiruppur');
  });

  test('Chat Box answers fleet maintenance and driver operational queries', async ({ page }) => {
    await page.click('[data-testid="ai-chat-launcher"]');
    const input = page.locator('[data-testid="ai-chat-input"]');

    // Driver query
    await input.fill('Show all active drivers.');
    await page.click('[data-testid="ai-chat-send"]');

    const driverReply = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]').first();
    await expect(driverReply).toBeVisible({ timeout: 15000 });
    const driverText = await driverReply.innerText();
    expect(driverText.toLowerCase()).toContain('active driver');

    // Maintenance query
    await input.fill('Which vehicles need maintenance?');
    await page.click('[data-testid="ai-chat-send"]');

    const maintReply = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]').nth(1);
    await expect(maintReply).toBeVisible({ timeout: 15000 });
    const maintText = await maintReply.innerText();
    expect(maintText.toLowerCase()).toContain('maintenance');
  });

  test('Direct API endpoint POST /api/ai/chat supports structured responses and session isolation', async ({ request }) => {
    // Session 1: VH104
    const s1Res = await request.post('/api/ai/chat', {
      data: {
        message: 'What is the fuel level of VH104?',
        sessionId: 'session-alpha-test'
      }
    });
    expect(s1Res.status()).toBe(200);
    const s1Data = await s1Res.json();
    expect(s1Data.success).toBe(true);
    expect(s1Data.intent).toBe('FUEL');
    expect(s1Data.message).toContain('45%');

    // Session 1 Follow-up
    const s1FollowUp = await request.post('/api/ai/chat', {
      data: {
        message: 'Where is that vehicle?',
        sessionId: 'session-alpha-test'
      }
    });
    const s1FollowUpData = await s1FollowUp.json();
    expect(s1FollowUpData.message).toContain('Tiruppur');

    // Session 2: Different context
    const s2Res = await request.post('/api/ai/chat', {
      data: {
        message: 'Give me a fleet summary.',
        sessionId: 'session-beta-test'
      }
    });
    const s2Data = await s2Res.json();
    expect(s2Data.success).toBe(true);
    expect(s2Data.intent).toBe('FLEET_ANALYSIS');
    expect(s2Data.data.totalVehicles).toBeGreaterThan(0);
  });

  test('Query "What is the current fleet health?" returns live fleet health and analysis', async ({ page }) => {
    await page.click('[data-testid="ai-chat-launcher"]');
    const input = page.locator('[data-testid="ai-chat-input"]');

    await input.fill('What is the current fleet health?');
    await page.click('[data-testid="ai-chat-send"]');

    const aiMessage = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]');
    await expect(aiMessage.first()).toBeVisible({ timeout: 15000 });
    const replyText = await aiMessage.first().innerText();

    expect(replyText).toContain('Fleet Performance Summary');
    expect(replyText).toContain('total vehicles');
    expect(replyText).toContain('drivers active');
    expect(replyText).not.toContain('connectivity issues');
  });
});

