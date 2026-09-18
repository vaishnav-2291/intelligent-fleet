import { 
  TOWN_COORDINATES, 
  getTownLatLng, 
  getCorridorDistanceKm, 
  getEstimatedDuration,
  DURATION_MATRIX 
} from '../data/mockData';
import cachedCorridors from './cachedCorridors.js';

/**
 * Predefined popular corridor routes for rapid logistics selection
 */
export const CORRIDOR_PRESETS = [
  {
    id: 'kongu-ring',
    name: 'Kongu Industrial Ring',
    origin: 'Erode',
    destination: 'Coimbatore',
    waypoints: ['Tiruppur'],
    description: 'High-volume textile and manufacturing corridor via NH 544'
  },
  {
    id: 'central-trunk',
    name: 'Central Trunk Corridor',
    origin: 'Salem',
    destination: 'Karur',
    waypoints: ['Namakkal'],
    description: 'Heavy cargo transit route linking northern & central hubs'
  },
  {
    id: 'express-corridor',
    name: 'Metropolitan Express Corridor',
    origin: 'Coimbatore',
    destination: 'Chennai',
    waypoints: ['Tiruppur', 'Salem'],
    description: 'Primary cross-state highway logistics arterial via NH 544 & NH 44'
  },
  {
    id: 'southern-link',
    name: 'Southern Logistics Link',
    origin: 'Coimbatore',
    destination: 'Dindigul',
    waypoints: ['Karur'],
    description: 'Southern agricultural & industrial transport link'
  }
];

/**
 * Format minutes into readable "Xh Ym" or "Ym"
 */
export const formatDurationMinutes = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return '30m';
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins.toString().padStart(2, '0')}m` : `${hrs}h 00m`;
  }
  return `${mins}m`;
};

/**
 * Resolves coordinate pair from various formats into { lon, lat, coordStr, name }
 */
export const resolveStopCoords = (stop) => {
  if (!stop) return null;

  // Format: [lat, lng] array
  if (Array.isArray(stop) && stop.length >= 2 && typeof stop[0] === 'number' && typeof stop[1] === 'number') {
    const lat = stop[0];
    const lon = stop[1];
    return { lon, lat, coordStr: `${lon},${lat}`, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
  }

  // Format: { lat, lng } or { latitude, longitude } object
  if (typeof stop === 'object') {
    const lat = stop.lat ?? stop.latitude;
    const lon = stop.lng ?? stop.longitude ?? stop.lon;
    const name = stop.name || stop.label || stop.id || `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`;
    if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
      return { lon, lat, coordStr: `${lon},${lat}`, name };
    }
  }

  // Format: Town name string (e.g. "Coimbatore", "Salem")
  const stopStr = String(stop?.name || stop || '').trim();
  const exactKey = Object.keys(TOWN_COORDINATES).find(
    (k) => k.toLowerCase() === stopStr.toLowerCase()
  );

  if (exactKey && TOWN_COORDINATES[exactKey]) {
    const parts = TOWN_COORDINATES[exactKey].split(',').map((p) => parseFloat(p.trim()));
    const [lon, lat] = parts;
    return { lon, lat, coordStr: TOWN_COORDINATES[exactKey], name: exactKey };
  }

  return null;
};

const matrixCache = new Map();
const routeCache = new Map();

// Pre-seed routeCache with authoritative high-density OSRM road geometry for primary corridors
if (cachedCorridors && typeof cachedCorridors === 'object') {
  for (const [key, val] of Object.entries(cachedCorridors)) {
    routeCache.set(key, val);
  }
}

/**
 * Fetches real road-distance and travel-duration matrix from OSRM Table API.
 * Falls back deterministically to highway corridor distance matrix if offline.
 */
export const fetchRoadDistanceMatrix = async (stops = [], options = {}) => {
  if (!stops || stops.length < 2) {
    return { success: false, distances: [], durations: [], isFallback: true };
  }

  const resolved = stops.map(resolveStopCoords);
  const allResolved = resolved.every(Boolean);

  if (allResolved) {
    const coordsParam = resolved.map((r) => r.coordStr).join(';');
    if (matrixCache.has(coordsParam) && !options?.bypassCache && !options?.signal?.aborted) {
      return matrixCache.get(coordsParam);
    }

    const osrmTableUrl = `https://router.project-osrm.org/table/v1/driving/${coordsParam}?annotations=distance,duration`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs || 5000);

      if (options?.signal) {
        options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      const res = await fetch(osrmTableUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'IntelligentFleetManagement/1.0' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && Array.isArray(data.distances) && Array.isArray(data.durations)) {
          const result = {
            success: true,
            distances: data.distances, // in meters
            durations: data.durations, // in seconds
            isFallback: false
          };
          matrixCache.set(coordsParam, result);
          return result;
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Deterministic Corridor Fallback Matrix
  const n = stops.length;
  const distances = Array.from({ length: n }, () => Array(n).fill(0));
  const durations = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const s1 = stops[i]?.name || stops[i];
      const s2 = stops[j]?.name || stops[j];
      const distKm = getCorridorDistanceKm(s1, s2) || 50;
      distances[i][j] = distKm * 1000; // convert km to meters

      const durStr = DURATION_MATRIX[`${s1}-${s2}`] || getEstimatedDuration(s1, s2);
      let minutes = 60;
      const match = durStr.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
      if (match) {
        const h = parseInt(match[1] || '0', 10);
        const m = parseInt(match[2] || '0', 10);
        minutes = h * 60 + m;
      }
      durations[i][j] = minutes * 60; // convert minutes to seconds
    }
  }

  const fallbackResult = {
    success: true,
    distances,
    durations,
    isFallback: true
  };
  if (allResolved) {
    const coordsParam = resolved.map((r) => r.coordStr).join(';');
    matrixCache.set(coordsParam, fallbackResult);
  }
  return fallbackResult;
};

