import { test, expect } from '@playwright/test';

test.describe('AI Fleet Assistant & Anti-Hallucination Tests', () => {
  test('Query "What is the fuel level of VH104?" returns authoritative live data and satisfies Anti-Hallucination rules', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'What is the fuel level of VH104?',
        sessionId: 'anti-hallucination-test-1'
      }
    });
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBeDefined();
    expect(json.message.length).toBeGreaterThan(0);

    // 1. Authoritative live data check (VH104 has 45% fuel in live MongoDB database)
    expect(json.message).toContain('VH104');
    expect(json.message).toContain('45%');

    // 2. Anti-Hallucination checks: Must NOT contain fictional endpoints or domains
    const bannedDomains = [
      'api.fleetmanagement.internal',
      'api.fleet-operations.com',
      'api.example.com'
    ];
    for (const domain of bannedDomains) {
      expect(json.message).not.toContain(domain);
      expect(JSON.stringify(json)).not.toContain(domain);
    }
  });

  test('Query "Show active drivers." uses live Driver Data Tool', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Show active drivers.',
        sessionId: 'test-active-drivers-1'
      }
    });
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.intent).toBe('DRIVER');
    expect(json.message.toLowerCase()).toContain('active driver');
  });

  test('Query "Which vehicles need maintenance?" returns live maintenance status', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Which vehicles need maintenance?',
        sessionId: 'test-maintenance-1'
      }
    });
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.intent).toBe('MAINTENANCE');
    expect(json.message).toBeDefined();
  });

  test('Query "Give me a fleet summary." computes live analysis', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Give me a fleet summary.',
        sessionId: 'test-summary-1'
      }
    });
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.intent).toBe('FLEET_ANALYSIS');
    expect(json.data.totalVehicles).toBeGreaterThanOrEqual(10);
  });
});
