// Sample Towns in Tamil Nadu logistics corridor
export const SAMPLE_TOWNS = [
  "Erode",
  "Coimbatore",
  "Salem",
  "Tiruppur",
  "Karur",
  "Namakkal",
  "Dindigul",
  "Chennai",
  "Madurai",
  "Trichy"
];

// Exact Lon,Lat Coordinates for OSRM & Mapping Routing Engines
export const TOWN_COORDINATES = {
  "Erode": "77.7172,11.3410",
  "Coimbatore": "76.9558,11.0168",
  "Salem": "78.1460,11.6643",
  "Tiruppur": "77.3411,11.1085",
  "Karur": "78.0816,10.9601",
  "Namakkal": "78.1674,11.2189",
  "Dindigul": "77.9803,10.3673",
  "Chennai": "80.2707,13.0827",
  "Madurai": "78.1198,9.9252",
  "Trichy": "78.7047,10.7905"
};

// Deterministic Demo Coordinate Provenance
export const DEMO_COORDINATES_PROVENANCE = 'MOCK_DEMO';

// Realistic Deterministic Demo Coordinates for Vehicles
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

// Realistic Deterministic Demo Coordinates for Drivers
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

// Distance & Duration Matrix lookup
export const DURATION_MATRIX = {
  "Erode-Coimbatore": "1h 45m",
  "Coimbatore-Erode": "1h 45m",
  "Erode-Salem": "1h 15m",
  "Salem-Erode": "1h 15m",
  "Erode-Tiruppur": "0h 50m",
  "Tiruppur-Erode": "0h 50m",
  "Erode-Karur": "1h 10m",
  "Karur-Erode": "1h 10m",
  "Erode-Namakkal": "1h 20m",
  "Namakkal-Erode": "1h 20m",
  "Erode-Dindigul": "2h 30m",
  "Dindigul-Erode": "2h 30m",

  "Coimbatore-Salem": "2h 45m",
  "Salem-Coimbatore": "2h 45m",
  "Coimbatore-Tiruppur": "1h 00m",
  "Tiruppur-Coimbatore": "1h 00m",
  "Coimbatore-Karur": "2h 15m",
  "Karur-Coimbatore": "2h 15m",
  "Coimbatore-Namakkal": "2h 50m",
  "Namakkal-Coimbatore": "2h 50m",
  "Coimbatore-Dindigul": "3h 10m",
  "Dindigul-Coimbatore": "3h 10m",

  "Salem-Tiruppur": "2h 00m",
  "Tiruppur-Salem": "2h 00m",
  "Salem-Karur": "1h 40m",
  "Karur-Salem": "1h 40m",
  "Salem-Namakkal": "0h 55m",
  "Namakkal-Salem": "0h 55m",
  "Salem-Dindigul": "2h 40m",
  "Dindigul-Salem": "2h 40m",

  "Tiruppur-Karur": "1h 30m",
  "Karur-Tiruppur": "1h 30m",
  "Tiruppur-Namakkal": "1h 45m",
  "Namakkal-Tiruppur": "1h 45m",

  "Karur-Namakkal": "0h 45m",
  "Namakkal-Karur": "0h 45m",
  "Karur-Dindigul": "1h 20m",
  "Dindigul-Karur": "1h 20m",
  "Namakkal-Dindigul": "1h 50m",
  "Dindigul-Namakkal": "1h 50m",

  "Coimbatore-Chennai": "8h 15m",
  "Chennai-Coimbatore": "8h 15m",
  "Erode-Chennai": "7h 30m",
  "Chennai-Erode": "7h 30m",
  "Salem-Chennai": "5h 45m",
  "Chennai-Salem": "5h 45m",
  "Tiruppur-Chennai": "7h 50m",
  "Chennai-Tiruppur": "7h 50m",
  "Karur-Chennai": "6h 45m",
  "Chennai-Karur": "6h 45m",
  "Namakkal-Chennai": "6h 15m",
  "Chennai-Namakkal": "6h 15m",
  "Dindigul-Chennai": "7h 20m",
  "Chennai-Dindigul": "7h 20m"
};

export const getEstimatedDuration = (source, destination) => {
  if (!source || !destination || source === destination) return "30m (Local)";
  const key = `${source}-${destination}`;
  if (DURATION_MATRIX[key]) return DURATION_MATRIX[key];

  // Fallback: estimate using straight-line corridor distance at ~55 km/h truck speed
  const dist = getCorridorDistanceKm(source, destination);
  if (dist && dist > 0) {
    const totalMinutes = Math.round((dist / 55) * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return hrs > 0 ? `${hrs}h ${mins.toString().padStart(2, '0')}m` : `${mins}m`;
  }

  return "1h 30m";
};

/**
 * Returns [latitude, longitude] array for Leaflet from TOWN_COORDINATES.
 * TOWN_COORDINATES stores "longitude,latitude".
 * Leaflet requires [latitude, longitude].
 */
export const getTownLatLng = (town) => {
  if (!town) return null;
  const exactKey = Object.keys(TOWN_COORDINATES).find(
    (k) => k.toLowerCase() === String(town).trim().toLowerCase()
  );
  const coordStr = exactKey ? TOWN_COORDINATES[exactKey] : null;
  if (!coordStr) return null;

  const parts = coordStr.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;

  const [lng, lat] = parts;
  return [lat, lng];
};

/**
 * Computes great-circle (Haversine) distance between two towns in km.
 */
export const getCorridorDistanceKm = (origin, destination) => {
  const p1 = getTownLatLng(origin);
  const p2 = getTownLatLng(destination);
  if (!p1 || !p2) return null;

  const [lat1, lon1] = p1;
  const [lat2, lon2] = p2;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};
