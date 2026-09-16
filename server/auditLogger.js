/**
 * Audit Logger Service
 * Securely logs operational and security events without recording passwords, tokens, or secrets.
 */

const MAX_AUDIT_LOGS = 1000;
const auditLogs = [];

// Sensitive field sanitization
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'jwt',
  'secret',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'bearer'
]);

function sanitizePayload(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizePayload(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function logAuditEvent({
  action,
  actor = 'anonymous',
  role = 'VIEWER',
  details = {},
  ip = '127.0.0.1',
  status = 'SUCCESS'
}) {
  const entry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    action,
    actor,
    role,
    status,
    ip,
    details: sanitizePayload(details)
  };

  auditLogs.unshift(entry);
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.pop();
  }

  // Safe console log in dev
  console.log(`[AUDIT] [${entry.timestamp}] ${action} by ${actor} (${role}) -> ${status}`);
  return entry;
}

export function getAuditLogs({ limit = 50, action, actor } = {}) {
  let filtered = auditLogs;
  if (action) {
    filtered = filtered.filter(l => l.action.toLowerCase() === action.toLowerCase());
  }
  if (actor) {
    filtered = filtered.filter(l => l.actor.toLowerCase().includes(actor.toLowerCase()));
  }
  return filtered.slice(0, Math.min(Number(limit) || 50, 200));
}
