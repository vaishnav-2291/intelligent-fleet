/**
 * Authentication and Role-Based Authorization Service
 * Implements bcrypt password hashing, JWT token handling, and RBAC middleware.
 * Users are persisted in MongoDB Atlas (fleet_management.users collection).
 * Falls back to in-memory seeded accounts when the database is unavailable.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logAuditEvent } from './auditLogger.js';
import { User } from './models/User.js';
import { isDbConnected, connectDb, SEEDED_SYSTEM_USERS } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fleet-super-secure-jwt-secret-key-2026';
const TOKEN_EXPIRY = '24h';

// ============================================================
// In-Memory Fallback (used only when MongoDB is unavailable)
// ============================================================

/**
 * Find a user from the in-memory seeded list (offline fallback).
 */
function findInMemoryUser(identifier) {
  const cleanId = String(identifier || '').trim().toLowerCase();
  const digitsOnly = cleanId.replace(/\D/g, '');
  return SEEDED_SYSTEM_USERS.find(u =>
    u.email?.toLowerCase() === cleanId ||
    u.phone === cleanId ||
    (digitsOnly && u.phone.replace(/\D/g, '') === digitsOnly) ||
    u.name?.toLowerCase() === cleanId
  ) || null;
}

// ============================================================
// Token Helpers
// ============================================================

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id?.toString(),
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      driverId: user.driverId || null
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ============================================================
// Express Middleware
// ============================================================

/**
 * Require Valid JWT Token Middleware
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Bearer token missing.'
    });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.'
    });
  }

  req.user = decoded;
  next();
}

/**
 * Require Specific Role(s) Middleware
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    const userRole = String(req.user.role || '').toUpperCase();
    const normalizedAllowed = allowedRoles.map(r => String(r).toUpperCase());

    // ADMIN always has full access
    if (userRole === 'ADMIN' || normalizedAllowed.includes(userRole)) {
      return next();
    }

    logAuditEvent({
      action: 'AUTH_FORBIDDEN_ACCESS',
      actor: req.user.phone || req.user.email || req.user.id,
      role: userRole,
      details: { requiredRoles: normalizedAllowed, path: req.originalUrl },
      status: 'BLOCKED'
    });

    return res.status(403).json({
      success: false,
      error: `Access denied. Role "${userRole}" is not authorized for this resource.`
    });
  };
}

// ============================================================
// Auth Controller Handlers
// ============================================================

export async function handleLogin(req, res) {
  const { identifier, phone, email, password } = req.body || {};
  const userIdentifier = identifier || phone || email;

  if (!userIdentifier || !password) {
    return res.status(400).json({
      success: false,
      error: 'Phone/Email identifier and password are required.'
    });
  }

  let user = null;

  // 1. Try MongoDB Atlas first
  if (isDbConnected()) {
    try {
      const cleanId = String(userIdentifier).trim().toLowerCase();
      const digitsOnly = cleanId.replace(/\D/g, '');
      user = await User.findOne({
        $or: [
          { email: cleanId },
          { phone: cleanId },
          ...(digitsOnly ? [{ phone: digitsOnly }] : [])
        ]
      }).lean();
    } catch (err) {
      console.warn('[Auth]: MongoDB lookup failed, falling back to in-memory:', err.message);
    }
  }

  // 2. Fall back to in-memory seeded accounts if DB lookup missed
  if (!user) {
    user = findInMemoryUser(userIdentifier);
  }

  if (!user) {
    logAuditEvent({
      action: 'AUTH_LOGIN_FAILED',
      actor: userIdentifier,
      role: 'UNKNOWN',
      details: { reason: 'User not found' },
      status: 'FAILURE'
    });
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials. User not found.'
    });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    logAuditEvent({
      action: 'AUTH_LOGIN_FAILED',
      actor: user.phone,
      role: user.role,
      details: { reason: 'Incorrect password' },
      status: 'FAILURE'
    });
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials. Incorrect password.'
    });
  }

  const token = generateToken(user);
  logAuditEvent({
    action: 'AUTH_LOGIN_SUCCESS',
    actor: user.phone,
    role: user.role,
    status: 'SUCCESS'
  });

  return res.status(200).json({
    success: true,
    message: `Signed in successfully as ${user.name} (${user.role}).`,
    user: {
      id: user.id || user._id?.toString(),
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      driverId: user.driverId || null
    },
    token
  });
}

export async function handleRegister(req, res) {
  const { name, phone, email, password, role = 'DRIVER', driverId } = req.body || {};

  if (!name || !phone || !password) {
    return res.status(400).json({
      success: false,
      error: 'Name, phone number, and password are required.'
    });
  }

  // Normalize inputs
  const cleanPhone = String(phone).trim();
  const cleanEmail = email
    ? String(email).trim().toLowerCase()
    : null;

  // Require MongoDB for registration — do not allow silent in-memory persistence
  if (!isDbConnected()) {
    await connectDb();
  }
  if (!isDbConnected()) {
    return res.status(503).json({
      success: false,
      error: 'Database is temporarily unavailable. Registration cannot be completed at this time. Please try again shortly.'
    });
  }

  // Check for existing user in MongoDB
  try {
    const orConditions = [{ phone: cleanPhone }];
    if (cleanEmail) orConditions.push({ email: cleanEmail });
    const existing = await User.findOne({ $or: orConditions }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this phone number or email already exists.'
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Registration temporarily unavailable. Please try again.'
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const syntheticId = `usr-${Date.now()}`;

  try {
    const newUser = await User.create({
      id: syntheticId,
      name: name.trim(),
      phone: cleanPhone,
      email: cleanEmail ?? `${cleanPhone.replace(/\D/g, '')}@fleet.local`,
      passwordHash,
      role: String(role).toUpperCase(),
      driverId: driverId || null,
      status: 'active'
    });

    const token = generateToken(newUser);

    logAuditEvent({
      action: 'AUTH_REGISTER_SUCCESS',
      actor: newUser.phone,
      role: newUser.role,
      status: 'SUCCESS'
    });

    return res.status(201).json({
      success: true,
      message: `User ${newUser.name} registered successfully with role ${newUser.role}.`,
      user: {
        id: newUser.id || newUser._id?.toString(),
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email,
        role: newUser.role,
        driverId: newUser.driverId
      },
      token
    });
  } catch (err) {
    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'An account with this phone number or email already exists.'
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
}

export function handleLogout(req, res) {
  const actor = req.user?.phone || req.user?.name || 'user';
  logAuditEvent({
    action: 'AUTH_LOGOUT',
    actor,
    role: req.user?.role || 'VIEWER',
    status: 'SUCCESS'
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
}

export function handleGetMe(req, res) {
  return res.status(200).json({
    success: true,
    user: req.user
  });
}