/**
 * Solves optimal stop sequence for intermediate waypoints using distance & time minimization.
 * - Origin is fixed at the start
 * - Destination is fixed at the end
 * - Intermediate waypoints are ordered to achieve minimum total road distance
 * - Uses exact permutations for N <= 7, and deterministic 2-opt for N > 7.
 */
export const solveOptimalStopSequence = async (origin, destination, waypoints = [], options = {}) => {
  if (!waypoints || waypoints.length <= 1) {
    return {
      orderedWaypoints: [...waypoints],
      initialDistanceKm: 0,
      optimizedDistanceKm: 0,
      savedKm: 0,
      improvementPct: 0,
      initialDuration: '0m',
      optimizedDuration: '0m',
      savedMinutes: 0,
      legs: [],
      isOptimized: false,
      usedRoadMatrix: false
    };
  }

  const allStops = [origin, ...waypoints, destination];
  const matrixResult = await fetchRoadDistanceMatrix(allStops, options);
  const distances = matrixResult.distances;
  const durations = matrixResult.durations;

  // Helper to calculate total road distance & duration for an ordering of intermediate indices
  // Index 0 is Origin, Index allStops.length - 1 is Destination
  const destIndex = allStops.length - 1;

  const evaluateSequence = (intermediateIndices) => {
    let totalMeters = 0;
    let totalSeconds = 0;
    const fullIndices = [0, ...intermediateIndices, destIndex];

    for (let i = 0; i < fullIndices.length - 1; i++) {
      const fromIdx = fullIndices[i];
      const toIdx = fullIndices[i + 1];
      totalMeters += distances[fromIdx]?.[toIdx] ?? 50000;
      totalSeconds += durations[fromIdx]?.[toIdx] ?? 3600;
    }

    return { totalMeters, totalSeconds };
  };

  const initialIndices = waypoints.map((_, i) => i + 1);
  const initialEval = evaluateSequence(initialIndices);

  let bestIndices = [...initialIndices];
  let minMeters = initialEval.totalMeters;
  let bestSeconds = initialEval.totalSeconds;

  // Exact Permutation Search for N <= 7 (N! <= 5040)
  if (waypoints.length <= 7) {
    const permute = (arr) => {
      if (arr.length <= 1) return [arr];
      const res = [];
      for (let i = 0; i < arr.length; i++) {
        const cur = arr[i];
        const rem = arr.slice(0, i).concat(arr.slice(i + 1));
        const subPerms = permute(rem);
        for (const sp of subPerms) {
          res.push([cur, ...sp]);
        }
      }
      return res;
    };

    const allPermutations = permute(initialIndices);
    for (const perm of allPermutations) {
      const { totalMeters, totalSeconds } = evaluateSequence(perm);
      if (totalMeters < minMeters) {
        minMeters = totalMeters;
        bestSeconds = totalSeconds;
        bestIndices = perm;
      }
    }
  } else {
    // Deterministic 2-Opt Local Search for N > 7
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < bestIndices.length - 1; i++) {
        for (let k = i + 1; k < bestIndices.length; k++) {
          const newIndices = [
            ...bestIndices.slice(0, i),
            ...bestIndices.slice(i, k + 1).reverse(),
            ...bestIndices.slice(k + 1)
          ];
          const { totalMeters, totalSeconds } = evaluateSequence(newIndices);
          if (totalMeters < minMeters) {
            minMeters = totalMeters;
            bestSeconds = totalSeconds;
            bestIndices = newIndices;
            improved = true;
          }
        }
      }
    }
  }

  const orderedWaypoints = bestIndices.map((idx) => waypoints[idx - 1]);
  const initialDistanceKm = Number((initialEval.totalMeters / 1000).toFixed(1));
  const optimizedDistanceKm = Number((minMeters / 1000).toFixed(1));
  const savedKm = Math.max(0, Number((initialDistanceKm - optimizedDistanceKm).toFixed(1)));
  const improvementPct = initialDistanceKm > 0 ? Math.round((savedKm / initialDistanceKm) * 100) : 0;

  const initialMinutes = Math.round(initialEval.totalSeconds / 60);
  const optimizedMinutes = Math.round(bestSeconds / 60);
  const savedMinutes = Math.max(0, initialMinutes - optimizedMinutes);

  // Per-leg road telemetry details
  const finalFullIndices = [0, ...bestIndices, destIndex];
  const legs = [];
  for (let i = 0; i < finalFullIndices.length - 1; i++) {
    const fromIdx = finalFullIndices[i];
    const toIdx = finalFullIndices[i + 1];
    const fromName = allStops[fromIdx]?.name || allStops[fromIdx];
    const toName = allStops[toIdx]?.name || allStops[toIdx];
    const legMeters = distances[fromIdx]?.[toIdx] ?? 50000;
    const legSec = durations[fromIdx]?.[toIdx] ?? 3600;

    legs.push({
      from: fromName,
      to: toName,
      distanceKm: Number((legMeters / 1000).toFixed(1)),
      duration: formatDurationMinutes(Math.round(legSec / 60))
    });
  }

  return {
    orderedWaypoints,
    initialDistanceKm,
    optimizedDistanceKm,
    savedKm,
    improvementPct,
    initialDuration: formatDurationMinutes(initialMinutes),
    optimizedDuration: formatDurationMinutes(optimizedMinutes),
    savedMinutes,
    legs,
    isOptimized: savedKm > 0,
    usedRoadMatrix: !matrixResult.isFallback
  };
};

