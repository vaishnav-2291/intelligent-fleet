/**
 * Intelligent Fleet Management - Unified Backend & Gateway Service
 * Express server providing Auth, RBAC, Security Headers, Audit Logging,
 * AI Fleet Assistant Engine, and live integration with Render MongoDB backend.
 */

// Load .env file before any other imports that rely on process.env
try { process.loadEnvFile(); } catch { /* .env may not exist in production, that's fine */ }

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  handleLogin,
  handleRegister,
  handleLogout,
  handleGetMe,
  requireAuth,
  requireRoles,
  verifyToken
} from './auth.js';

import { getAuditLogs, logAuditEvent } from './auditLogger.js';
import { processFleetAIQuery } from './fleetAI.js';
import { connectDb, isDbConnected } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const UPSTREAM_URL = process.env.BACKEND_URL || 'https://fleet-backend-lumo.onrender.com';

// ============================================================
// SECURITY & MIDDLEWARE
// ============================================================

// Standard Security Headers with compatible CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://*.tile.openstreetmap.org',
          'https://*.openstreetmap.org',
          'https://*.tile.openstreetmap.fr',
          'https://*.openstreetmap.fr',
          'https://*.basemaps.cartocdn.com',
          'https://basemaps.cartocdn.com',
          'https://*.arcgisonline.com',
          'https://server.arcgisonline.com',
          'https://services.arcgisonline.com'
        ],
        connectSrc: [
          "'self'",
          UPSTREAM_URL,
          'https://api.agents.snsihub.ai',
          'https://*.tile.openstreetmap.org',
          'https://*.openstreetmap.org',
          'https://*.tile.openstreetmap.fr',
          'https://*.openstreetmap.fr',
          'https://*.basemaps.cartocdn.com',
          'https://basemaps.cartocdn.com',
          'https://*.arcgisonline.com',
          'https://server.arcgisonline.com',
          'https://services.arcgisonline.com',
          'https://router.project-osrm.org'
        ]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Anti-Abuse Rate Limiting for API routes
const rateLimitMap = new Map();
app.use('/api', (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 1500;

  let clientData = rateLimitMap.get(ip);
  if (!clientData || now - clientData.startTime > windowMs) {
    clientData = { count: 1, startTime: now };
    rateLimitMap.set(ip, clientData);
  } else {
    clientData.count++;
    if (clientData.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Rate limit exceeded. Please wait a minute.'
      });
    }
  }
  next();
});

// Optional token extraction helper
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    req.user = verifyToken(authHeader.split(' ')[1]);
  }
  next();
});

// ============================================================
// HEALTH & DIAGNOSTICS
// ============================================================

app.get('/api/health', async (req, res) => {
  let upstreamHealth = 'unreachable';
  try {
    const upstreamRes = await fetch(`${UPSTREAM_URL}/api/health`, {
      signal: AbortSignal.timeout(5000)
    });
    if (upstreamRes.ok) {
      const data = await upstreamRes.json();
      upstreamHealth = data.database || 'connected';
    }
  } catch {
    upstreamHealth = 'timeout/standby';
  }

  res.status(200).json({
    success: true,
    service: 'fleet-backend-gateway',
    status: 'operational',
    database: upstreamHealth,
    authDatabase: isDbConnected() ? 'MongoDB Atlas' : 'in-memory fallback',
    upstream: UPSTREAM_URL,
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// AUTHENTICATION & RBAC ENDPOINTS
// ============================================================

app.post('/api/auth/login', handleLogin);
app.post('/api/auth/register', handleRegister);
app.post('/api/auth/logout', requireAuth, handleLogout);
app.get('/api/auth/me', requireAuth, handleGetMe);

// ============================================================
// AUDIT LOGGING ENDPOINTS
// ============================================================

app.get('/api/audit-logs', requireAuth, requireRoles('ADMIN', 'FLEET_MANAGER'), async (req, res) => {
  const { limit, action, actor, status } = req.query;
  const logs = await getAuditLogs({ limit, action, actor, status });
  res.status(200).json({
    success: true,
    count: logs.length,
    data: logs
  });
});

// ============================================================
// AI FLEET ASSISTANT / CHAT ENDPOINTS
// ============================================================

const handleAIChat = async (req, res) => {
  const { message, sessionId = 'default-session' } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Query message is required.'
    });
  }

  try {
    const aiResponse = await processFleetAIQuery(message, sessionId, req.user, req.body);
    res.status(200).json(aiResponse);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `AI Fleet Assistant internal error: ${err.message}`
    });
  }
};

app.post('/api/ai/chat', handleAIChat);
app.post('/api/ai/query', handleAIChat);

// ============================================================
// PROXIED LIVE DATA ENDPOINTS (with coordinate enrichment & caching)
// ============================================================

// Authoritative municipal & logistics corridor hub coordinates (including Madurai)
export const CORRIDOR_HUB_COORDINATES = {
  erode: { lat: 11.3410, lng: 77.7172, label: 'Erode Logistics Hub' },
  coimbatore: { lat: 11.0168, lng: 76.9558, label: 'Coimbatore Regional Depot' },
  salem: { lat: 11.6643, lng: 78.1460, label: 'Salem North Distribution Center' },
  tiruppur: { lat: 11.1085, lng: 77.3411, label: 'Tiruppur Industrial Waystation' },
  karur: { lat: 10.9601, lng: 78.0816, label: 'Karur Transit Terminal' },
  namakkal: { lat: 11.2189, lng: 78.1674, label: 'Namakkal Heavy Cargo Depot' },
  dindigul: { lat: 10.3673, lng: 77.9803, label: 'Dindigul Southern Station' },
  chennai: { lat: 13.0827, lng: 80.2707, label: 'Chennai Central Port Terminal' },
  madurai: { lat: 9.9252, lng: 78.1198, label: 'Madurai Southern Hub' },
  trichy: { lat: 10.7905, lng: 78.7047, label: 'Tiruchirappalli Central Waystation' },
  tiruchirappalli: { lat: 10.7905, lng: 78.7047, label: 'Tiruchirappalli Central Waystation' }
};

