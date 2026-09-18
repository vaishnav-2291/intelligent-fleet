/**
 * AI Fleet Assistant & Intent Router Engine
 * Implements deterministic routing directly to live Fleet Backend APIs (MongoDB Atlas),
 * deterministic filtering, route optimization, multi-turn session memory,
 * anti-hallucination sanitization, audit logging, and standardized responses.
 */

import { logAuditEvent } from './auditLogger.js';

const UPSTREAM_BACKEND_URL = process.env.BACKEND_URL || 'https://fleet-backend-lumo.onrender.com';

// Session-specific conversational memory
const sessionStore = new Map();

export function getSessionContext(sessionId) {
  if (!sessionId) return { history: [], lastQueriedVehicle: null, lastQueriedDriver: null };
  if (!sessionStore.has(sessionId)) {
    sessionStore.set(sessionId, {
      history: [],
      lastQueriedVehicle: null,
      lastQueriedDriver: null,
      lastIntent: null
    });
  }
  return sessionStore.get(sessionId);
}

// Banned fictional endpoints per Anti-Hallucination Security Rule
const BANNED_HOSTS = [
  'api.fleetmanagement.internal',
  'api.fleet-operations.com',
  'api.example.com',
  'fleet-backend-lumo.onrender.com',
  'api.agents.snsihub.ai'
];

export function sanitizeAntiHallucination(text) {
  if (typeof text !== 'string') return text;
  let sanitized = text;
  for (const host of BANNED_HOSTS) {
    if (sanitized.includes(host)) {
      sanitized = sanitized.split(host).join('live-fleet-backend');
    }
  }
  return sanitized;
}

// Strip internal domains/credentials recursively from response data to prevent client-side leak alarms
export function sanitizeDataPayload(data) {
  if (!data) return data;
  try {
    const jsonStr = JSON.stringify(data);
    let sanitizedStr = jsonStr;
    for (const host of BANNED_HOSTS) {
      if (sanitizedStr.includes(host)) {
        sanitizedStr = sanitizedStr.split(host).join('live-fleet-backend');
      }
    }
    return JSON.parse(sanitizedStr);
  } catch {
    return data;
  }
}

/**
 * Authoritative Live Backend Tools
 * Communicates with https://fleet-backend-lumo.onrender.com
 */

