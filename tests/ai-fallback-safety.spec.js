import { test, expect } from '@playwright/test';
import { 
  FLEET_AI_UNAVAILABLE_MESSAGE, 
  isStrictFleetText, 
  isStrictFleetResponse 
} from '../src/services/snsApi.js';

test.describe('SNS AI Fallback Safety & Strict Fleet Boundary Tests', () => {

  // =========================================================================
  // SCENARIO 1: Gateway Healthy - POST /api/ai/chat returns valid fleet data
  // =========================================================================
  test('Scenario 1: Local Gateway POST /api/ai/chat returns authoritative fleet telemetry', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'What is the current fleet health?',
        sessionId: 'test-gateway-healthy-1'
      }
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBeDefined();
    expect(json.message.length).toBeGreaterThan(10);
    expect(isStrictFleetText(json.message)).toBe(true);
    expect(isStrictFleetResponse(json, json.message)).toBe(true);
  });

  // =========================================================================
  // SCENARIO 2: Gateway Unavailable - UI displays safe message, ZERO webhook calls
  // =========================================================================
  test('Scenario 2: Gateway unavailable in UI displays safe unavailable message and NEVER calls external SNS webhook', async ({ page }) => {
    let externalWebhookCalled = false;
    let interceptedWebhookUrl = '';

    // Monitor for any outgoing requests to the SNS webhook host
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('agents.snsihub.ai') || url.includes('/webhook/')) {
        externalWebhookCalled = true;
        interceptedWebhookUrl = url;
        await route.abort();
        return;
      }

      // Simulate Gateway 503 Service Unavailable for /api/ai/chat
      if (url.includes('/api/ai/chat')) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Gateway Offline' })
        });
        return;
      }

      await route.continue();
    });

    // 1. Sign in as Admin
    await page.goto('/');
    await page.click('button:has-text("Admin / Manager")');
    await page.click('button:has-text("Sign In to System")');
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible({ timeout: 10000 });

    // 2. Open AI Chat
    await page.click('[data-testid="ai-chat-launcher"]');
    const input = page.locator('[data-testid="ai-chat-input"]');
    await expect(input).toBeVisible();

    // 3. Send query while gateway is simulated offline
    await input.fill('What is the current fleet health?');
    await page.click('[data-testid="ai-chat-send"]');

    // 4. Verify the safe service-unavailable message appears in chat
    const aiMessage = page.locator('[data-testid="ai-chat-message"][data-sender="ai"]');
    await expect(aiMessage.first()).toBeVisible({ timeout: 10000 });
    const replyText = await aiMessage.first().innerText();

    expect(replyText).toContain(FLEET_AI_UNAVAILABLE_MESSAGE);
    expect(replyText).not.toContain('503');
    expect(replyText).not.toContain('http');
    expect(replyText).not.toContain('snsihub');
    expect(replyText).not.toContain('webhook');
    expect(replyText).not.toContain('stack');

    // 5. CRITICAL PROOF: No request was made to external webhook!
    expect(externalWebhookCalled).toBe(false);
    expect(interceptedWebhookUrl).toBe('');
  });

  // =========================================================================
  // SCENARIO 3: Strict schema rejects unrelated industrial / factory responses
  // =========================================================================
  test('Scenario 3: Strict fleet response validator rejects industrial / manufacturing drift', () => {
    // Factory and manufacturing responses that must be rejected
    const factoryResponses = [
      'Assembly line 4 has completed milling and CNC workstation 2 is idle.',
      'Shop floor PLC controller report: stamping machine temperature is 85C.',
      'Bill of materials (BOM) updated for injection molding production line.',
      'OEE efficiency rating is 78% on furnace unit 3.',
      'Die casting workstation report: takt time is 45 seconds.',
      'Raw materials inventory update for extrusion line B.'
    ];

    for (const msg of factoryResponses) {
      expect(isStrictFleetText(msg)).toBe(false);
      expect(isStrictFleetResponse({ success: true, message: msg }, msg)).toBe(false);
    }

    // Leaked internal URLs and stack traces that must be rejected
    const leakResponses = [
      'Error contacting https://api.agents.snsihub.ai/webhook/test',
      'TypeError: failed to fetch at localhost:5000/api',
      'Failed connecting to mongodb+srv://cluster.internal',
      'api.fleetmanagement.internal host not reachable'
    ];

    for (const msg of leakResponses) {
      expect(isStrictFleetText(msg)).toBe(false);
      expect(isStrictFleetResponse({ success: false, error: msg }, msg)).toBe(false);
    }

    // Legitimate fleet responses that must pass
    const validFleetResponses = [
      'Fleet health is currently nominal. 10 vehicles active across corridors.',
      'Vehicle VH104 has 45% fuel remaining at Tiruppur hub.',
      'Driver DR101 (Arun Kumar) is active on trip TR101 from Coimbatore to Salem.',
      'Vehicle VH102 has scheduled brake maintenance due at Salem depot.',
      'No critical safety alerts detected. All fleet vehicles within speed limits.'
    ];

    for (const msg of validFleetResponses) {
      expect(isStrictFleetText(msg)).toBe(true);
      expect(isStrictFleetResponse({ success: true, message: msg }, msg)).toBe(true);
    }
  });

  // =========================================================================
  // SCENARIO 4: Core fleet queries continue working authoritatively
  // =========================================================================
  test('Scenario 4: All 10 authoritative fleet queries return valid live fleet telemetry', async ({ request }) => {
    test.setTimeout(90000);
    const testQueries = [
      { q: 'What is the current fleet health?', intent: 'FLEET_HEALTH' },
      { q: 'How many vehicles are active?', intent: 'VEHICLE' },
      { q: 'Which drivers are active?', intent: 'DRIVER' },
      { q: 'What trips are ongoing?', intent: 'TRIP' },
      { q: 'Which vehicles need maintenance?', intent: 'MAINTENANCE' },
      { q: 'Show fuel anomalies.', intent: 'FUEL' },
      { q: 'Are there open safety alerts?', intent: 'SAFETY' },
      { q: 'Where is VH001?', intent: 'LOCATION' },
      { q: 'What is the status of DR001?', intent: 'DRIVER_STATUS' },
      { q: 'What is TR001 status?', intent: 'TRIP_STATUS' }
    ];

    for (const item of testQueries) {
      const res = await request.post('/api/ai/chat', {
        data: {
          message: item.q,
          sessionId: `core-query-${item.intent.toLowerCase()}`
        }
      });

      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBeDefined();
      expect(json.message.length).toBeGreaterThan(0);
      expect(isStrictFleetText(json.message)).toBe(true);

      // Verify no industrial/factory terms leaked
      expect(json.message.toLowerCase()).not.toContain('assembly line');
      expect(json.message.toLowerCase()).not.toContain('shop floor');
      expect(json.message.toLowerCase()).not.toContain('cnc');
      expect(json.message.toLowerCase()).not.toContain('injection molding');
    }
  });

});