// Deterministic Realistic Demo Coordinates for Vehicles (when unassigned in DB)
export const DEMO_VEHICLE_COORDINATES = {
  'VH001': { lat: 11.3410, lng: 77.7172, hub: 'Erode Logistics Hub' },
  'VH101': { lat: 11.0168, lng: 76.9558, hub: 'Coimbatore Logistics Hub' },
  'VH102': { lat: 11.6643, lng: 78.1460, hub: 'Salem Logistics Hub' },
  'VH103': { lat: 11.3320, lng: 77.7120, hub: 'Erode Industrial Station' },
  'VH104': { lat: 11.1085, lng: 77.3411, hub: 'Tiruppur Textile Depot' },
  'VH105': { lat: 9.9252, lng: 78.1198, hub: 'Madurai Freight Terminal' },
  'VH106': { lat: 10.7905, lng: 78.7047, hub: 'Trichy Central Terminal' },
  'VH107': { lat: 13.0827, lng: 80.2707, hub: 'Chennai Coastal Station' },
  'VH108': { lat: 11.6500, lng: 78.1550, hub: 'Salem Freight Hub' },
  'VH109': { lat: 13.0750, lng: 80.2600, hub: 'Chennai North Depot' },
  'VH110': { lat: 11.0250, lng: 76.9480, hub: 'Coimbatore Airport Depot' }
};

// Deterministic Realistic Demo Coordinates for Drivers (when unassigned in DB)
export const DEMO_DRIVER_COORDINATES = {
  'DR001': { lat: 11.0180, lng: 76.9600, location: 'Coimbatore Station' },
  'DR101': { lat: 11.0140, lng: 76.9520, location: 'Coimbatore West' },
  'DR102': { lat: 11.6620, lng: 78.1420, location: 'Salem Central' },
  'DR103': { lat: 11.3380, lng: 77.7200, location: 'Erode Depot' },
  'DR104': { lat: 11.1050, lng: 77.3380, location: 'Tiruppur Hub' },
  'DR105': { lat: 9.9220, lng: 78.1150, location: 'Madurai Junction' },
  'DR106': { lat: 10.7880, lng: 78.7010, location: 'Trichy Gate' },
  'DR107': { lat: 13.0800, lng: 80.2680, location: 'Chennai Port' },
  'DR108': { lat: 11.6580, lng: 78.1500, location: 'Salem Bypass' },
  'DR109': { lat: 13.0720, lng: 80.2580, location: 'Chennai Industrial Zone' },
  'DR110': { lat: 11.0220, lng: 76.9450, location: 'Coimbatore Ring Road' }
};

export function resolveCoordinates(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') return null;
  const clean = locationStr.toLowerCase().replace(/hub|station|depot|terminal|workshop|center|north|south|central/g, '').trim();
  for (const [key, val] of Object.entries(CORRIDOR_HUB_COORDINATES)) {
    if (clean.includes(key) || key.includes(clean)) {
      return { lat: val.lat, lng: val.lng, label: val.label };
    }
  }
  return null;
}

export function enrichVehicle(v) {
  if (!v || typeof v !== 'object') return v;
  if (typeof v.latitude === 'number' && typeof v.longitude === 'number') {
    const source = v.coordinatesSource || 'LIVE_GPS';
    const isLive = source === 'LIVE_GPS';
    return {
      ...v,
      isLiveGPS: isLive,
      coordinatesSource: source,
      locationTimestamp: v.locationTimestamp || v.updatedAt || new Date().toISOString()
    };
  }
  const vId = String(v.vehicleId || v.id || '').toUpperCase();
  const demo = DEMO_VEHICLE_COORDINATES[vId];
  if (demo) {
    return {
      ...v,
      latitude: demo.lat,
      longitude: demo.lng,
      isLiveGPS: false,
      coordinatesSource: 'MOCK_DEMO',
      hubLabel: demo.hub,
      locationTimestamp: v.updatedAt || v.createdAt || new Date().toISOString()
    };
  }
  const resolved = resolveCoordinates(v.location);
  if (resolved) {
    return {
      ...v,
      latitude: resolved.lat,
      longitude: resolved.lng,
      isLiveGPS: false,
      coordinatesSource: 'MOCK_DEMO',
      hubLabel: resolved.label,
      locationTimestamp: v.updatedAt || v.createdAt || new Date().toISOString()
    };
  }
  return {
    ...v,
    latitude: null,
    longitude: null,
    isLiveGPS: false,
    coordinatesSource: 'UNRESOLVED'
  };
}

// Deterministic in-memory Driver Duty Overrides (DR001 starts in inactive/Ready until explicit duty shift)
export const driverDutyOverrides = new Map([
  ['DR001', { status: 'inactive', displayStatus: 'Ready', dutyStartTime: null, duty_start_time_str: null }]
]);

