/**
 * Audit Logger Service
 * Securely logs operational and security events without recording passwords, tokens, or secrets.
 * Persists to MongoDB Atlas (fleet_management.auditlogs) when connected, with seamless in-memory fallback.
 */

import { AuditLog } from './models/AuditLog.js';
import { isDbConnected } from './db.js';

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
  status = 'SUCCESS',
  sessionId = null,
  query = null,
  intent = null,
  operation = null,
  metadata = {}
}) {
  const sanitizedDetails = sanitizePayload(details);
  const effectiveSessionId = sessionId || sanitizedDetails?.sessionId || null;
  const effectiveQuery = query || sanitizedDetails?.query || null;
  const effectiveIntent = intent || sanitizedDetails?.intent || null;
  const effectiveOperation = operation || sanitizedDetails?.operation || null;

  const entry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    action,
    actor,
    role,
    status,
    ip,
    sessionId: effectiveSessionId,
    query: effectiveQuery,
    intent: effectiveIntent,
    operation: effectiveOperation,
    details: sanitizedDetails,
    metadata: sanitizePayload(metadata)
  };

  // Immediate in-memory buffer
  auditLogs.unshift(entry);
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.pop();
  }

  // Safe console log in dev
  console.log(`[AUDIT] [${entry.timestamp}] ${action} by ${actor} (${role}) -> ${status}`);

  // Asynchronous persistent storage in MongoDB Atlas (non-blocking, fail-safe)
  if (isDbConnected()) {
    AuditLog.create({
      id: entry.id,
      action: entry.action,
      actor: entry.actor,
      role: entry.role,
      status: entry.status,
      ip: entry.ip,
      sessionId: entry.sessionId,
      query: entry.query,
      intent: entry.intent,
      operation: entry.operation,
      details: entry.details,
      metadata: entry.metadata,
      timestamp: new Date(entry.timestamp)
    }).catch(err => {
      // Safe fallback: DB write failures must never crash or block requests
      console.warn('[AuditLog]: Asynchronous MongoDB persist warning:', err.message);
    });
  }

  return entry;
}

export async function getAuditLogs({ limit = 50, action, actor, status } = {}) {
  const numLimit = Math.min(Number(limit) || 50, 200);

  // If MongoDB Atlas is connected, fetch persisted audit logs
  if (isDbConnected()) {
    try {
      const filter = {};
      if (action) filter.action = new RegExp(`^${action}$`, 'i');
      if (actor) filter.actor = new RegExp(actor, 'i');
      if (status) filter.status = new RegExp(`^${status}$`, 'i');

      const docs = await AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .limit(numLimit)
        .lean();

      if (Array.isArray(docs) && docs.length > 0) {
        return docs.map(doc => ({
          id: doc.id || doc._id?.toString(),
          timestamp: doc.timestamp?.toISOString ? doc.timestamp.toISOString() : doc.timestamp,
          action: doc.action,
          actor: doc.actor,
          role: doc.role,
          status: doc.status,
          ip: doc.ip,
          sessionId: doc.sessionId,
          query: doc.query,
          intent: doc.intent,
          operation: doc.operation,
          details: doc.details,
          metadata: doc.metadata
        }));
      }
    } catch (err) {
      console.warn('[AuditLog]: MongoDB query warning, falling back to in-memory:', err.message);
    }
  }

  // Fallback: In-memory logs
  let filtered = auditLogs;
  if (action) {
    filtered = filtered.filter(l => l.action.toLowerCase() === action.toLowerCase());
  }
  if (actor) {
    filtered = filtered.filter(l => l.actor.toLowerCase().includes(actor.toLowerCase()));
  }
  if (status) {
    filtered = filtered.filter(l => l.status.toLowerCase() === status.toLowerCase());
  }
  return filtered.slice(0, numLimit);
}