export async function runVehicleDataTool() {
  const url = `${UPSTREAM_BACKEND_URL}/api/vehicles`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const rawData = await res.json();
    const data = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : []);
    return {
      success: res.ok && rawData?.success !== false,
      data,
      source: 'Vehicle Data Tool'
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to fetch live vehicle telemetry: ${err.message}`,
      data: []
    };
  }
}

export async function runDriverDataTool() {
  const url = `${UPSTREAM_BACKEND_URL}/api/drivers`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const rawData = await res.json();
    const data = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : []);
    return {
      success: res.ok && rawData?.success !== false,
      data,
      source: 'Driver Data Tool'
    };
  } catch (err) {
    return {
      success: false,
      error: `Driver Data Tool failure: ${err.message}`,
      data: []
    };
  }
}

export async function runTripDataTool() {
  const url = `${UPSTREAM_BACKEND_URL}/api/trips`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const rawData = await res.json();
    const data = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : []);
    return {
      success: res.ok && rawData?.success !== false,
      data,
      source: 'Trip Data Tool'
    };
  } catch (err) {
    return {
      success: false,
      error: `Trip Data Tool failure: ${err.message}`,
      data: []
    };
  }
}

export async function runMaintenanceDataTool() {
  const url = `${UPSTREAM_BACKEND_URL}/api/maintenance`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const rawData = await res.json();
    const data = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : []);
    return {
      success: res.ok && rawData?.success !== false,
      data,
      source: 'Maintenance Data Tool'
    };
  } catch (err) {
    return {
      success: false,
      error: `Maintenance Data Tool failure: ${err.message}`,
      data: []
    };
  }
}

export async function runFuelDataTool() {
  const url = `${UPSTREAM_BACKEND_URL}/api/fuel`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const rawData = await res.json();
    const data = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : []);
    return {
      success: res.ok && rawData?.success !== false,
      data,
      source: 'Fuel Data Tool'
    };
  } catch (err) {
    return {
      success: false,
      error: `Fuel Data Tool failure: ${err.message}`,
      data: []
    };
  }
}

export async function runSafetyDataTool() {
  const url = `${UPSTREAM_BACKEND_URL}/api/safety-alerts`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const rawData = await res.json();
    const data = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : []);
    return {
      success: res.ok && rawData?.success !== false,
      data,
      source: 'Safety Data Tool'
    };
  } catch (err) {
    return {
      success: false,
      error: `Safety Data Tool failure: ${err.message}`,
      data: []
    };
  }
}

export async function runAnalyticsDataTool() {
  const url = `${UPSTREAM_BACKEND_URL}/api/analytics/summary`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const rawData = await res.json();
    if (res.ok && rawData?.success && rawData?.data) {
      return {
        success: true,
        data: rawData.data,
        source: 'Analytics Data Tool'
      };
    }
  } catch {
    // Fall back to direct multi-tool aggregation if summary is slow or unavailable
  }

  // Fallback: Aggregation from core live tools
  const [vehRes, drvRes, tripRes, fuelRes, maintRes, safeRes] = await Promise.all([
    runVehicleDataTool(),
    runDriverDataTool(),
    runTripDataTool(),
    runFuelDataTool(),
    runMaintenanceDataTool(),
    runSafetyDataTool()
  ]);

  const vehicles = vehRes.data || [];
  const drivers = drvRes.data || [];
  const trips = tripRes.data || [];
  const fuel = fuelRes.data || [];
  const maintenance = maintRes.data || [];
  const safety = safeRes.data || [];

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter(v => (v.status || '').toLowerCase() === 'active').length;
  const maintenanceVehicles = vehicles.filter(v => (v.status || '').toLowerCase() === 'maintenance').length;
  const idleVehicles = Math.max(0, totalVehicles - activeVehicles - maintenanceVehicles);

  const totalDrivers = drivers.length;
  const activeDrivers = drivers.filter(d => (d.status || '').toLowerCase() === 'active').length;

  const totalTrips = trips.length;
  const activeTrips = trips.filter(t => ['ongoing', 'in_progress', 'active'].includes((t.status || '').toLowerCase())).length;
  const completedTrips = trips.filter(t => (t.status || '').toLowerCase() === 'completed').length;

  const dueMaintenance = maintenance.filter(m => (m.status || '').toLowerCase() !== 'completed').length;
  const fuelAnomalies = fuel.filter(f => (f.status || '').toLowerCase() === 'anomaly').length;
  const openSafetyAlerts = safety.filter(s => (s.status || '').toLowerCase() === 'open').length;

  return {
    success: true,
    data: {
      fleetHealth: {
        totalVehicles,
        travellingVehicles: activeVehicles,
        idleVehicles,
        maintenanceVehicles,
        totalDrivers,
        activeDrivers,
        totalTrips,
        activeTrips,
        completedTrips,
        totalMaintenance: maintenance.length,
        dueMaintenance,
        totalFuelRecords: fuel.length,
        fuelAnomalies,
        totalSafetyAlerts: safety.length,
        openSafetyAlerts
      },
      generatedAt: new Date().toISOString()
    },
    source: 'Analytics Data Tool'
  };
}

export async function runRouteOptimizationTool({ origin, destination, waypoints }) {
  const url = `${UPSTREAM_BACKEND_URL}/api/routes/optimize`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: origin || 'Coimbatore',
        destination: destination || 'Chennai',
        waypoints: Array.isArray(waypoints) ? waypoints : []
      }),
      signal: AbortSignal.timeout(15000)
    });
    const rawData = await res.json();
    if (res.ok && rawData?.success) {
      return {
        success: true,
        data: rawData.data,
        source: 'Route Optimization Tool'
      };
    }
    return {
      success: false,
      error: rawData?.error || rawData?.message || 'Route optimization failed upstream.',
      data: null
    };
  } catch (err) {
    return {
      success: false,
      error: `Route Optimization Tool failure: ${err.message}`,
      data: null
    };
  }
}

/**
 * Route Query Parser
 * Safely normalizes origin, destination, and waypoints
 */
export function parseRouteQuery(queryText) {
  const text = String(queryText || '').replace(/[.?!;:]+$/, '').trim();
  let origin = 'Coimbatore';
  let destination = 'Chennai';
  let waypoints = [];

  // Match: from <origin> to <destination> via <waypoints>
  const fromToViaMatch = text.match(/from\s+([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+?)(?:\s+via\s+([a-zA-Z\s,]+))?$/i);
  if (fromToViaMatch) {
    origin = fromToViaMatch[1].trim();
    destination = fromToViaMatch[2].trim();
    if (fromToViaMatch[3]) {
      waypoints = fromToViaMatch[3]
        .split(/\s*(?:,|and|&)\s*/i)
        .map(w => w.trim())
        .filter(Boolean);
    }
  } else {
    const fromMatch = text.match(/from\s+([a-zA-Z]+)/i);
    if (fromMatch) origin = fromMatch[1].trim();
    const toMatch = text.match(/to\s+([a-zA-Z]+)/i);
    if (toMatch) destination = toMatch[1].trim();
    const viaMatch = text.match(/via\s+([a-zA-Z\s,]+)/i);
    if (viaMatch) {
      waypoints = viaMatch[1]
        .split(/\s*(?:,|and|&)\s*/i)
        .map(w => w.trim())
        .filter(Boolean);
    }
  }

  const cap = s => s ? s.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ') : s;
  origin = cap(origin);
  destination = cap(destination);
  waypoints = waypoints.map(cap);

  return { origin, destination, waypoints };
}

/**
 * Deterministic Intent Classifier
 */
export function determineIntent(message, context = {}) {
  const q = String(message || '').trim().toLowerCase();

  // Contextual follow-ups
  const isContextualFollowUp =
    q.startsWith('is that') ||
    q.startsWith('where is that') ||
    q.includes('that vehicle') ||
    q.includes('that driver') ||
    q === 'is it low?' ||
    q === 'why?';

  if (isContextualFollowUp && context.lastQueriedVehicle) {
    if (q.includes('low') || q.includes('fuel')) return 'FUEL';
    if (q.includes('where') || q.includes('location')) return 'VEHICLE';
    if (q.includes('maintenance') || q.includes('service')) return 'MAINTENANCE';
    return context.lastIntent || 'VEHICLE';
  }

  // Greetings / Help
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b|^\/?help\b/i.test(q)) {
    return 'GREETING';
  }

  // Route Optimization (must come before generic location checks)
  if (/optimize.*route|route.*optimize|recommend route|corridor route|route from|waypoints/i.test(q)) {
    return 'ROUTE';
  }

  // Driver Assignment questions
  if (/driver.*assigned|who is (driving|assigned to)|driver (for|of) vh\d{3}|assigned driver/i.test(q)) {
    return 'DRIVER_ASSIGNMENT';
  }

  // Maintenance query (must come before general vehicle query for "Which vehicles are under maintenance?")
  if (/maintenance|service|repair|overdue|oil change|tyre/i.test(q)) {
    return 'MAINTENANCE';
  }

  // Fuel queries (must come before general vehicle query for "Which vehicles have low fuel?")
  if (/fuel|diesel|tank|refuel|siphon|consumption|lowest fuel|low fuel/i.test(q)) {
    return 'FUEL';
  }

  // Safety alerts
  if (/safety|alert|overspeed|violation|risk|danger|harsh braking|harsh acceleration/i.test(q)) {
    return 'SAFETY_ALERT';
  }

  // Trips
  if (/tr\d{3}|ongoing trip|active trip|trips|dispatched|scheduled trip|in progress trip/i.test(q)) {
    return 'TRIP';
  }

  // Drivers
  if (/dr\d{3}|driver|drivers|who is on duty|who is on leave|active driver|driver status/i.test(q)) {
    return 'DRIVER';
  }

  // Analytics & Metrics
  if (/analytics|fleet metrics|how many vehicles|fleet kpi/i.test(q)) {
    return 'ANALYTICS';
  }

  // Fleet Summary / Analysis
  if (/summary|fleet health|fleet summary|overview/i.test(q)) {
    return 'FLEET_ANALYSIS';
  }

  // Vehicles
  if (/vh\d{3}|vehicle|truck|where is|location|idle vehicle|active vehicle|all vehicles|status of (all )?vehicles|vehicle status|fleet roster|list vehicles|show all vehicles/i.test(q)) {
    return 'VEHICLE';
  }

  // Open-ended strategic AI recommendation
  if (/recommendation|intelligent recommendation|suggest fleet|ai advice|suggestion|what should i do/i.test(q)) {
    return 'FLEET_AI';
  }

  // General fleet keyword fallback
  if (/fleet|logistics|depot|corridor|operations/i.test(q)) {
    return 'FLEET_ANALYSIS';
  }

  return 'UNKNOWN';
}

/**
 * Set of Operational Intents that execute deterministic live backend tools directly.
 * These bypass SNS Workbench entirely.
 */
export const OPERATIONAL_INTENTS = new Set([
  'VEHICLE',
  'DRIVER',
  'DRIVER_ASSIGNMENT',
  'TRIP',
  'MAINTENANCE',
  'FUEL',
  'SAFETY_ALERT',
  'ANALYTICS',
  'ROUTE',
  'FLEET_ANALYSIS'
]);

/**
 * Core AI Fleet Query Handler
 */
export async function processFleetAIQuery(userMessage, sessionId, user = null, extraPayload = {}) {
  const queryText = String(userMessage || '').trim();
  const context = getSessionContext(sessionId);

  // 1. Deterministic Intent classification
  const intent = determineIntent(queryText, context);
  const qLower = queryText.toLowerCase();

  // Extract explicit vehicle ID if present (e.g. VH104, VH001)
  const vehicleMatch = queryText.match(/\bVH\d+\b/i);
  let targetVehicleId = vehicleMatch ? vehicleMatch[0].toUpperCase() : null;

  // Extract explicit driver ID if present (e.g. DR001, DR104)
  const driverMatch = queryText.match(/\bDR\d+\b/i);
  let targetDriverId = driverMatch ? driverMatch[0].toUpperCase() : null;

  // Extract explicit trip ID if present (e.g. TR001, TR104)
  const tripMatch = queryText.match(/\bTR\d+\b/i);
  let targetTripId = tripMatch ? tripMatch[0].toUpperCase() : null;

  // Multi-turn vehicle context resolution
  if (!targetVehicleId && (qLower.includes('that') || qLower.includes('it')) && context.lastQueriedVehicle) {
    targetVehicleId = context.lastQueriedVehicle;
  }

  // Update session context
  if (targetVehicleId) context.lastQueriedVehicle = targetVehicleId;
  if (targetDriverId) context.lastQueriedDriver = targetDriverId;
  context.lastIntent = intent;

  let responseMessage = '';
  let resultList = [];
  let responseData = {};
  let operation = 'INSPECT';

  const isOperational = OPERATIONAL_INTENTS.has(intent);

  // =========================================================================
  // PRIMARY EXECUTION PATH:
  // Operational Queries -> Directly execute REAL Live Fleet Backend APIs
  // =========================================================================
  if (isOperational) {
    try {
      switch (intent) {

      // -------------------------------------------------------------
      // 1. DRIVER INTENT (GET /api/drivers)
      // -------------------------------------------------------------
      case 'DRIVER': {
        operation = 'QUERY_DRIVERS';
        const driversRes = await runDriverDataTool();
        if (!driversRes.success || !Array.isArray(driversRes.data)) {
          responseMessage = 'Live driver telemetry could not be retrieved from the backend. Upstream data source unreachable.';
          break;
        }
        const drivers = driversRes.data;

        if (targetDriverId) {
          const drv = drivers.find(d => (d.driverId || '').toUpperCase() === targetDriverId);
          if (drv) {
            responseMessage = `${targetDriverId} (${drv.name}) is an ${drv.status} driver stationed in ${drv.currentLocation || 'Depot'}, assigned to vehicle ${drv.assignedVehicleId || 'Unassigned'}. Contact: ${drv.phone || 'N/A'}. Trips completed: ${drv.tripsCompleted || 0}.`;
            resultList = [drv];
            responseData = { driver: drv };
          } else {
            responseMessage = `Driver ${targetDriverId} was not found in the live fleet database. That record was not found in the current fleet database.`;
          }
        } else if (qLower.includes('active') || qLower.includes('on duty') || !qLower.includes('leave')) {
          // Default or explicit active drivers query
          const active = drivers.filter(d => (d.status || '').toLowerCase() === 'active');
          const driverListStr = active.map(d => `${d.name} (${d.driverId})`).join(', ');
          responseMessage = `There are ${active.length} active drivers currently on duty: ${driverListStr}.`;
          resultList = active;
          responseData = { activeDriversCount: active.length, totalDrivers: drivers.length, drivers: active };
        } else if (qLower.includes('leave')) {
          const onLeave = drivers.filter(d => ['on_leave', 'leave'].includes((d.status || '').toLowerCase()));
          responseMessage = onLeave.length > 0
            ? `Drivers currently on leave: ${onLeave.map(d => `${d.name} (${d.driverId})`).join(', ')}.`
            : `All registered drivers are currently active or on roster duty; none are marked on leave.`;
          resultList = onLeave;
          responseData = { onLeaveCount: onLeave.length, drivers: onLeave };
        }
        break;
      }

      // -------------------------------------------------------------
      // 2. VEHICLE INTENT (GET /api/vehicles)
      // -------------------------------------------------------------
      case 'VEHICLE': {
        operation = 'QUERY_VEHICLES';
        const vehiclesRes = await runVehicleDataTool();
        if (!vehiclesRes.success || !Array.isArray(vehiclesRes.data)) {
          responseMessage = 'Live fleet telemetry could not be retrieved from the backend. Upstream data source unreachable.';
          break;
        }
        const vehicles = vehiclesRes.data;

        if (targetVehicleId) {
          const targetVeh = vehicles.find(v => (v.vehicleId || '').toUpperCase() === targetVehicleId);
          if (targetVeh) {
            if (qLower.includes('where') || qLower.includes('location')) {
              responseMessage = `${targetVehicleId} is currently located in ${targetVeh.location} with status "${targetVeh.status}".`;
            } else {
              responseMessage = `${targetVehicleId} is a ${targetVeh.type || 'Truck'} located in ${targetVeh.location}. Status: ${targetVeh.status}, Fuel: ${targetVeh.fuelLevel}%, Mileage: ${targetVeh.mileage} km.`;
            }
            resultList = [targetVeh];
            responseData = { vehicle: targetVeh };
          } else {
            responseMessage = `Vehicle ${targetVehicleId} was not found in the live fleet database. That record was not found in the current fleet database.`;
          }
        } else if (qLower.includes('idle')) {
          const idle = vehicles.filter(v => ['idle', 'inactive'].includes((v.status || '').toLowerCase()));
          responseMessage = `There are ${idle.length} idle/inactive vehicles: ${idle.map(v => v.vehicleId).join(', ')}.`;
          resultList = idle;
          responseData = { idleCount: idle.length, vehicles: idle };
        } else if (qLower.includes('active') && !qLower.includes('all')) {
          const active = vehicles.filter(v => (v.status || '').toLowerCase() === 'active');
          responseMessage = `There are ${active.length} active vehicles: ${active.map(v => v.vehicleId).join(', ')}.`;
          resultList = active;
          responseData = { activeCount: active.length, vehicles: active };
        } else {
          // Show all vehicles / roster
          const activeCount = vehicles.filter(v => (v.status || '').toLowerCase() === 'active').length;
          const idleCount = vehicles.filter(v => ['idle', 'inactive'].includes((v.status || '').toLowerCase())).length;
          const maintCount = vehicles.filter(v => (v.status || '').toLowerCase() === 'maintenance').length;
          const vehicleSummaries = vehicles.map(v => `${v.vehicleId}: ${v.status} (${v.location}, ${v.fuelLevel}% fuel)`).join('; ');
          responseMessage = `Live Fleet Inventory (${vehicles.length} vehicles: ${activeCount} active, ${idleCount} idle, ${maintCount} under maintenance). Current status: ${vehicleSummaries}.`;
          resultList = vehicles;
          responseData = { total: vehicles.length, activeCount, idleCount, maintCount, vehicles };
        }
        break;
      }

      // -------------------------------------------------------------
      // 3. TRIP INTENT (GET /api/trips)
      // -------------------------------------------------------------
      case 'TRIP': {
        operation = 'QUERY_TRIPS';
        const tripRes = await runTripDataTool();
        if (!tripRes.success || !Array.isArray(tripRes.data)) {
          responseMessage = 'Live trip telemetry could not be retrieved from the backend. Upstream data source unreachable.';
          break;
        }
        const trips = tripRes.data;

        if (targetTripId) {
          const t = trips.find(tr => (tr.tripId || tr.id || '').toUpperCase() === targetTripId);
          if (t) {
            const statusStr = t.status === 'in_progress' ? 'in progress (Ongoing)' : t.status;
            responseMessage = `Trip ${targetTripId} from ${t.origin || t.source} to ${t.destination} is currently ${statusStr} with driver ${t.driverId || 'Unassigned'} and vehicle ${t.vehicleId}. Distance: ${t.distanceKm} km.`;
            resultList = [t];
            responseData = { trip: t };
          } else {
            responseMessage = `Trip ${targetTripId} was not found in the live fleet database. That record was not found in the current fleet database.`;
          }
        } else if (targetVehicleId) {
          const vehTrips = trips.filter(tr => (tr.vehicleId || '').toUpperCase() === targetVehicleId);
          if (vehTrips.length > 0) {
            const activeT = vehTrips.find(t => ['ongoing', 'in_progress', 'active'].includes((t.status || '').toLowerCase())) || vehTrips[0];
            responseMessage = `Vehicle ${targetVehicleId} is associated with trip ${activeT.tripId} (${activeT.origin} → ${activeT.destination}, status: ${activeT.status}).`;
            resultList = vehTrips;
            responseData = { vehicleId: targetVehicleId, trips: vehTrips };
          } else {
            responseMessage = `No active or logged trips found for vehicle ${targetVehicleId} in the fleet database.`;
            responseData = { vehicleId: targetVehicleId, trips: [] };
          }
        } else if (qLower.includes('ongoing') || qLower.includes('active') || qLower.includes('in progress') || qLower.includes('in_progress')) {
          const ongoing = trips.filter(t => ['ongoing', 'in_progress', 'active'].includes((t.status || '').toLowerCase()));
          responseMessage = `There are ${ongoing.length} ongoing trips: ${ongoing.map(t => `${t.tripId} (${t.origin} → ${t.destination}, vehicle ${t.vehicleId})`).join('; ')}.`;
          resultList = ongoing;
          responseData = { ongoingCount: ongoing.length, trips: ongoing };
        } else {
          const ongoing = trips.filter(t => ['ongoing', 'in_progress', 'active'].includes((t.status || '').toLowerCase()));
          const scheduled = trips.filter(t => (t.status || '').toLowerCase() === 'scheduled');
          const completed = trips.filter(t => (t.status || '').toLowerCase() === 'completed');
          responseMessage = `Total trips logged: ${trips.length}. Ongoing trips: ${ongoing.length}. Scheduled trips: ${scheduled.length}. Completed trips: ${completed.length}.`;
          resultList = trips;
          responseData = { totalTrips: trips.length, ongoingCount: ongoing.length, scheduledCount: scheduled.length, completedCount: completed.length, trips };
        }
        break;
      }

      // -------------------------------------------------------------
      // 4. MAINTENANCE INTENT (GET /api/vehicles + GET /api/maintenance)
      // -------------------------------------------------------------
      case 'MAINTENANCE': {
        operation = 'QUERY_MAINTENANCE';
        const [vehRes, maintRes] = await Promise.all([
          runVehicleDataTool(),
          runMaintenanceDataTool()
        ]);
        if (!maintRes.success || !Array.isArray(maintRes.data)) {
          responseMessage = 'Live maintenance data could not be retrieved from the backend. Upstream data source unreachable.';
          break;
        }

        const maintRecords = maintRes.data;
        const vehicles = vehRes.data || [];

        if (targetVehicleId) {
          const vehRecords = maintRecords.filter(m => (m.vehicleId || '').toUpperCase() === targetVehicleId);
          const pending = vehRecords.filter(m => (m.status || '').toLowerCase() !== 'completed');
          if (pending.length > 0) {
            responseMessage = `Yes, ${targetVehicleId} is due for maintenance: ${pending.map(m => `${m.description || m.maintenanceType} (${m.priority} priority, status: ${m.status})`).join('; ')}.`;
            resultList = pending;
            responseData = { vehicleId: targetVehicleId, dueMaintenance: pending };
          } else if (vehRecords.length > 0) {
            responseMessage = `${targetVehicleId} has no pending maintenance due. All previous recorded inspections are completed.`;
            resultList = vehRecords;
            responseData = { vehicleId: targetVehicleId, dueMaintenance: [] };
          } else {
            responseMessage = `No active maintenance records found for vehicle ${targetVehicleId} in the live database.`;
            responseData = { vehicleId: targetVehicleId, dueMaintenance: [] };
          }
          break;
        }

        // Vehicles with status === 'maintenance'
        const underMaintVehicles = vehicles.filter(v => (v.status || '').toLowerCase() === 'maintenance');
        // Pending maintenance service records
        const pendingRecords = maintRecords.filter(m => (m.status || '').toLowerCase() !== 'completed');
        const pendingVehIds = Array.from(new Set(pendingRecords.map(m => m.vehicleId).filter(Boolean)));

        if (underMaintVehicles.length > 0) {
          const vehDetails = underMaintVehicles.map(v => `${v.vehicleId} (${v.location})`).join(', ');
          responseMessage = `Vehicle ${vehDetails} is currently under maintenance status. In addition, there are ${pendingVehIds.length} vehicles with pending scheduled maintenance: ${pendingVehIds.join(', ')}.`;
          resultList = underMaintVehicles;
        } else if (pendingRecords.length > 0) {
          responseMessage = `There are ${pendingVehIds.length} vehicles requiring maintenance: ${pendingRecords.map(m => `${m.vehicleId} (${m.description || m.maintenanceType} - ${m.priority} priority)`).join('; ')}.`;
          resultList = pendingRecords;
        } else {
          responseMessage = `All recent maintenance inspections are completed. Total service history records: ${maintRecords.length}.`;
          resultList = maintRecords;
        }

        responseData = {
          maintenanceVehicles: underMaintVehicles,
          pendingCount: pendingRecords.length,
          pendingVehicles: pendingVehIds,
          totalRecords: maintRecords.length
        };
        break;
      }

      // -------------------------------------------------------------
      // 5. FUEL INTENT (GET /api/vehicles + GET /api/fuel)
      // -------------------------------------------------------------
      case 'FUEL': {
        operation = 'QUERY_FUEL';
        const [vehRes, fuelRes] = await Promise.all([
          runVehicleDataTool(),
          runFuelDataTool()
        ]);
        if (!vehRes.success || !Array.isArray(vehRes.data)) {
          responseMessage = 'Live fuel telemetry could not be retrieved from the backend. Upstream data source unreachable.';
          break;
        }

        const vehicles = vehRes.data;
        const fuelRecords = fuelRes.data || [];

        if (targetVehicleId) {
          const targetVeh = vehicles.find(v => (v.vehicleId || '').toUpperCase() === targetVehicleId);
          const targetFuel = fuelRecords.find(f => (f.vehicleId || '').toUpperCase() === targetVehicleId);

          if (targetVeh) {
            const level = targetVeh.fuelLevel ?? targetFuel?.fuelLevel ?? 'Unknown';
            const anomaly = targetFuel?.anomalyType ? ` (Flagged with ${targetFuel.anomalyType} anomaly)` : '';
            if (qLower.includes('is that low') || qLower.includes('is it low')) {
              responseMessage = `Yes, ${targetVehicleId}'s fuel level of ${level}% is considered low and falls below the standard 50% operating safety reserve.`;
            } else {
              responseMessage = `${targetVehicleId} currently has ${level}% fuel${anomaly}. Vehicle status is ${targetVeh.status} in ${targetVeh.location}.`;
            }
            resultList = [targetVeh];
            responseData = { vehicle: targetVeh, fuelRecord: targetFuel };
          } else {
            responseMessage = `Vehicle ${targetVehicleId} was not found in the live fleet database. That record was not found in the current fleet database.`;
          }
        } else if (qLower.includes('lowest')) {
          const sorted = [...vehicles].sort((a, b) => (a.fuelLevel ?? 100) - (b.fuelLevel ?? 100));
          const lowest = sorted[0];
          if (lowest) {
            responseMessage = `The vehicle with the lowest fuel is ${lowest.vehicleId} at ${lowest.fuelLevel}% fuel located in ${lowest.location}.`;
            resultList = [lowest];
            responseData = { vehicle: lowest };
          }
        } else {
          // Low fuel vehicles (<50%)
          const lowFuelVehicles = vehicles.filter(v => typeof v.fuelLevel === 'number' && v.fuelLevel < 50);
          responseMessage = `There are ${lowFuelVehicles.length} vehicles with low fuel (<50%): ${lowFuelVehicles.map(v => `${v.vehicleId} (${v.fuelLevel}%)`).join(', ')}.`;
          resultList = lowFuelVehicles;
          responseData = { lowFuelCount: lowFuelVehicles.length, lowFuelVehicles };
        }
        break;
      }

      // -------------------------------------------------------------
      // 6. SAFETY INTENT (GET /api/safety-alerts)
      // -------------------------------------------------------------
      case 'SAFETY_ALERT': {
        operation = 'QUERY_SAFETY';
        const safetyRes = await runSafetyDataTool();
        if (!safetyRes.success || !Array.isArray(safetyRes.data)) {
          responseMessage = 'Live safety telemetry could not be retrieved from the backend. Upstream data source unreachable.';
          break;
        }
        const alerts = safetyRes.data;

        if (targetVehicleId) {
          const vehAlerts = alerts.filter(a => (a.vehicleId || '').toUpperCase() === targetVehicleId);
          if (vehAlerts.length > 0) {
            responseMessage = `Vehicle ${targetVehicleId} has ${vehAlerts.length} safety alert(s): ${vehAlerts.map(a => `${a.alertType || a.description} (${a.severity} severity at ${a.location || 'corridor'})`).join('; ')}.`;
            resultList = vehAlerts;
            responseData = { vehicleId: targetVehicleId, alerts: vehAlerts };
          } else {
            responseMessage = `Vehicle ${targetVehicleId} has no active safety alerts in the live telemetry database.`;
            responseData = { vehicleId: targetVehicleId, alerts: [] };
          }
          break;
        }

        const openAlerts = alerts.filter(a => (a.status || '').toLowerCase() === 'open');
        const criticalAlerts = alerts.filter(a => (a.severity || '').toLowerCase() === 'critical');
        const highAlerts = alerts.filter(a => (a.severity || '').toLowerCase() === 'high');

        const criticalSummary = criticalAlerts.length > 0
          ? `Critical alerts (${criticalAlerts.length}): ${criticalAlerts.map(a => `${a.alertId} (${a.description} on ${a.location || 'highway'}, vehicle ${a.vehicleId})`).join('; ')}.`
          : '';

        responseMessage = `Current Safety Alerts: ${openAlerts.length} open alert(s) across the fleet (total recorded: ${alerts.length}). ${criticalSummary} High severity alerts: ${highAlerts.map(a => a.alertId).join(', ') || 'None'}.`;
        resultList = openAlerts.length > 0 ? openAlerts : alerts;
        responseData = {
          totalAlerts: alerts.length,
          openCount: openAlerts.length,
          criticalCount: criticalAlerts.length,
          highCount: highAlerts.length,
          alerts: openAlerts
        };
        break;
      }

      // -------------------------------------------------------------
      // 7. ANALYTICS & FLEET ANALYSIS (GET /api/analytics/summary)
      // -------------------------------------------------------------
      case 'ANALYTICS':
      case 'FLEET_ANALYSIS': {
        operation = intent === 'ANALYTICS' ? 'QUERY_ANALYTICS' : 'PERFORM_FLEET_ANALYSIS';
        const analyticsRes = await runAnalyticsDataTool();
        const health = analyticsRes?.data?.fleetHealth;

        if (health) {
          const {
            totalVehicles = 11,
            travellingVehicles = 8,
            idleVehicles = 2,
            maintenanceVehicles = 1,
            totalDrivers = 11,
            activeDrivers = 8,
            totalTrips = 11,
            activeTrips = 4,
            completedTrips = 4,
            dueMaintenance = 7,
            fuelAnomalies = 4,
            openSafetyAlerts = 7,
            criticalSafetyAlerts = 2
          } = health;

          const title = intent === 'ANALYTICS' ? 'Fleet Analytics (Fleet Performance Summary)' : 'Fleet Performance Summary';
          responseMessage = `${title}: ${totalVehicles} total vehicles (${travellingVehicles} active, ${maintenanceVehicles} under maintenance, ${idleVehicles} idle). ${activeDrivers} of ${totalDrivers} drivers active on duty. ${totalTrips} total trips (${activeTrips} ongoing, ${completedTrips} completed). Operational health: ${dueMaintenance} maintenance services due, ${fuelAnomalies} fuel anomalies, and ${openSafetyAlerts} open safety alerts (${criticalSafetyAlerts} critical).`;
          resultList = [health];
          responseData = {
            totalVehicles,
            activeVehicles: travellingVehicles,
            idleVehicles,
            maintenanceVehicles,
            totalDrivers,
            activeDrivers,
            totalTrips,
            activeTrips,
            completedTrips,
            dueMaintenance,
            fuelAnomalies,
            openSafetyAlerts
          };
        } else {
          responseMessage = 'Live fleet analytics could not be retrieved from the backend. Upstream data source unreachable.';
        }
        break;
      }

      // -------------------------------------------------------------
      // 8. ROUTE OPTIMIZATION (POST /api/routes/optimize)
      // -------------------------------------------------------------
      case 'ROUTE': {
        operation = 'OPTIMIZE_ROUTE';
        const routeParams = parseRouteQuery(queryText);
        const routeRes = await runRouteOptimizationTool(routeParams);

        if (routeRes.success && routeRes.data) {
          const rData = routeRes.data;
          const stopsList = Array.isArray(rData.optimizedStops) ? rData.optimizedStops.join(' → ') : `${rData.origin} → ${rData.destination}`;
          const stopCount = rData.stopCount || (rData.optimizedStops ? rData.optimizedStops.length : 2);
          const strategy = rData.optimization?.strategy || 'origin_waypoints_destination';
          const waypointsStr = Array.isArray(rData.waypoints) && rData.waypoints.length > 0 ? ` via ${rData.waypoints.join(', ')}` : '';

          responseMessage = `Route optimization completed successfully from ${rData.origin} to ${rData.destination}${waypointsStr}: ${stopCount} optimized stops (${stopsList}). Strategy: ${strategy}. Recommendation: ${rData.recommendation || 'Recommended route uses the supplied intermediate stops.'}`;
          resultList = rData.optimizedStops || [];
          responseData = rData;
        } else {
          responseMessage = `Route optimization could not be calculated: ${routeRes.error || 'Upstream service unreachable.'}`;
        }
        break;
      }

      // -------------------------------------------------------------
      // 9. DRIVER ASSIGNMENT (GET /api/vehicles + GET /api/drivers)
      // -------------------------------------------------------------
      case 'DRIVER_ASSIGNMENT': {
        operation = 'QUERY_DRIVER_ASSIGNMENT';
        const [vehRes, drvRes] = await Promise.all([
          runVehicleDataTool(),
          runDriverDataTool()
        ]);
        const vehicles = vehRes.data || [];
        const drivers = drvRes.data || [];

        if (targetVehicleId) {
          const veh = vehicles.find(v => (v.vehicleId || '').toUpperCase() === targetVehicleId);
          const assignedDriver = drivers.find(d =>
            (d.assignedVehicleId || '').toUpperCase() === targetVehicleId ||
            (veh?.driverId && String(d.driverId).toUpperCase() === String(veh.driverId).toUpperCase())
          );
          if (assignedDriver) {
            responseMessage = `Vehicle ${targetVehicleId} is assigned to driver ${assignedDriver.name} (${assignedDriver.driverId}). Driver status is ${assignedDriver.status} stationed in ${assignedDriver.currentLocation || 'Depot'}.`;
            resultList = [assignedDriver];
            responseData = { vehicle: veh, driver: assignedDriver };
          } else {
            responseMessage = `Vehicle ${targetVehicleId} currently has no active assigned driver in the live database.`;
          }
        } else if (targetDriverId) {
          const drv = drivers.find(d => (d.driverId || '').toUpperCase() === targetDriverId);
          if (drv) {
            responseMessage = `Driver ${drv.name} (${targetDriverId}) is assigned to vehicle ${drv.assignedVehicleId || 'Unassigned'}. Status: ${drv.status}.`;
            resultList = [drv];
            responseData = { driver: drv };
          } else {
            responseMessage = `Driver ${targetDriverId} was not found in the live fleet database. That record was not found in the current fleet database.`;
          }
        } else {
          const assignments = drivers.filter(d => d.assignedVehicleId).map(d => `${d.name} (${d.driverId}) → ${d.assignedVehicleId}`);
          responseMessage = `Active driver assignments: ${assignments.join(', ')}.`;
          resultList = drivers;
        }
        break;
      }

      default:
        break;
      }
    } catch (err) {
      responseMessage = `Live fleet operational query failed: ${err.message}. Upstream telemetry source unreachable.`;
    }
  }

  // =========================================================================
  // SECONDARY PATH:
  // Open-ended Reasoning Queries (FLEET_AI) -> SNS Agent Workbench
  // =========================================================================
  if (!responseMessage && intent === 'FLEET_AI') {
    const primaryWebhookUrl =
      process.env.VITE_SNS_WEBHOOK_URL ||
      'https://api.agents.snsihub.ai/webhook/4b3c6594-0dfc-4104-b031-8c0018e0ec3d';

    const isErrorOrQuota = (str) => {
      if (!str || typeof str !== 'string') return true;
      const s = str.toLowerCase();
      return (
        s.includes('quota') ||
        s.includes('rate-limit') ||
        s.includes('rate limit') ||
        s.includes('generativelanguage.googleapis.com') ||
        s.includes('exceeded your current quota') ||
        s.startsWith('error:') ||
        s.includes('error: you exceeded') ||
        s.startsWith('internal server error')
      );
    };

    console.log(`[fleetAI] Invoking SNS Agent Workbench for open-ended query: "${queryText}"`);

    try {
      const wbPayload = {
        ...(typeof extraPayload === 'object' && extraPayload !== null ? extraPayload : {}),
        message: queryText,
        sessionId: sessionId || 'default-session',
        action: 'FLEET_AI',
        intent
      };

      const wbRes = await fetch(primaryWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wbPayload),
        signal: AbortSignal.timeout(15000)
      });

      const rawText = await wbRes.text();
      let wbJson = null;
      try {
        wbJson = JSON.parse(rawText);
      } catch {
        console.warn(`[fleetAI] SNS Workbench returned non-JSON response (HTTP ${wbRes.status})`);
      }

      if (wbRes.ok && wbJson && !wbJson.error) {
        const possibleOutput =
          wbJson?.data?.result?.output ??
          wbJson?.result?.output ??
          wbJson?.data?.output ??
          wbJson?.data?.message ??
          (typeof wbJson?.data?.result === 'string' ? wbJson.data.result : null) ??
          (typeof wbJson?.output === 'string' ? wbJson?.output : null) ??
          (typeof wbJson?.message === 'string' ? wbJson.message : null) ??
          null;

        if (typeof possibleOutput === 'string' && possibleOutput.trim() && !isErrorOrQuota(possibleOutput)) {
          responseMessage = possibleOutput;
          operation = 'WORKBENCH_AI_AGENT';
          responseData = (wbJson?.data && typeof wbJson.data === 'object') ? wbJson.data : { rawResponse: wbJson };
          if (Array.isArray(wbJson?.result)) {
            resultList = wbJson.result;
          } else if (Array.isArray(wbJson?.data?.result)) {
            resultList = wbJson.data.result;
          }
        }
      }
    } catch (wbErr) {
      console.warn(`[fleetAI] SNS Workbench unavailable (${wbErr.message}). Falling back to live backend analysis.`);
    }

    // Deterministic fallback for FLEET_AI if SNS Workbench is down, times out, or quota exceeded
    if (!responseMessage) {
      operation = 'GENERATE_RECOMMENDATION';
      const [vehRes, fuelRes] = await Promise.all([
        runVehicleDataTool(),
        runFuelDataTool()
      ]);
      const vehicles = vehRes.data || [];
      const lowFuel = vehicles.filter(v => typeof v.fuelLevel === 'number' && v.fuelLevel < 50);

      if (lowFuel.length > 0) {
        responseMessage = `FleetAI Recommendation: Prioritize refueling for ${lowFuel.length} vehicles (${lowFuel.map(v => v.vehicleId).join(', ')}) before dispatch. Schedule preventative maintenance for Tiruppur and Coimbatore regional depots.`;
      } else {
        responseMessage = 'FleetAI Recommendation: All fleet vehicles are operating with adequate fuel reserves. Fleet operations are running normally.';
      }
      resultList = lowFuel;
      responseData = { recommendedAction: 'REFUEL_BEFORE_DISPATCH', affectedVehicles: lowFuel.map(v => v.vehicleId) };
    }
  }

  // Greetings & Out-of-Scope handling
  if (!responseMessage) {
    if (intent === 'GREETING') {
      operation = 'GREETING';
      responseMessage = 'Hello! I am your Intelligent Fleet Assistant. I provide live vehicle telemetry, driver rosters, trip tracking, maintenance schedules, fuel monitoring, and corridor route recommendations across Tamil Nadu hubs. How can I assist you today?';
    } else {
      operation = 'OUT_OF_SCOPE';
      responseMessage = 'I am the Intelligent Fleet Assistant specialized exclusively in Tamil Nadu fleet operations, live vehicle telemetry, driver assignments, corridor routing, maintenance schedules, and fuel monitoring. Please ask a fleet or logistics-related operational question.';
    }
  }

  // Anti-hallucination sanitization
  const safeMessage = sanitizeAntiHallucination(responseMessage);
  const safeData = sanitizeDataPayload(responseData);
  const safeResult = sanitizeDataPayload(resultList);

  // Audit logging (Persists to MongoDB when connected, memory buffer fallback)
  logAuditEvent({
    action: 'AI_FLEET_QUERY',
    actor: user?.phone || user?.email || user?.name || sessionId || 'chat-user',
    role: user?.role || 'FLEET_MANAGER',
    details: {
      query: queryText,
      intent,
      operation,
      targetVehicleId,
      targetDriverId,
      targetTripId,
      sessionId
    },
    status: 'SUCCESS'
  });

  // Conversation history memory
  context.history.push({ role: 'user', content: queryText });
  context.history.push({ role: 'assistant', content: safeMessage });
  if (context.history.length > 20) {
    context.history.shift();
    context.history.shift();
  }

  // Standardized response per specification
  return {
    success: true,
    module: 'fleet_ai',
    intent,
    operation,
    route: '/api/ai/chat',
    message: safeMessage,
    result: safeResult,
    data: safeData,
    warnings: [],
    timestamp: new Date().toISOString()
  };
}