export function applyDriverDutyOverride(driver) {
  if (!driver || typeof driver !== 'object') return driver;
  const dId = String(driver.driverId || driver.id || '').toUpperCase();
  if (driverDutyOverrides.has(dId)) {
    const override = driverDutyOverrides.get(dId);
    return {
      ...driver,
      status: override.status,
      dutyStatus: override.displayStatus,
      dutyStartTime: override.dutyStartTime ?? driver.dutyStartTime,
      duty_start_time_str: override.duty_start_time_str ?? driver.duty_start_time_str,
      ...(override.location ? { currentLocation: override.location } : {})
    };
  }
  return driver;
}

export function enrichDriver(d) {
  if (!d || typeof d !== 'object') return d;
  const overridden = applyDriverDutyOverride(d);
  if (typeof overridden.latitude === 'number' && typeof overridden.longitude === 'number') {
    const source = overridden.coordinatesSource || 'LIVE_GPS';
    const isLive = source === 'LIVE_GPS' || source === 'MOBILE_GPS';
    return {
      ...overridden,
      isLiveGPS: isLive,
      coordinatesSource: source,
      accuracy: overridden.accuracy ?? null,
      locationTimestamp: overridden.locationTimestamp || overridden.updatedAt || new Date().toISOString()
    };
  }
  const dId = String(overridden.driverId || overridden.id || '').toUpperCase();
  const demo = DEMO_DRIVER_COORDINATES[dId];
  if (demo) {
    return {
      ...overridden,
      latitude: demo.lat,
      longitude: demo.lng,
      isLiveGPS: false,
      coordinatesSource: 'MOCK_DEMO',
      hubLabel: demo.location,
      accuracy: null,
      locationTimestamp: overridden.updatedAt || overridden.createdAt || new Date().toISOString()
    };
  }
  const resolved = resolveCoordinates(overridden.currentLocation || overridden.location);
  if (resolved) {
    return {
      ...overridden,
      latitude: resolved.lat,
      longitude: resolved.lng,
      isLiveGPS: false,
      coordinatesSource: 'MOCK_DEMO',
      hubLabel: resolved.label,
      accuracy: null,
      locationTimestamp: overridden.updatedAt || overridden.createdAt || new Date().toISOString()
    };
  }
  return {
    ...overridden,
    latitude: null,
    longitude: null,
    isLiveGPS: false,
    coordinatesSource: 'UNRESOLVED'
  };
}

export function enrichTrip(t) {
  if (!t || typeof t !== 'object') return t;
  const originCoords = t.originCoordinates || resolveCoordinates(t.origin);
  const destCoords = t.destinationCoordinates || resolveCoordinates(t.destination);
  return {
    ...t,
    originCoordinates: originCoords ? { lat: originCoords.lat, lng: originCoords.lng } : null,
    destinationCoordinates: destCoords ? { lat: destCoords.lat, lng: destCoords.lng } : null,
    originLabel: originCoords?.label || t.origin,
    destinationLabel: destCoords?.label || t.destination
  };
}

export const upstreamCache = new Map();
const CACHE_TTL_MS = 30000;

export function invalidateUpstreamCache(pattern = null) {
  if (!pattern) {
    upstreamCache.clear();
    return;
  }
  const cleanPat = String(pattern).toLowerCase();
  for (const key of Array.from(upstreamCache.keys())) {
    if (key.toLowerCase().includes(cleanPat)) {
      upstreamCache.delete(key);
    }
  }
}

async function fetchFromUpstream(endpoint, req) {
  const isGet = req.method === 'GET';
  const now = Date.now();
  if (isGet && upstreamCache.has(endpoint)) {
    const cached = upstreamCache.get(endpoint);
    if (now - cached.time < CACHE_TTL_MS) {
      return { status: 200, data: cached.data };
    }
  }

  const targetUrl = `${UPSTREAM_URL}${endpoint}`;
  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {})
      },
      ...(req.method !== 'GET' && req.body ? { body: JSON.stringify(req.body) } : {}),
      signal: AbortSignal.timeout(15000)
    });

    const data = await upstreamRes.json();
    if (isGet && upstreamRes.status === 200) {
      upstreamCache.set(endpoint, { time: now, data });
    }
    return { status: upstreamRes.status, data };
  } catch (err) {
    if (isGet && upstreamCache.has(endpoint)) {
      return { status: 200, data: upstreamCache.get(endpoint).data };
    }
    return {
      status: 502,
      data: {
        success: false,
        error: `Failed to contact live upstream backend at ${targetUrl}: ${err.message}`
      }
    };
  }
}

async function forwardToUpstream(endpoint, req, res, transform = null) {
  const result = await fetchFromUpstream(endpoint, req);
  if (result.status === 200 && transform && result.data) {
    return res.status(200).json(transform(result.data));
  }
  return res.status(result.status).json(result.data);
}

// Live Vehicles
app.get('/api/vehicles', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  forwardToUpstream(`/api/vehicles${query}`, req, res, (payload) => {
    if (Array.isArray(payload.data)) {
      return { ...payload, data: payload.data.map(enrichVehicle) };
    }
    if (Array.isArray(payload)) {
      return payload.map(enrichVehicle);
    }
    return payload;
  });
});
app.get('/api/vehicles/:id', (req, res) => {
  forwardToUpstream(`/api/vehicles/${req.params.id}`, req, res, (payload) => {
    if (payload.data) {
      return { ...payload, data: enrichVehicle(payload.data) };
    }
    return enrichVehicle(payload);
  });
});

// Live Drivers
app.get('/api/drivers', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  forwardToUpstream(`/api/drivers${query}`, req, res, (payload) => {
    if (Array.isArray(payload.data)) {
      return { ...payload, data: payload.data.map(enrichDriver) };
    }
    if (Array.isArray(payload)) {
      return payload.map(enrichDriver);
    }
    return payload;
  });
});
app.get('/api/drivers/:id', (req, res) => {
  forwardToUpstream(`/api/drivers/${req.params.id}`, req, res, (payload) => {
    if (payload.data) {
      return { ...payload, data: enrichDriver(payload.data) };
    }
    return enrichDriver(payload);
  });
});

