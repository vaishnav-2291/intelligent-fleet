import { test, expect } from '@playwright/test';

test.describe('Required Real Tests - 5 Critical Scenarios', () => {
  const sessionId = `test-session-${Date.now()}`;

  test('Test 1: "What is the fuel level of VH104?" verifies live Vehicle Data Tool', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'What is the fuel level of VH104?',
        sessionId
      }
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toContain('VH104');
    expect(json.message).toContain('45%');
    console.log('[Test 1 Success]:', json.message);
  });

  test('Test 2: "Show active drivers." verifies live Driver Data Tool', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Show active drivers.',
        sessionId
      }
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message.toLowerCase()).toContain('active driver');
    console.log('[Test 2 Success]:', json.message);
  });

  test('Test 3: "Which vehicles need maintenance?" verifies maintenance data path', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Which vehicles need maintenance?',
        sessionId
      }
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message.toLowerCase()).toContain('maintenance');
    console.log('[Test 3 Success]:', json.message);
  });

  test('Test 4: "Give me a fleet summary." verifies analytics / fleet analysis path', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        message: 'Give me a fleet summary.',
        sessionId
      }
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message.toLowerCase()).toContain('fleet');
    console.log('[Test 4 Success]:', json.message);
  });

  test('Test 5: Multi-turn contextual follow-up sequence', async ({ request }) => {
    const multiSessionId = `multi-turn-${Date.now()}`;

    // Turn 1
    const res1 = await request.post('/api/ai/chat', {
      data: {
        message: 'What is the fuel level of VH104?',
        sessionId: multiSessionId
      }
    });
    const json1 = await res1.json();
    expect(json1.message).toContain('45%');
    console.log('[Turn 1]:', json1.message);

    // Turn 2
    const res2 = await request.post('/api/ai/chat', {
      data: {
        message: 'Is that low?',
        sessionId: multiSessionId
      }
    });
    const json2 = await res2.json();
    expect(json2.message.toLowerCase()).toContain('low');
    console.log('[Turn 2]:', json2.message);

    // Turn 3
    const res3 = await request.post('/api/ai/chat', {
      data: {
        message: 'Where is that vehicle?',
        sessionId: multiSessionId
      }
    });
    const json3 = await res3.json();
    expect(json3.message).toContain('Tiruppur');
    console.log('[Turn 3]:', json3.message);
  });
});
