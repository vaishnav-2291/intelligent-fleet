import mongoose from 'mongoose';

/**
 * AuditLog Model
 * Persists user and operational audit events into MongoDB Atlas (fleet_management.auditlogs collection).
 * Excludes sensitive secrets, passwords, or tokens.
 */
const auditLogSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    actor: {
      type: String,
      required: true,
      index: true
    },
    role: {
      type: String,
      default: 'VIEWER'
    },
    status: {
      type: String,
      default: 'SUCCESS',
      index: true
    },
    ip: {
      type: String,
      default: '127.0.0.1'
    },
    sessionId: {
      type: String,
      default: null,
      index: true
    },
    query: {
      type: String,
      default: null
    },
    intent: {
      type: String,
      default: null
    },
    operation: {
      type: String,
      default: null
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for rapid administrative audit reporting
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ actor: 1, timestamp: -1 });
auditLogSchema.index({ status: 1, timestamp: -1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