// Live Trips
app.get('/api/trips', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  forwardToUpstream(`/api/trips${query}`, req, res, (payload) => {
    if (Array.isArray(payload.data)) {
      return { ...payload, data: payload.data.map(enrichTrip) };
    }
    if (Array.isArray(payload)) {
      return payload.map(enrichTrip);
    }
    return payload;
  });
});
app.get('/api/trips/:id', (req, res) => {
  forwardToUpstream(`/api/trips/${req.params.id}`, req, res, (payload) => {
    if (payload.data) {
      return { ...payload, data: enrichTrip(payload.data) };
    }
    return enrichTrip(payload);
  });
});

// Real-Time Consolidated Location Telemetry Snapshot
app.get('/api/locations/live', async (req, res) => {
  try {
    const [vehRes, drvRes] = await Promise.all([
      fetchFromUpstream('/api/vehicles', req),
      fetchFromUpstream('/api/drivers', req)
    ]);
    const vehiclesRaw = Array.isArray(vehRes.data?.data) ? vehRes.data.data : (Array.isArray(vehRes.data) ? vehRes.data : []);
    const driversRaw = Array.isArray(drvRes.data?.data) ? drvRes.data.data : (Array.isArray(drvRes.data) ? drvRes.data : []);

    const vehicles = vehiclesRaw.map(enrichVehicle);
    const drivers = driversRaw.map(enrichDriver);

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      counts: {
        totalVehicles: vehicles.length,
        positionedVehicles: vehicles.filter(v => v.latitude !== null).length,
        liveGpsVehicles: vehicles.filter(v => v.coordinatesSource === 'LIVE_GPS').length,
        manualVehicles: vehicles.filter(v => v.coordinatesSource === 'MANUAL').length,
        demoVehicles: vehicles.filter(v => v.coordinatesSource === 'MOCK_DEMO').length,
        totalDrivers: drivers.length,
        positionedDrivers: drivers.filter(d => d.latitude !== null).length,
        liveGpsDrivers: drivers.filter(d => d.coordinatesSource === 'LIVE_GPS' || d.coordinatesSource === 'MOBILE_GPS').length,
        mobileGpsDrivers: drivers.filter(d => d.coordinatesSource === 'MOBILE_GPS').length,
        manualDrivers: drivers.filter(d => d.coordinatesSource === 'MANUAL').length,
        demoDrivers: drivers.filter(d => d.coordinatesSource === 'MOCK_DEMO').length
      },
      vehicles,
      drivers
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to compile location snapshot: ${err.message}`
    });
  }
});

// Mutation: Update Vehicle Coordinates (RBAC: ADMIN, FLEET_MANAGER, DISPATCHER)
app.patch('/api/vehicles/:id', requireAuth, requireRoles('ADMIN', 'FLEET_MANAGER', 'DISPATCHER'), async (req, res) => {
  const { latitude, longitude, coordinatesSource, locationTimestamp } = req.body || {};

  // Support clearing coordinates if explicitly passing null
  if (latitude === null && longitude === null) {
    invalidateUpstreamCache('/api/vehicles');
    invalidateUpstreamCache('/api/locations');
    invalidateUpstreamCache('/api/analytics');

    logAuditEvent({
      action: 'VEHICLE_LOCATION_CLEAR',
      actor: req.user.phone || req.user.name,
      role: req.user.role,
      details: { vehicleId: req.params.id },
      status: 'SUCCESS'
    });

    const targetUrl = `${UPSTREAM_URL}/api/vehicles/${req.params.id}`;
    try {
      const upstreamRes = await fetch(targetUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
          'x-api-key': process.env.TELEMETRY_API_KEY || 'fleet-telemetry-default-key'
        },
        body: JSON.stringify({ latitude: null, longitude: null, coordinatesSource: null, locationTimestamp: null }),
        signal: AbortSignal.timeout(15000)
      });
      const data = await upstreamRes.json();
      return res.status(upstreamRes.status).json(data);
    } catch (err) {
      return res.status(502).json({ success: false, error: err.message });
    }
  }

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Latitude and Longitude are required for coordinate update.'
    });
  }

  const lat = typeof latitude === 'number' ? latitude : Number(latitude);
  const lng = typeof longitude === 'number' ? longitude : Number(longitude);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({
      success: false,
      error: 'Invalid latitude: must be a numeric value between -90 and 90 degrees.'
    });
  }

  if (isNaN(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({
      success: false,
      error: 'Invalid longitude: must be a numeric value between -180 and 180 degrees.'
    });
  }

  const validSources = ['LIVE_GPS', 'MANUAL', 'HUB_GEOLOCATION'];
  const source = coordinatesSource || 'MANUAL';
  if (!validSources.includes(source)) {
    return res.status(400).json({
      success: false,
      error: `Invalid coordinatesSource: must be one of ${validSources.join(', ')}.`
    });
  }

  invalidateUpstreamCache('/api/vehicles');
  invalidateUpstreamCache('/api/locations');
  invalidateUpstreamCache('/api/analytics');

  logAuditEvent({
    action: 'VEHICLE_LOCATION_UPDATE',
    actor: req.user.phone || req.user.name,
    role: req.user.role,
    details: { vehicleId: req.params.id, latitude: lat, longitude: lng, coordinatesSource: source },
    status: 'SUCCESS'
  });

  const targetUrl = `${UPSTREAM_URL}/api/vehicles/${req.params.id}`;
  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        'x-api-key': process.env.TELEMETRY_API_KEY || 'fleet-telemetry-default-key'
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        coordinatesSource: source,
        locationTimestamp: locationTimestamp || new Date().toISOString()
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await upstreamRes.json();
    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: `Failed to forward location update to upstream backend: ${err.message}`
    });
  }
});

// Mutation: Update Driver Coordinates (RBAC: ADMIN, FLEET_MANAGER, DISPATCHER)
app.patch('/api/drivers/:id', requireAuth, requireRoles('ADMIN', 'FLEET_MANAGER', 'DISPATCHER'), async (req, res) => {
  const { latitude, longitude, coordinatesSource, locationTimestamp } = req.body || {};

  if (latitude === null && longitude === null) {
    invalidateUpstreamCache('/api/drivers');
    invalidateUpstreamCache('/api/locations');
    invalidateUpstreamCache('/api/analytics');

    logAuditEvent({
      action: 'DRIVER_LOCATION_CLEAR',
      actor: req.user.phone || req.user.name,
      role: req.user.role,
      details: { driverId: req.params.id },
      status: 'SUCCESS'
    });

    const targetUrl = `${UPSTREAM_URL}/api/drivers/${req.params.id}`;
    try {
      const upstreamRes = await fetch(targetUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
          'x-api-key': process.env.TELEMETRY_API_KEY || 'fleet-telemetry-default-key'
        },
        body: JSON.stringify({
          latitude: null,
          longitude: null,
          accuracy: null,
          coordinatesSource: null,
          locationTimestamp: null
        }),
        signal: AbortSignal.timeout(15000)
      });
      const data = await upstreamRes.json();
      return res.status(upstreamRes.status).json(data);
    } catch (err) {
      return res.status(502).json({ success: false, error: err.message });
    }
  }

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Latitude and Longitude are required for coordinate update.'
    });
  }

  const lat = typeof latitude === 'number' ? latitude : Number(latitude);
  const lng = typeof longitude === 'number' ? longitude : Number(longitude);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({
      success: false,
      error: 'Invalid latitude: must be a numeric value between -90 and 90 degrees.'
    });
  }

  if (isNaN(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({
      success: false,
      error: 'Invalid longitude: must be a numeric value between -180 and 180 degrees.'
    });
  }

  const validSources = ['LIVE_GPS', 'MANUAL', 'HUB_GEOLOCATION', 'MOBILE_GPS'];
  const source = coordinatesSource || 'MANUAL';
  if (!validSources.includes(source)) {
    return res.status(400).json({
      success: false,
      error: `Invalid coordinatesSource: must be one of ${validSources.join(', ')}.`
    });
  }

  invalidateUpstreamCache('/api/drivers');
  invalidateUpstreamCache('/api/locations');
  invalidateUpstreamCache('/api/analytics');

  logAuditEvent({
    action: 'DRIVER_LOCATION_UPDATE',
    actor: req.user.phone || req.user.name,
    role: req.user.role,
    details: { driverId: req.params.id, latitude: lat, longitude: lng, coordinatesSource: source },
    status: 'SUCCESS'
  });

  const targetUrl = `${UPSTREAM_URL}/api/drivers/${req.params.id}`;
  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        'x-api-key': process.env.TELEMETRY_API_KEY || 'fleet-telemetry-default-key'
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        coordinatesSource: source,
        locationTimestamp: locationTimestamp || new Date().toISOString()
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await upstreamRes.json();
    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: `Failed to forward location update to upstream backend: ${err.message}`
    });
  }
});

// ============================================================
// DRIVER DUTY SHIFT MANAGEMENT (START / END DUTY)
// ============================================================
app.post('/api/drivers/duty', requireAuth, async (req, res) => {
  const userRole = String(req.user?.role || '').toUpperCase();
  const tokenDriverId = req.user?.driverId;
  const bodyDriverId = req.body?.driverId;
  const { status, location } = req.body || {};

  let targetDriverId = null;

  if (userRole === 'DRIVER') {
    if (!tokenDriverId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Authenticated driver profile does not have an assigned driver ID.'
      });
    }
    if (bodyDriverId && String(bodyDriverId) !== String(tokenDriverId)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Drivers may only update their own duty status.'
      });
    }
    targetDriverId = tokenDriverId;
  } else if (['ADMIN', 'FLEET_MANAGER', 'DISPATCHER'].includes(userRole)) {
    if (!bodyDriverId) {
      return res.status(400).json({
        success: false,
        error: 'driverId is required in request body when updating as administrator/dispatcher.'
      });
    }
    targetDriverId = bodyDriverId;
  } else {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Insufficient privileges for driver duty status updates.'
    });
  }

  const cleanStatus = String(status || '').trim().toLowerCase();
  const isStarting = ['active', 'start', 'on_duty'].includes(cleanStatus);
  const isEnding = ['ready', 'inactive', 'offline', 'stop', 'off_duty', 'break'].includes(cleanStatus);

  if (!isStarting && !isEnding) {
    return res.status(400).json({
      success: false,
      error: 'Invalid duty status. Supported values: "active" (start duty) or "ready"/"inactive"/"offline" (end duty).'
    });
  }

  const upstreamStatus = isStarting ? 'active' : 'inactive';
  const displayStatus = isStarting ? 'Active' : 'Ready';
  const now = new Date();
  const dutyTimeStr = isStarting ? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;
  const dutyTimeIso = isStarting ? now.toISOString() : null;

  const updatePayload = {
    status: upstreamStatus
  };

  if (location && isStarting) {
    updatePayload.currentLocation = location;
  }

  // Update in-memory upstream cache if driver exists in cache
  if (upstreamCache.has('/api/drivers')) {
    const cached = upstreamCache.get('/api/drivers');
    if (Array.isArray(cached?.data?.data)) {
      const idx = cached.data.data.findIndex(d => String(d.driverId || d.id || '').toUpperCase() === String(targetDriverId).toUpperCase());
      if (idx !== -1) {
        cached.data.data[idx] = {
          ...cached.data.data[idx],
          status: upstreamStatus,
          dutyStartTime: dutyTimeIso,
          duty_start_time_str: dutyTimeStr,
          ...(location && isStarting ? { currentLocation: location } : {})
        };
      }
    }
  }

  // Update deterministic in-memory duty override
  driverDutyOverrides.set(String(targetDriverId).toUpperCase(), {
    status: upstreamStatus,
    displayStatus,
    dutyStartTime: dutyTimeIso,
    duty_start_time_str: dutyTimeStr,
    location: (location && isStarting) ? location : null
  });

  // Invalidate upstream cache
  invalidateUpstreamCache('/api/drivers');
  invalidateUpstreamCache('/api/analytics');

  logAuditEvent({
    action: isStarting ? 'DRIVER_DUTY_START' : 'DRIVER_DUTY_END',
    actor: req.user.phone || req.user.name,
    role: req.user.role,
    details: { driverId: targetDriverId, status: displayStatus, location: location || null },
    status: 'SUCCESS'
  });

  // Forward persistent update upstream
  const targetUrl = `${UPSTREAM_URL}/api/drivers/${targetDriverId}`;
  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.TELEMETRY_API_KEY || 'fleet-telemetry-default-key'
      },
      body: JSON.stringify(updatePayload),
      signal: AbortSignal.timeout(15000)
    });

    const data = await upstreamRes.json().catch(() => ({}));
    return res.status(upstreamRes.ok ? 200 : upstreamRes.status).json({
      success: true,
      message: isStarting ? 'Duty shift started successfully.' : 'Duty shift ended. Driver set to Ready / Offline.',
      driver: {
        driverId: targetDriverId,
        status: displayStatus,
        dutyStartTime: dutyTimeIso,
        duty_start_time_str: dutyTimeStr,
        self_reported_location: location || null
      },
      upstream: data
    });
  } catch (err) {
    // If upstream is temporarily unreachable, respond with success based on local persistence
    return res.status(200).json({
      success: true,
      message: isStarting ? 'Duty shift started (cached).' : 'Duty shift ended (cached).',
      driver: {
        driverId: targetDriverId,
        status: displayStatus,
        dutyStartTime: dutyTimeIso,
        duty_start_time_str: dutyTimeStr,
        self_reported_location: location || null
      },
      warning: `Upstream sync delayed: ${err.message}`
    });
  }
});

// Continuous Driver Mobile Device GPS Telemetry Ingestion
app.post('/api/locations/driver', requireAuth, async (req, res) => {
  const userRole = String(req.user?.role || '').toUpperCase();
  const tokenDriverId = req.user?.driverId;
  const bodyDriverId = req.body?.driverId;

  let targetDriverId = null;

  if (userRole === 'DRIVER') {
    if (!tokenDriverId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Authenticated driver profile does not have an assigned driver ID.'
      });
    }
    if (bodyDriverId && String(bodyDriverId) !== String(tokenDriverId)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Drivers may only update their own device location.'
      });
    }
    targetDriverId = tokenDriverId;
  } else if (['ADMIN', 'FLEET_MANAGER', 'DISPATCHER'].includes(userRole)) {
    if (!bodyDriverId) {
      return res.status(400).json({
        success: false,
        error: 'driverId is required in request body when updating as an administrator/dispatcher.'
      });
    }
    targetDriverId = bodyDriverId;
  } else {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Insufficient privileges for driver location updates.'
    });
  }

  const { latitude, longitude, accuracy, timestamp, source } = req.body || {};

  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return res.status(400).json({
      success: false,
      error: 'Both latitude and longitude are required for driver location telemetry.'
    });
  }

  const lat = typeof latitude === 'number' ? latitude : Number(latitude);
  const lng = typeof longitude === 'number' ? longitude : Number(longitude);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({
      success: false,
      error: 'Invalid latitude: must be a numeric value between -90 and 90 degrees.'
    });
  }

  if (isNaN(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({
      success: false,
      error: 'Invalid longitude: must be a numeric value between -180 and 180 degrees.'
    });
  }

  if (accuracy !== undefined && accuracy !== null) {
    const acc = typeof accuracy === 'number' ? accuracy : Number(accuracy);
    if (isNaN(acc) || acc < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid accuracy: must be a non-negative number in meters.'
      });
    }
  }

  if (timestamp !== undefined && timestamp !== null) {
    if (isNaN(Date.parse(timestamp))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timestamp: must be a valid ISO 8601 date-time string.'
      });
    }
  }

  const validSources = ['MOBILE_GPS', 'LIVE_GPS', 'MANUAL'];
  const effectiveSource = source || 'MOBILE_GPS';
  if (!validSources.includes(effectiveSource)) {
    return res.status(400).json({
      success: false,
      error: `Invalid source: must be one of ${validSources.join(', ')}.`
    });
  }

  invalidateUpstreamCache('/api/drivers');
  invalidateUpstreamCache('/api/locations');
  invalidateUpstreamCache('/api/analytics');

  logAuditEvent({
    action: 'DRIVER_LOCATION_TELEMETRY',
    actor: req.user.phone || req.user.name,
    role: req.user.role,
    details: { driverId: targetDriverId, latitude: lat, longitude: lng, accuracy, source: effectiveSource },
    status: 'SUCCESS'
  });

  const targetUrl = `${UPSTREAM_URL}/api/locations/driver`;
  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        'x-api-key': process.env.TELEMETRY_API_KEY || 'fleet-telemetry-default-key'
      },
      body: JSON.stringify({
        driverId: targetDriverId,
        latitude: lat,
        longitude: lng,
        accuracy: (accuracy !== undefined && accuracy !== null) ? Number(accuracy) : null,
        timestamp: timestamp || new Date().toISOString(),
        source: effectiveSource
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await upstreamRes.json();
    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: `Failed to forward driver telemetry upstream: ${err.message}`
    });
  }
});

// Mutation: Create Vehicle (RBAC: ADMIN, FLEET_MANAGER)
app.post('/api/vehicles', requireAuth, requireRoles('ADMIN', 'FLEET_MANAGER'), async (req, res) => {
  const { vehicleId, registrationNumber, type, status, driverId, location, mileage, fuelLevel } = req.body || {};

  if (!vehicleId || !registrationNumber) {
    return res.status(400).json({
      success: false,
      error: 'Vehicle ID and Registration Number are required.'
    });
  }

  const payload = {
    vehicleId: String(vehicleId).trim().toUpperCase(),
    registrationNumber: String(registrationNumber).trim().toUpperCase(),
    type: type ? String(type).trim() : 'Mini Truck',
    status: status ? String(status).trim().toLowerCase() : 'active',
    driverId: driverId ? String(driverId).trim().toUpperCase() : null,
    location: location ? String(location).trim() : 'Coimbatore Regional Depot',
    mileage: typeof mileage === 'number' ? mileage : (Number(mileage) || 0),
    fuelLevel: typeof fuelLevel === 'number' ? fuelLevel : (Number(fuelLevel) || 80)
  };

  invalidateUpstreamCache('/api/vehicles');
  invalidateUpstreamCache('/api/analytics');
  invalidateUpstreamCache('/api/locations');

  logAuditEvent({
    action: 'VEHICLE_CREATE',
    actor: req.user?.phone || req.user?.name || 'system-admin',
    role: req.user?.role || 'FLEET_MANAGER',
    details: { vehicleId: payload.vehicleId, registrationNumber: payload.registrationNumber },
    status: 'SUCCESS'
  });

  const targetUrl = `${UPSTREAM_URL}/api/vehicles`;
  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        'x-api-key': process.env.TELEMETRY_API_KEY || 'fleet-telemetry-default-key'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    const data = await upstreamRes.json();
    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: `Failed to forward vehicle creation to upstream backend: ${err.message}`
    });
  }
});

// Mutation: Create Driver (RBAC: ADMIN, FLEET_MANAGER)
app.post('/api/drivers', requireAuth, requireRoles('ADMIN', 'FLEET_MANAGER'), async (req, res) => {
  const { driverId, name, phone, licenseNumber, status, assignedVehicleId, currentLocation } = req.body || {};

  if (!name || !licenseNumber) {
    return res.status(400).json({
      success: false,
      error: 'Driver Name and License Number are required.'
    });
  }

  const effectiveDriverId = driverId && String(driverId).trim()
    ? String(driverId).trim().toUpperCase()
    : `DR${Math.floor(100 + Math.random() * 900)}`;

  const payload = {
    driverId: effectiveDriverId,
    name: String(name).trim(),
    phone: phone ? String(phone).trim() : null,
    licenseNumber: String(licenseNumber).trim().toUpperCase(),
    status: status ? String(status).trim().toLowerCase() : 'active',
    assignedVehicleId: assignedVehicleId ? String(assignedVehicleId).trim().toUpperCase() : null,
    currentLocation: currentLocation ? String(currentLocation).trim() : 'Coimbatore Regional Depot'
  };

  invalidateUpstreamCache('/api/drivers');
  invalidateUpstreamCache('/api/analytics');
  invalidateUpstreamCache('/api/locations');

  logAuditEvent({
    action: 'DRIVER_CREATE',
    actor: req.user?.phone || req.user?.name || 'system-admin',
    role: req.user?.role || 'FLEET_MANAGER',
    details: { driverId: payload.driverId, name: payload.name, licenseNumber: payload.licenseNumber },
    status: 'SUCCESS'
  });

  const targetUrl = `${UPSTREAM_URL}/api/drivers`;
  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        'x-api-key': process.env.TELEMETRY_API_KEY || 'fleet-telemetry-default-key'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    const data = await upstreamRes.json();
    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: `Failed to forward driver creation to upstream backend: ${err.message}`
    });
  }
});

app.post('/api/trips', requireAuth, requireRoles('ADMIN', 'FLEET_MANAGER', 'DISPATCHER'), (req, res) => {
  const { origin, destination, vehicleId, driverId } = req.body || {};
  if (!origin || !destination) {
    return res.status(400).json({
      success: false,
      error: 'Origin and destination are required for trip creation.'
    });
  }

  logAuditEvent({
    action: 'TRIP_CREATE',
    actor: req.user.phone || req.user.name,
    role: req.user.role,
    details: { origin, destination, vehicleId, driverId },
    status: 'SUCCESS'
  });

  invalidateUpstreamCache('/api/trips');
  invalidateUpstreamCache('/api/analytics');
  invalidateUpstreamCache('/api/vehicles');
  invalidateUpstreamCache('/api/drivers');

  forwardToUpstream('/api/trips', req, res);
});

// Live Maintenance
app.get('/api/maintenance', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  forwardToUpstream(`/api/maintenance${query}`, req, res);
});
app.get('/api/maintenance/:id', (req, res) => {
  forwardToUpstream(`/api/maintenance/${req.params.id}`, req, res);
});

// Live Fuel
app.get('/api/fuel', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  forwardToUpstream(`/api/fuel${query}`, req, res);
});
app.get('/api/fuel/:id', (req, res) => {
  forwardToUpstream(`/api/fuel/${req.params.id}`, req, res);
});

// Live Safety Alerts
app.get('/api/safety-alerts', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  forwardToUpstream(`/api/safety-alerts${query}`, req, res);
});
app.get('/api/safety-alerts/:id', (req, res) => {
  forwardToUpstream(`/api/safety-alerts/${req.params.id}`, req, res);
});

// Real-Time Analytics (Aggregated strictly from live database)
app.get('/api/analytics', async (req, res) => {
  try {
    const [vehRes, drvRes, tripRes, fuelRes, maintRes] = await Promise.all([
      fetch(`${UPSTREAM_URL}/api/vehicles`, { signal: AbortSignal.timeout(15000) }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${UPSTREAM_URL}/api/drivers`, { signal: AbortSignal.timeout(15000) }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${UPSTREAM_URL}/api/trips`, { signal: AbortSignal.timeout(15000) }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${UPSTREAM_URL}/api/fuel`, { signal: AbortSignal.timeout(15000) }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${UPSTREAM_URL}/api/maintenance`, { signal: AbortSignal.timeout(15000) }).then(r => r.json()).catch(() => ({ data: [] }))
    ]);

    const vehicles = Array.isArray(vehRes.data) ? vehRes.data : [];
    const drivers = Array.isArray(drvRes.data) ? drvRes.data : [];
    const trips = Array.isArray(tripRes.data) ? tripRes.data : [];
    const fuel = Array.isArray(fuelRes.data) ? fuelRes.data : [];
    const maintenance = Array.isArray(maintRes.data) ? maintRes.data : [];

    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter(v => (v.status || '').toLowerCase() === 'active').length;
    const maintenanceVehicles = vehicles.filter(v => (v.status || '').toLowerCase() === 'maintenance').length;
    const idleVehicles = totalVehicles - activeVehicles - maintenanceVehicles;

    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter(d => (d.status || '').toLowerCase() === 'active').length;

    const totalTrips = trips.length;
    const activeTrips = trips.filter(t => t.status === 'ongoing' || t.status === 'in_progress').length;
    const completedTrips = trips.filter(t => t.status === 'completed').length;
    const pendingTrips = totalTrips - completedTrips;

    const validFuels = vehicles.map(v => v.fuelLevel).filter(f => typeof f === 'number');
    const avgFuel = validFuels.length > 0 ? Math.round(validFuels.reduce((a, b) => a + b, 0) / validFuels.length) : 70;
    const lowFuelVehicles = vehicles.filter(v => typeof v.fuelLevel === 'number' && v.fuelLevel < 50);

    const dueMaintenance = maintenance.filter(m => (m.status || '').toLowerCase() !== 'completed').length;
    const utilization = totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalVehicles,
        activeVehicles,
        travellingVehicles: activeVehicles,
        travelling_count: activeVehicles,
        idleVehicles: Math.max(idleVehicles, 0),
        maintenanceVehicles,
        totalDrivers,
        activeDrivers,
        totalTrips,
        activeTrips,
        completedTrips,
        pendingTrips,
        averageFuel: avgFuel,
        lowFuelCount: lowFuelVehicles.length,
        dueMaintenance,
        fleetUtilizationRate: utilization,
        fuelAnomalies: fuel.filter(f => f.status === 'anomaly').length
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Analytics calculation failed: ${err.message}`
    });
  }
});

