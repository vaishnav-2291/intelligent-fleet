import { test, expect } from '@playwright/test';

test.describe('Security & DevSecOps Test Suite', () => {
  test('Backend responses include essential security headers', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);

    const headers = res.headers();

    // Verify security headers
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['referrer-policy']).toBeDefined();
  });

  test('Input validation rejects empty or malformed queries to AI Assistant', async ({ request }) => {
    // 1. Missing message
    const emptyRes = await request.post('/api/ai/chat', {
      data: { message: '' }
    });
    expect(emptyRes.status()).toBe(400);
    const emptyJson = await emptyRes.json();
    expect(emptyJson.success).toBe(false);

    // 2. Whitespace-only message
    const wsRes = await request.post('/api/ai/chat', {
      data: { message: '    ' }
    });
    expect(wsRes.status()).toBe(400);
  });

  test('Sensitive credential leakage check across auth and user endpoints', async ({ request }) => {
    // 1. Login
    const loginRes = await request.post('/api/auth/login', {
      data: {
        identifier: '9876543210',
        password: 'admin123'
      }
    });
    expect(loginRes.status()).toBe(200);
    const text = await loginRes.text();

    // Must never leak passwordHash or salt
    expect(text).not.toContain('passwordHash');
    expect(text).not.toContain('admin123');
    expect(text).not.toContain('bcrypt');

    // 2. Health check must not leak database secrets or passwords
    const healthRes = await request.get('/api/health');
    const healthText = await healthRes.text();
    expect(healthText).not.toContain('mongodb+srv://');
    expect(healthText).not.toContain('password');
    expect(healthText).not.toContain('secret');
  });

  test('Fictional backend endpoints are strictly banned and never returned', async ({ request }) => {
    const queries = [
      'What is the fuel level of VH104?',
      'Where is VH101?',
      'Show all active vehicles.',
      'Analyze fleet performance.'
    ];

    const bannedDomains = [
      'api.fleetmanagement.internal',
      'api.fleet-operations.com',
      'api.example.com'
    ];

    for (const query of queries) {
      const res = await request.post('/api/ai/chat', {
        data: { message: query, sessionId: 'sec-anti-hallucination' }
      });
      expect(res.status()).toBe(200);
      const json = await res.json();
      const payloadStr = JSON.stringify(json);

      for (const banned of bannedDomains) {
        expect(payloadStr).not.toContain(banned);
      }
    }
  });

  test('Audit logging protects sensitive data and tracks administrative operations', async ({ request }) => {
    // 1. Log in as ADMIN
    const loginRes = await request.post('/api/auth/login', {
      data: {
        identifier: '9876543210',
        password: 'admin123'
      }
    });
    const { token } = await loginRes.json();

    // 2. Query audit logs
    const auditRes = await request.get('/api/audit-logs', {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(auditRes.status()).toBe(200);
    const auditJson = await auditRes.json();
    expect(auditJson.success).toBe(true);
    expect(Array.isArray(auditJson.data)).toBe(true);

    // Verify sanitized payload: No password logged
    const logStr = JSON.stringify(auditJson.data);
    expect(logStr).not.toContain('"password":"admin123"');
  });
});