/**
 * Fetches actual road-following highway geometry from OSRM routing engine.
 * Converts coordinates into high-density polyline points for Leaflet.
 * When OSRM fails or times out, returns routeGeometry: null without drawing straight lines.
 */
export const getRoadFollowingRoute = async (origin, destination, waypoints = [], options = {}) => {
  if (!origin || !destination) {
    return {
      success: false,
      routeGeometry: null,
      distanceKm: 0,
      duration: '0m',
      statusSource: 'Pending Selection',
      isRoadFollowing: false,
      legs: []
    };
  }

  // Combine stops in order: Origin -> Waypoints -> Destination
  const rawStops = [origin, ...waypoints, destination];
  const stopSequence = [];
  for (const s of rawStops) {
    const name = typeof s === 'object' ? (s.name || s.label || s.id || `${s.lat},${s.lng}`) : String(s || '').trim();
    if (name && (stopSequence.length === 0 || stopSequence[stopSequence.length - 1].toLowerCase() !== name.toLowerCase())) {
      stopSequence.push(name);
    }
  }

  // Resolve coordinate strings for OSRM
  const coordinateStrings = [];
  for (const stop of rawStops) {
    const resolved = resolveStopCoords(stop);
    if (resolved) {
      coordinateStrings.push(resolved.coordStr);
    }
  }

  if (coordinateStrings.length < 2) {
    return buildFallbackRoute(origin, destination, waypoints, 'Insufficient Coordinate Points');
  }

  try {
    const coordsParam = coordinateStrings.join(';');
    if (routeCache.has(coordsParam) && !options?.bypassCache && !options?.signal?.aborted) {
      return routeCache.get(coordsParam);
    }

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs || 15000);

    if (options?.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        return { aborted: true };
      }
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const response = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'IntelligentFleetManagement/1.0' }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM API error HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const rawCoords = primaryRoute.geometry?.coordinates || [];

      // OSRM returns GeoJSON coordinates as [longitude, latitude]
      // Leaflet requires [latitude, longitude]
      const leafletGeometry = rawCoords.map(([lon, lat]) => [lat, lon]);

      const distanceKm = Number((primaryRoute.distance / 1000).toFixed(1));
      const durationMinutes = Math.round(primaryRoute.duration / 60);
      const durationFormatted = formatDurationMinutes(durationMinutes);

      // Extract per-leg road telemetry
      const legs = (primaryRoute.legs || []).map((leg, idx) => {
        const fromStop = stopSequence[idx] || 'Stop';
        const toStop = stopSequence[idx + 1] || 'Stop';
        return {
          from: fromStop,
          to: toStop,
          distanceKm: Number((leg.distance / 1000).toFixed(1)),
          duration: formatDurationMinutes(Math.round(leg.duration / 60))
        };
      });

      const result = {
        success: true,
        routeGeometry: leafletGeometry,
        distanceKm,
        duration: durationFormatted,
        durationMinutes,
        statusSource: 'OSRM Highway Telemetry (NH 544 / Active Corridor)',
        isRoadFollowing: true,
        legs,
        stopSequence,
        pointCount: leafletGeometry.length
      };
      routeCache.set(coordsParam, result);
      return result;
    } else {
      throw new Error(`OSRM returned non-Ok code: ${data.code}`);
    }
  } catch (err) {
    if (options?.signal?.aborted || err?.name === 'AbortError') {
      return { aborted: true };
    }
    // Graceful offline fallback WITHOUT drawing straight lines
    return buildFallbackRoute(origin, destination, waypoints, err.message);
  }
};