// Live Analytics Summary & Analysis Proxies (authoritative Render backend endpoints)
app.get('/api/analytics/summary', (req, res) => {
  forwardToUpstream('/api/analytics/summary', req, res);
});

app.get('/api/analytics/analysis', (req, res) => {
  forwardToUpstream('/api/analytics/analysis', req, res);
});

// Route Recommendation
app.get('/api/routes/recommend', (req, res) => {
  const { source = 'Coimbatore', destination = 'Chennai' } = req.query;
  res.status(200).json({
    success: true,
    data: {
      source,
      destination,
      distanceKm: 510,
      estimatedDuration: '8h 15m',
      waypoints: ['Erode', 'Salem', 'Vellore'],
      recommendedHighway: 'NH544 / NH48',
      tollPlazas: 7
    }
  });
});

// Upstream Route Optimization Proxy
app.post('/api/routes/optimize', (req, res) => {
  forwardToUpstream('/api/routes/optimize', req, res);
});

// ============================================================
// STATIC ASSETS (Production Vercel/Render Build)
// ============================================================

const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to index.html for client-side routing in Express 5
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.url.startsWith('/api')) {
    return res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next();
    });
  }
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  next();
});

// Start Server — initialize MongoDB Atlas auth connection non-blockingly
app.listen(PORT, async () => {
  console.log(`[Fleet Server] Running on http://localhost:${PORT}`);
  console.log(`[Fleet Server] Upstream connected to: ${UPSTREAM_URL}`);
  // Connect to MongoDB Atlas for user auth persistence (non-blocking)
  connectDb().catch(err => {
    console.warn('[Fleet Server] Auth DB connection failed, running with in-memory auth fallback:', err.message);
  });
});

export default app;
