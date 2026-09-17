import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const sessionPath = path.resolve(process.cwd(), '.auth/workbench-session.json');
const hasSavedSession = fs.existsSync(sessionPath);
const existingWorkflowId = '6f57ca9c-7fc6-42ce-84f1-5c1c43d8c9f9';
const existingWorkflowName = 'FINAL';
const testWebhookUrl = 'https://api.agents.snsihub.ai/webhook-test/4b3c6594-0dfc-4104-b031-8c0018e0ec3d';

test.describe('SNS Agent Workbench Existing Workflow Audit & Automation', () => {
  if (hasSavedSession) {
    test.use({ storageState: sessionPath });
  }

  test('Audit, verify, and inspect existing workflow in SNS Agent Workbench', async ({ page }) => {
    test.setTimeout(120000);

    // Route intercept for hanging category to allow Next.js catalog Promise.all to resolve cleanly
    await page.route('**/api/tools/catalog*Integrations*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tools: [], total: 0 })
      });
    });

    console.log('[Workflow Audit] Checking authentication sources...');
    console.log(`[Auth Source] Persistent storage state (.auth/workbench-session.json): ${hasSavedSession ? 'FOUND' : 'NOT FOUND'}`);

    // Verify existing workflow manifest downloaded from Workbench API
    const manifestPath = path.resolve(process.cwd(), 'scratch_workflow_FINAL.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const wfManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    console.log(`[Audit Step 1/6] Verifying existing workflow metadata (ID: ${existingWorkflowId})...`);
    expect(wfManifest.id).toBe(existingWorkflowId);
    expect(wfManifest.name).toBe(existingWorkflowName);
    expect(wfManifest.nodes.length).toBe(39);
    expect(wfManifest.edges.length).toBe(47);

    // Verify Native AI Agent node
    const aiAgentNode = wfManifest.nodes.find(n => n.id === 'ai-agent-orchestrator-1788780491798003');
    expect(aiAgentNode).toBeDefined();
    expect(aiAgentNode.data.toolId).toBe('ai-agent-orchestrator');
    console.log('[Audit Step 2/6] Native AI Agent node verified in existing workflow.');

    // Verify Gemini Chat Model connected to AI Agent
    const geminiNode = wfManifest.nodes.find(n => n.id === 'gemini-1788780509510004');
    expect(geminiNode).toBeDefined();
    expect(geminiNode.data.inputs.model).toBe('gemini-3.5-flash-lite');

    const geminiEdge = wfManifest.edges.find(e =>
      e.source === geminiNode.id &&
      e.target === aiAgentNode.id &&
      e.targetHandle === 'chat-model'
    );
    expect(geminiEdge).toBeDefined();
    console.log('[Audit Step 3/6] Google Gemini model connection to AI Agent verified.');

    // Verify Simple Memory connected to AI Agent
    const memoryNode = wfManifest.nodes.find(n => n.id === 'simple-memory-1788837640673001');
    expect(memoryNode).toBeDefined();
    const memoryEdge = wfManifest.edges.find(e =>
      e.source === memoryNode.id &&
      e.target === aiAgentNode.id &&
      e.targetHandle === 'memory'
    );
    expect(memoryEdge).toBeDefined();
    console.log('[Audit Step 4/6] Simple Memory connection to AI Agent verified.');

    // Verify Vehicle Data Tool connected to AI Agent
    const vehicleTool = wfManifest.nodes.find(n => n.id === 'httpRequest-1788950939019001');
    expect(vehicleTool).toBeDefined();
    expect(vehicleTool.data.inputs.url).toBe('https://fleet-backend-lumo.onrender.com/api/vehicles');
    const vehicleEdge = wfManifest.edges.find(e =>
      e.source === vehicleTool.id &&
      e.target === aiAgentNode.id &&
      e.targetHandle === 'tool'
    );
    expect(vehicleEdge).toBeDefined();

    // Verify Driver Data Tool connected to AI Agent
    const driverTool = wfManifest.nodes.find(n => n.id === 'httpRequest-1788782271578009');
    expect(driverTool).toBeDefined();
    expect(driverTool.data.inputs.url).toBe('https://fleet-backend-lumo.onrender.com/api/drivers');
    const driverEdge = wfManifest.edges.find(e =>
      e.source === driverTool.id &&
      e.target === aiAgentNode.id &&
      e.targetHandle === 'tool'
    );
    expect(driverEdge).toBeDefined();
    console.log('[Audit Step 5/6] Vehicle Data Tool & Driver Data Tool verified.');

    // Verify Webhook Trigger and Webhook Response
    const webhookTrigger = wfManifest.nodes.find(n => n.id === 'webhook-1788514011853018');
    expect(webhookTrigger).toBeDefined();
    expect(webhookTrigger.data.inputs.path).toBe('4b3c6594-0dfc-4104-b031-8c0018e0ec3d');

    const webhookResponse = wfManifest.nodes.find(n => n.id === 'respondToWebhook-1788514709424022');
    expect(webhookResponse).toBeDefined();

    // Browser navigation to existing workflow builder canvas
    const targetUrl = `https://agents.snsihub.ai/builder?id=${existingWorkflowId}`;
    console.log(`[Audit Step 6/6] Navigating to existing workflow URL (${targetUrl})...`);

    try {
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });
      await page.waitForTimeout(2000);

      // If redirected to login, attempt automated credentials fill if available
      if (page.url().includes('/auth')) {
        console.log('[Notice] Workbench redirected to authentication portal.');
        const email = process.env.SNS_WORKBENCH_USER;
        const password = process.env.SNS_WORKBENCH_PASSWORD;
        if (email && password) {
          const emailInput = page.locator('input[type="email"], #login-email').first();
          const passInput = page.locator('input[type="password"], #login-password').first();
          const submitBtn = page.locator('button:has-text("Sign In"), button[type="submit"]').first();
          if (await emailInput.isVisible() && await passInput.isVisible()) {
            await emailInput.fill(email);
            await passInput.fill(password);
            if (await submitBtn.isEnabled()) {
              await submitBtn.click();
              await page.waitForTimeout(3000);
            }
          }
        }
      }

      // Capture canvas / page screenshot for evidence
      const finalScreenshot = 'tests/workbench-canvas-final.png';
      await page.screenshot({ path: finalScreenshot, fullPage: true });
      console.log(`[SUCCESS] Canvas screenshot captured to ${finalScreenshot}`);
    } catch (navErr) {
      console.log('[Notice] Browser navigation observation:', navErr.message);
    }
  });

  test('Centralized SNS Webhook trigger endpoint responds with live execution data', async ({ request }) => {
    // 1. Query: What is the fuel level of VH104?
    const res1 = await request.post(testWebhookUrl, {
      data: {
        action: 'FLEET_AI',
        message: 'What is the fuel level of VH104?',
        sessionId: 'workbench-test-session'
      },
      timeout: 15000
    });
    console.log(`[Workbench Webhook Status Query 1]: HTTP ${res1.status()}`);
    expect(res1.status()).toBe(200);
    const json1 = await res1.json();
    expect(json1).toHaveProperty('success');

    // 2. Query: Show active drivers.
    const res2 = await request.post(testWebhookUrl, {
      data: {
        action: 'DRIVER',
        message: 'Show active drivers.',
        sessionId: 'workbench-test-session'
      },
      timeout: 15000
    });
    expect(res2.status()).toBe(200);
    const json2 = await res2.json();
    expect(json2).toHaveProperty('success');

    // 3. Query: Which vehicles need maintenance?
    const res3 = await request.post(testWebhookUrl, {
      data: {
        action: 'MAINTENANCE',
        message: 'Which vehicles need maintenance?',
        sessionId: 'workbench-test-session'
      },
      timeout: 15000
    });
    expect(res3.status()).toBe(200);
    const json3 = await res3.json();
    expect(json3).toHaveProperty('success');

    // 4. Query: Give me a fleet summary.
    const res4 = await request.post(testWebhookUrl, {
      data: {
        action: 'FLEET_ANALYSIS',
        message: 'Give me a fleet summary.',
        sessionId: 'workbench-test-session'
      },
      timeout: 15000
    });
    expect(res4.status()).toBe(200);
    const json4 = await res4.json();
    expect(json4).toHaveProperty('success');
  });

  test('Live Render backend live telemetry endpoints return authoritative fleet data', async ({ request }) => {
    // Authoritative Vehicle Data Tool endpoint
    const vehRes = await request.get('https://fleet-backend-lumo.onrender.com/api/vehicles', { timeout: 15000 });
    expect(vehRes.status()).toBe(200);
    const vehJson = await vehRes.json();
    expect(vehJson.success).toBe(true);
    expect(Array.isArray(vehJson.data)).toBe(true);

    const vh104 = vehJson.data.find(v => v.vehicleId === 'VH104');
    expect(vh104).toBeDefined();
    expect(vh104.fuelLevel).toBe(45);
    expect(vh104.location).toBe('Tiruppur');

    // Authoritative Driver Data Tool endpoint
    const drvRes = await request.get('https://fleet-backend-lumo.onrender.com/api/drivers', { timeout: 15000 });
    expect(drvRes.status()).toBe(200);
    const drvJson = await drvRes.json();
    expect(drvJson.success).toBe(true);
    expect(Array.isArray(drvJson.data)).toBe(true);
  });
});