/**
 * Builds clean offline fallback: calculates corridor metrics but DOES NOT draw straight lines.
 */
const buildFallbackRoute = (origin, destination, waypoints = [], errorReason = '') => {
  const fullStops = [origin, ...waypoints, destination];
  let totalDist = 0;
  let totalMinutes = 0;
  const legs = [];

  for (let i = 0; i < fullStops.length - 1; i++) {
    const s1 = typeof fullStops[i] === 'object' ? (fullStops[i].name || 'Stop') : fullStops[i];
    const s2 = typeof fullStops[i + 1] === 'object' ? (fullStops[i + 1].name || 'Stop') : fullStops[i + 1];

    const legDist = getCorridorDistanceKm(s1, s2) || 50;
    totalDist += legDist;

    const legDurationStr = DURATION_MATRIX[`${s1}-${s2}`] || getEstimatedDuration(s1, s2);
    let legMin = 60;
    const match = legDurationStr.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
    if (match) {
      const h = parseInt(match[1] || '0', 10);
      const m = parseInt(match[2] || '0', 10);
      legMin = h * 60 + m;
    }
    totalMinutes += legMin;

    legs.push({
      from: s1,
      to: s2,
      distanceKm: legDist,
      duration: legDurationStr
    });
  }

  return {
    success: false,
    routeGeometry: null, // Strictly NULL: do not draw fake straight lines
    distanceKm: totalDist,
    duration: formatDurationMinutes(totalMinutes),
    durationMinutes: totalMinutes,
    statusSource: 'Routing Service Unavailable (Offline / Timeout)',
    isRoadFollowing: false,
    legs,
    stopSequence: fullStops.map(s => (typeof s === 'object' ? (s.name || s.label || 'Stop') : s)),
    pointCount: 0,
    error: errorReason
  };
};
