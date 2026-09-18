import React, { useEffect, useRef, useState, useMemo, useId, useCallback } from 'react';
import L from 'leaflet';
import { 
  getTownLatLng, 
  getCorridorDistanceKm, 
  getEstimatedDuration 
} from '../../data/mockData';
import { 
  Navigation, 
  Clock, 
  AlertCircle, 
  Compass, 
  Plus, 
  Minus, 
  Maximize2, 
  Minimize2,
  Layers, 
  RotateCw, 
  Eye
} from 'lucide-react';

// Fix Leaflet's default icon paths to eliminate any 404 image requests
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/images/marker-icon-2x.png',
  iconUrl: '/images/marker-icon.png',
  shadowUrl: '/images/marker-shadow.png',
});

/**
 * Resolves coordinate pair from various formats:
 * - [lat, lng] array
 * - { lat, lng } or { latitude, longitude } object
 * - town name string (e.g. "Coimbatore", "Madurai")
 */
export const resolvePointCoords = (point) => {
  if (!point) return null;
  if (Array.isArray(point) && point.length >= 2 && typeof point[0] === 'number' && typeof point[1] === 'number') {
    return [point[0], point[1]];
  }
  if (typeof point === 'object') {
    const lat = point.lat ?? point.latitude;
    const lng = point.lng ?? point.longitude;
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      return [lat, lng];
    }
  }
  const str = String(point?.name || point || '').trim();
  return getTownLatLng(str);
};

// Basemap configurations with verified high-contrast road styling
const BASEMAPS = {
  voyager: {
    name: 'Road Navigation',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
    detectRetina: true
  },
  dark: {
    name: 'Dark Operations',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
    detectRetina: true
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 19
  }
};

/**
 * Micro-offset coordinate disambiguation for co-located entities (e.g. dense fleet depots)
 * Avoids stacking markers directly on top of each other while preserving geographical truth.
 */
const getDisambiguatedLatLng = (lat, lng, index, totalAtCoord) => {
  if (totalAtCoord <= 1) return [lat, lng];
  const angle = (2 * Math.PI * index) / totalAtCoord;
  // ~35 meters offset in degrees for visual separation
  const radius = 0.00035;
  return [
    lat + radius * Math.cos(angle),
    lng + radius * Math.sin(angle)
  ];
};

/**
 * InteractiveFleetMap
 * 
 * Interactive Leaflet map component for Intelligent Fleet Management:
 * - High-clarity road-map base tiles (CartoDB Voyager / Dark Matter / OSM)
 * - Layered high-visibility active route highway lines (#00D2FF & #070A12)
 * - Distinct vehicle markers for travelling, idle, maintenance, and alert
 * - Clear monospace vehicle ID labels with live fuel status
 * - Distinct driver GPS markers with live beacon wave rings
 * - Origin (A), Destination (B), and numbered Waypoint markers (#1, #2...)
 * - Rich live data popup cards with honest provenance & telemetry
 * - Smooth camera focus (flyTo) on vehicle/driver selection
 * - Auto-fit route bounds on corridor updates
 * - In-place marker updates without layer destruction during background polling
 * - Anti-overlap layout for dense depot locations
 * - Modern floating controls & compact status legend
 * - Fullscreen toggle for expanded viewport visibility
 * - Robust loading, empty, and error states
 */
export const InteractiveFleetMap = ({
  origin,
  destination,
  waypoints = [],
  routeGeometry = null,
  duration = null,
  distanceKm = null,
  statusSource = null,
  vehicles = [],
  drivers = [],
  highlightedEntity = null,
  onSelectVehicle = null,
  onSelectDriver = null,
  showVehicles = true,
  showDrivers = true,
  className = '',
  height = '100%',
  interactive = true,
  showHud = true,
  loading = false,
  error = null,
  onRetry = null,
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const polylineGroupRef = useRef(null);
  const stationsGroupRef = useRef(null);
  const fleetGroupRef = useRef(null);
  const lastFittedBoundsKeyRef = useRef('');
  
  // Cache for existing markers to allow seamless in-place updates during polling
  const vehicleMarkersMapRef = useRef(new Map());
  const driverMarkersMapRef = useRef(new Map());

  const [activeBasemap, setActiveBasemap] = useState('voyager'); // 'voyager' | 'dark' | 'osm'
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const uniqueId = useId().replace(/:/g, '_');
  const isStraightLineFallback = !(Array.isArray(routeGeometry) && routeGeometry.length > 1);

  // Derived coordinates
  const originLatLng = useMemo(() => resolvePointCoords(origin), [origin]);
  const destLatLng = useMemo(() => resolvePointCoords(destination), [destination]);

  const waypointLatLngs = useMemo(() => {
    return Array.isArray(waypoints)
      ? waypoints.map(resolvePointCoords).filter(Boolean)
      : [];
  }, [waypoints]);

  // Derived distance & duration
  const calculatedDistance = (typeof distanceKm === 'number' && distanceKm > 0)
    ? distanceKm
    : (typeof origin === 'string' && typeof destination === 'string' ? getCorridorDistanceKm(origin, destination) : null);

  const calculatedDuration = duration || (typeof origin === 'string' && typeof destination === 'string' ? getEstimatedDuration(origin, destination) : '1h 30m');

  // Stable callback refs
  const onSelectVehicleRef = useRef(onSelectVehicle);
  onSelectVehicleRef.current = onSelectVehicle;
  const onSelectDriverRef = useRef(onSelectDriver);
  onSelectDriverRef.current = onSelectDriver;

  // 1. Initialize Leaflet Map Instance Once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const defaultCenter = [11.1271, 78.6569];
    const defaultZoom = 7;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false, // Custom floating controls
      closePopupOnClick: false, // Keeps popups open during route and bounds updates
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      dragging: interactive,
      touchZoom: interactive,
      attributionControl: false,
    });

    const basemapConfig = BASEMAPS[activeBasemap] || BASEMAPS.voyager;
    const tileLayer = L.tileLayer(basemapConfig.url, {
      maxZoom: basemapConfig.maxZoom || 19,
      subdomains: basemapConfig.subdomains || 'abcd',
      attribution: basemapConfig.attribution,
      detectRetina: Boolean(basemapConfig.detectRetina),
      referrerPolicy: 'no-referrer',
    }).addTo(map);

    tileLayer.on('tileerror', () => {
      // Non-fatal tile retry handling
    });

    tileLayerRef.current = tileLayer;
    polylineGroupRef.current = L.layerGroup().addTo(map);
    stationsGroupRef.current = L.layerGroup().addTo(map);
    fleetGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    resizeObserver.observe(mapContainerRef.current);

    const t = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(t);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        polylineGroupRef.current = null;
        stationsGroupRef.current = null;
        fleetGroupRef.current = null;
        vehicleMarkersMapRef.current.clear();
        driverMarkersMapRef.current.clear();
      }
    };
  }, [interactive]);

  // Invalidate map size whenever fullscreen toggles
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen]);

  // Handle Basemap Switch smoothly
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const basemapConfig = BASEMAPS[activeBasemap] || BASEMAPS.voyager;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const newTileLayer = L.tileLayer(basemapConfig.url, {
      maxZoom: basemapConfig.maxZoom || 19,
      subdomains: basemapConfig.subdomains || 'abcd',
      attribution: basemapConfig.attribution,
      detectRetina: Boolean(basemapConfig.detectRetina),
      referrerPolicy: 'no-referrer',
    }).addTo(map);

    newTileLayer.on('tileerror', () => {
      // Non-fatal
    });

    // Ensure tile layer stays beneath routes and markers
    newTileLayer.bringToBack();
    tileLayerRef.current = newTileLayer;
  }, [activeBasemap]);

  // 2a. Render Corridor Stations (Origin Hub, Destination Terminal, Waypoints)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = stationsGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const boundsPoints = [];

    // A. Origin Marker (Dispatch Hub A - Emerald)
    if (originLatLng) {
      const originLabel = typeof origin === 'object' ? (origin.label || origin.name || 'Origin Hub') : (origin || 'Origin Hub');
      const originIcon = L.divIcon({
        className: 'custom-fleet-marker origin-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" data-testid="origin-marker" data-origin-hub="${originLabel}" style="width: 36px; height: 36px;">
            <span class="pointer-events-none absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40 animate-ping"></span>
            <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#111114] border-2 border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.7)] transition-transform group-hover:scale-110">
              <span class="text-[13px] font-black text-emerald-300 font-mono tracking-tighter">A</span>
            </div>
            <span class="pointer-events-none absolute -bottom-6 px-2 py-0.5 rounded-md bg-[#0D0D0F]/95 text-[9px] font-extrabold text-emerald-300 border border-emerald-500/60 shadow-xl tracking-wide whitespace-nowrap z-20">
              START: ${originLabel}
            </span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const originMarker = L.marker(originLatLng, { icon: originIcon, zIndexOffset: 500 });
      originMarker.bindPopup(`
        <div class="fleet-popup-card" style="width: 290px; max-width: calc(100vw - 40px); background: #111114; border-radius: 12px; color: #F5F5F5; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box;">
          <div style="padding: 12px 14px 10px 14px; border-bottom: 1px solid #222228; display: flex; align-items: center; justify-content: space-between; padding-right: 32px;">
            <strong style="color: #10B981; font-size: 14px; font-weight: 700;">Origin Dispatch Hub (A)</strong>
            <span style="font-size: 10px; font-weight: 700; color: #34D399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 6px; border-radius: 4px;">HUB A</span>
          </div>
          <div style="padding: 10px 14px 12px 14px; display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
              <span style="color: #A1A1AA; font-weight: 500; min-width: 90px; flex-shrink: 0;">Location:</span>
              <span style="color: #FFFFFF; font-weight: 600; text-align: right;">${originLabel}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
              <span style="color: #A1A1AA; font-weight: 500; min-width: 90px; flex-shrink: 0;">Role:</span>
              <span style="color: #FFFFFF; font-weight: 600; text-align: right;">Corridor Departure Station</span>
            </div>
          </div>
        </div>
      `, { maxWidth: 320, minWidth: 280, autoPan: true, autoPanPaddingTopLeft: [70, 110], autoPanPaddingBottomRight: [70, 70] });
      
      originMarker.addTo(group);
      boundsPoints.push(originLatLng);
    }

    // B. Destination Marker (Delivery Station B - Cyan)
    if (destLatLng) {
      const destLabel = typeof destination === 'object' ? (destination.label || destination.name || 'Destination') : (destination || 'Destination');
      const destIcon = L.divIcon({
        className: 'custom-fleet-marker destination-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" data-testid="destination-marker" data-destination-terminal="${destLabel}" style="width: 36px; height: 36px;">
            <span class="pointer-events-none absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-40 animate-ping"></span>
            <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#111114] border-2 border-cyan-400 shadow-[0_0_14px_rgba(0,210,255,0.7)] transition-transform group-hover:scale-110">
              <span class="text-[13px] font-black text-cyan-300 font-mono tracking-tighter">B</span>
            </div>
            <span class="pointer-events-none absolute -bottom-6 px-2 py-0.5 rounded-md bg-[#0D0D0F]/95 text-[9px] font-extrabold text-cyan-300 border border-cyan-500/60 shadow-xl tracking-wide whitespace-nowrap z-20">
              DEST: ${destLabel}
            </span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const destMarker = L.marker(destLatLng, { icon: destIcon, zIndexOffset: 500 });
      destMarker.bindPopup(`
        <div class="fleet-popup-card" style="width: 290px; max-width: calc(100vw - 40px); background: #111114; border-radius: 12px; color: #F5F5F5; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box;">
          <div style="padding: 12px 14px 10px 14px; border-bottom: 1px solid #222228; display: flex; align-items: center; justify-content: space-between; padding-right: 32px;">
            <strong style="color: #38BDF8; font-size: 14px; font-weight: 700;">Final Destination Terminal (B)</strong>
            <span style="font-size: 10px; font-weight: 700; color: #38BDF8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); padding: 1px 6px; border-radius: 4px;">TERM B</span>
          </div>
          <div style="padding: 10px 14px 12px 14px; display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
              <span style="color: #A1A1AA; font-weight: 500; min-width: 90px; flex-shrink: 0;">Location:</span>
              <span style="color: #FFFFFF; font-weight: 600; text-align: right;">${destLabel}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
              <span style="color: #A1A1AA; font-weight: 500; min-width: 90px; flex-shrink: 0;">Role:</span>
              <span style="color: #FFFFFF; font-weight: 600; text-align: right;">Corridor Delivery Station</span>
            </div>
          </div>
        </div>
      `, { maxWidth: 320, minWidth: 280, autoPan: true, autoPanPaddingTopLeft: [70, 110], autoPanPaddingBottomRight: [70, 70] });

      destMarker.addTo(group);
      boundsPoints.push(destLatLng);
    }

    // C. Waypoint Markers (#1, #2... - Amber)
    waypointLatLngs.forEach((latLng, idx) => {
      const stopNum = idx + 1;
      const wpName = Array.isArray(waypoints) && waypoints[idx]
        ? (typeof waypoints[idx] === 'string' ? waypoints[idx] : waypoints[idx]?.name || `Stop ${stopNum}`)
        : `Stop ${stopNum}`;

      const wpIcon = L.divIcon({
        className: 'custom-fleet-marker waypoint-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" data-testid="waypoint-marker" data-waypoint-index="${stopNum}" data-stop-number="${stopNum}" style="width: 32px; height: 32px;">
            <span class="pointer-events-none absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-40 animate-ping"></span>
            <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-[#111114] border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.7)] transition-transform group-hover:scale-110">
              <span class="text-[11px] font-black text-amber-300 font-mono">${stopNum}</span>
            </div>
            <span class="pointer-events-none absolute -bottom-6 px-2 py-0.5 rounded-md bg-[#0D0D0F]/95 text-[9px] font-extrabold text-amber-300 border border-amber-500/60 shadow-xl tracking-wide whitespace-nowrap z-20">
              #${stopNum}: ${wpName}
            </span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const wpMarker = L.marker(latLng, { icon: wpIcon, zIndexOffset: 450 });
      wpMarker.bindPopup(`
        <div class="fleet-popup-card" style="width: 290px; max-width: calc(100vw - 40px); background: #111114; border-radius: 12px; color: #F5F5F5; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box;">
          <div style="padding: 12px 14px 10px 14px; border-bottom: 1px solid #222228; display: flex; align-items: center; justify-content: space-between; padding-right: 32px;">
            <strong style="color: #F59E0B; font-size: 14px; font-weight: 700;">Intermediate Stop #${stopNum}</strong>
            <span style="font-size: 10px; font-weight: 700; color: #FBBF24; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); padding: 1px 6px; border-radius: 4px;">#${stopNum}</span>
          </div>
          <div style="padding: 10px 14px 12px 14px; display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
              <span style="color: #A1A1AA; font-weight: 500; min-width: 90px; flex-shrink: 0;">Station:</span>
              <span style="color: #FFFFFF; font-weight: 600; text-align: right;">${wpName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
              <span style="color: #A1A1AA; font-weight: 500; min-width: 90px; flex-shrink: 0;">Stop Sequence:</span>
              <span style="color: #FBBF24; font-weight: 700; text-align: right;">#${stopNum} in Optimized Order</span>
            </div>
          </div>
        </div>
      `, { maxWidth: 320, minWidth: 280, autoPan: true, autoPanPaddingTopLeft: [70, 110], autoPanPaddingBottomRight: [70, 70] });

      wpMarker.addTo(group);
      boundsPoints.push(latLng);
    });

    // Auto-fit route bounds with balanced padding on corridor station change
    if (boundsPoints.length > 1 && !highlightedEntity) {
      const boundsKey = boundsPoints.map(p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(';');
      if (boundsKey !== lastFittedBoundsKeyRef.current) {
        lastFittedBoundsKeyRef.current = boundsKey;
        const bounds = L.latLngBounds(boundsPoints);
        map.fitBounds(bounds, {
          paddingTopLeft: [70, 110],
          paddingBottomRight: [70, 70],
          maxZoom: 14,
          animate: false,
        });
      }
    } else if (boundsPoints.length === 1 && !highlightedEntity) {
      map.setView(boundsPoints[0], 12, { animate: false });
    }
  }, [
    origin,
    destination,
    waypoints,
    originLatLng,
    destLatLng,
    waypointLatLngs,
  ]);

  // 2b. Render Active Route Highway Polyline (only redraws line without touching station markers)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = polylineGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (Array.isArray(routeGeometry) && routeGeometry.length > 1) {
      const polylinePoints = routeGeometry;

      // Layer 0: Ambient soft cyan glow halo
      L.polyline(polylinePoints, {
        color: '#00D2FF',
        weight: 16,
        opacity: 0.25,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);

      // Layer 1: Dark high-contrast casing underneath the route
      L.polyline(polylinePoints, {
        color: '#070A12',
        weight: 10,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);

      // Layer 2: Core primary bright cyan/blue enterprise highway route
      const mainLine = L.polyline(polylinePoints, {
        color: '#00D2FF',
        weight: 6,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round',
      });
      mainLine.addTo(group);

      // Layer 3: Inner crisp navigation highway centerline highlight
      L.polyline(polylinePoints, {
        color: '#E0F7FE',
        weight: 2,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);

      mainLine.bindTooltip(
        'Optimized Road-Following Highway Geometry (OSRM)',
        { sticky: true, className: 'leaflet-dark-tooltip' }
      );
    }
  }, [routeGeometry]);

  // Helper to construct Vehicle DivIcon HTML
  const createVehicleIcon = useCallback((vId, status, fuel, isSelected) => {
    const rawStatus = (status || 'idle').toLowerCase();
    const isMaintenance = rawStatus === 'maintenance';
    const isTravelling = rawStatus === 'travelling' || rawStatus === 'active' || rawStatus === 'on_trip';
    const isAlert = rawStatus === 'alert' || fuel < 20;

    let markerColor = '#3B82F6'; // Standby Blue
    let pingClass = '';
    // Distinct SVG icons for each operational state:
    // Travelling: fast moving freight truck
    // Standby: parked vehicle
    // Maintenance: mechanical wrench
    // Alert: hazard warning triangle
    let iconSvg = `
      <rect x="2" y="4" width="20" height="13" rx="2"></rect>
      <path d="M7 17v2M17 17v2"></path>
      <line x1="2" y1="12" x2="22" y2="12"></line>
    `;

    if (isAlert) {
      markerColor = '#EF4444'; // Red alert
      pingClass = 'bg-red-500 animate-ping opacity-60';
      iconSvg = `
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      `;
    } else if (isMaintenance) {
      markerColor = '#F59E0B'; // Amber
      pingClass = 'bg-amber-400 opacity-30';
      iconSvg = `
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
      `;
    } else if (isTravelling) {
      markerColor = '#10B981'; // Emerald
      pingClass = 'bg-emerald-400 animate-ping opacity-45';
      iconSvg = `
        <rect x="1" y="3" width="15" height="13" rx="2"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5"></circle>
        <circle cx="18.5" cy="18.5" r="2.5"></circle>
      `;
    }

    const selectedRing = isSelected ? 'ring-4 ring-cyan-400 ring-offset-2 ring-offset-[#0D0D0F]' : '';
    const fuelBadgeColor = fuel < 25 ? 'text-red-400' : fuel < 60 ? 'text-amber-300' : 'text-emerald-300';

    return L.divIcon({
      className: `custom-fleet-marker vehicle-marker ${isSelected ? 'selected-vehicle' : ''}`,
      html: `
        <div class="relative flex items-center justify-center cursor-pointer group" data-vehicle-id="${vId}" data-vehicle-status="${rawStatus}" style="width: 36px; height: 36px;">
          ${pingClass ? `<span class="pointer-events-none absolute inline-flex h-full w-full rounded-2xl ${pingClass}"></span>` : ''}
          <div class="relative flex items-center justify-center w-8 h-8 rounded-xl bg-[#111114] border-2 shadow-2xl transition-transform group-hover:scale-110 ${selectedRing}" style="border-color: ${markerColor};">
            <svg class="w-4 h-4" style="color: ${markerColor};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${iconSvg}
            </svg>
          </div>
          <span class="pointer-events-none absolute -bottom-5 px-1.5 py-0.5 rounded-md bg-[#0D0D0F]/95 text-[9px] font-mono font-black text-white border border-[#2A2A2E] shadow-xl whitespace-nowrap z-20 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full inline-block" style="background-color: ${markerColor};"></span>
            <span>${vId}</span>
            <span class="${fuelBadgeColor} font-sans">• ${fuel}%</span>
          </span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }, []);

  // Helper to construct Vehicle Popup Content HTML
  const createVehiclePopupHtml = useCallback((veh, lat, lng) => {
    const vId = veh.vehicleId || veh.id || 'VH';
    const rawStatus = (veh.status || 'Active').toLowerCase();
    const fuel = veh.fuel_level ?? veh.fuelLevel ?? 80;
    const isMaintenance = rawStatus === 'maintenance';
    const isAlert = rawStatus === 'alert' || fuel < 20;
    const isTrueGps = veh.coordinatesSource === 'LIVE_GPS';
    const isManual = veh.coordinatesSource === 'MANUAL';
    
    // Internal provenance mapping: NEVER display forbidden labels like 'MOCK_DEMO'
    const vehProvenanceLabel = isTrueGps ? 'LIVE_GPS' : isManual ? 'MANUAL' : 'Operational Location';
    const displayVehStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);

    let vehStatusBadgeBg = 'rgba(16, 185, 129, 0.15)';
    let vehStatusBadgeText = '#34D399';
    let vehStatusBadgeBorder = 'rgba(16, 185, 129, 0.35)';
    let vehStatusDotColor = '#10B981';

    if (isAlert) {
      vehStatusBadgeBg = 'rgba(239, 68, 68, 0.15)';
      vehStatusBadgeText = '#F87171';
      vehStatusBadgeBorder = 'rgba(239, 68, 68, 0.35)';
      vehStatusDotColor = '#EF4444';
    } else if (isMaintenance) {
      vehStatusBadgeBg = 'rgba(245, 158, 11, 0.15)';
      vehStatusBadgeText = '#FBBF24';
      vehStatusBadgeBorder = 'rgba(245, 158, 11, 0.35)';
      vehStatusDotColor = '#F59E0B';
    } else if (rawStatus === 'inactive' || rawStatus === 'offline') {
      vehStatusBadgeBg = 'rgba(148, 163, 184, 0.15)';
      vehStatusBadgeText = '#94A3B8';
      vehStatusBadgeBorder = 'rgba(148, 163, 184, 0.35)';
      vehStatusDotColor = '#94A3B8';
    }

    const fuelColor = fuel < 25 ? '#F87171' : fuel < 60 ? '#FBBF24' : '#34D399';
    const regNumber = veh.registrationNumber || veh.reg_no || 'TN Commercial';
    const assignedDriver = veh.assigned_driver_id || veh.driverId || 'Unassigned';
    const formattedTimestamp = veh.locationTimestamp 
      ? new Date(veh.locationTimestamp).toLocaleString() 
      : (veh.updatedAt ? new Date(veh.updatedAt).toLocaleString() : 'N/A');
    const displayLocation = veh.currentLocation || veh.location || 'Hub Station';

    return `
      <div class="fleet-popup-card" style="width: 310px; max-width: calc(100vw - 40px); background: #111114; border-radius: 12px; color: #F5F5F5; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box;">
        <div style="padding: 12px 14px 10px 14px; border-bottom: 1px solid #222228; display: flex; flex-direction: column; gap: 6px; padding-right: 32px;">
          <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 15px; font-weight: 700; color: #38BDF8; letter-spacing: -0.01em;">${vId}</span>
            <span style="font-size: 11px; font-weight: 600; color: #A1A1AA; background: #1A1A20; border: 1px solid #2E2E36; padding: 1px 6px; border-radius: 4px;">${regNumber}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 9999px; background: ${vehStatusBadgeBg}; color: ${vehStatusBadgeText}; border: 1px solid ${vehStatusBadgeBorder}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: ${vehStatusDotColor}; display: inline-block;"></span>
              ${displayVehStatus}
            </span>
            <span style="font-size: 10.5px; font-weight: 700; color: ${fuelColor};">Fuel: ${fuel}%</span>
          </div>
        </div>

        <div style="padding: 10px 14px 12px 14px; display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Vehicle ID:</span>
            <span style="color: #FFFFFF; font-weight: 600; text-align: right;">${vId}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Registration:</span>
            <span style="color: #FFFFFF; font-weight: 600; text-align: right;">${regNumber}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Status:</span>
            <span style="color: ${vehStatusBadgeText}; font-weight: 600; text-align: right; text-transform: capitalize;">${displayVehStatus}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Fuel Level:</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="width: 50px; height: 6px; border-radius: 3px; background: #222228; overflow: hidden;">
                <div style="width: ${fuel}%; height: 100%; background: ${fuelColor};"></div>
              </div>
              <span style="color: ${fuelColor}; font-weight: 700; text-align: right;">${fuel}%</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Driver:</span>
            <span style="color: #FFFFFF; font-weight: 600; text-align: right;">${assignedDriver}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Current Location:</span>
            <span style="color: #FFFFFF; font-weight: 600; text-align: right;">${displayLocation}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Coordinates:</span>
            <span style="color: #FFFFFF; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-variant-numeric: tabular-nums; text-align: right;">Latitude: ${lat.toFixed(4)}, Longitude: ${lng.toFixed(4)}</span>
          </div>

          <div style="height: 1px; background: #222228; margin: 4px 0;"></div>

          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; font-size: 11px;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Coordinate Source:</span>
            <span style="color: ${isTrueGps ? '#34D399' : isManual ? '#38BDF8' : '#D1D5DB'}; font-weight: 600; text-align: right;">${vehProvenanceLabel}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; font-size: 11px;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Provenance:</span>
            <span style="color: ${isTrueGps ? '#34D399' : isManual ? '#38BDF8' : '#D1D5DB'}; font-weight: 600; text-align: right;">${vehProvenanceLabel}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; font-size: 11px;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Location Timestamp:</span>
            <span style="color: #D1D5DB; font-weight: 500; text-align: right; font-size: 10.5px;">${formattedTimestamp}</span>
          </div>
        </div>
      </div>
    `;
  }, []);

  // Helper to construct Driver DivIcon HTML
  const createDriverIcon = useCallback((dId, name, isMobileGps, isActive, isSelected) => {
    const pulseColor = isMobileGps ? 'bg-cyan-400' : 'bg-emerald-400';
    const borderColor = isMobileGps ? 'border-cyan-400' : 'border-emerald-400';
    const badgeTextColor = isMobileGps ? 'text-cyan-300' : 'text-emerald-300';
    const badgeBorderColor = isMobileGps ? 'border-cyan-800/40' : 'border-emerald-800/40';
    const borderRing = isSelected ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-[#0D0D0F]' : '';

    return L.divIcon({
      className: `custom-fleet-marker driver-marker ${isSelected ? 'selected-driver' : ''}`,
      html: `
        <div class="relative flex items-center justify-center cursor-pointer group" data-testid="driver-marker" data-driver-id="${dId}" style="width: 34px; height: 34px;">
          <span class="pointer-events-none absolute inline-flex h-full w-full rounded-full ${pulseColor} opacity-40 ${isActive || isMobileGps ? 'animate-ping' : ''}"></span>
          <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-[#111114] border-2 ${borderColor} shadow-xl transition-transform group-hover:scale-110 ${borderRing}">
            <span class="text-[10px] font-black ${badgeTextColor} font-mono">${dId.replace(/\D/g, '') || 'D'}</span>
          </div>
          <span class="pointer-events-none absolute -bottom-5 px-1.5 py-0.5 rounded-md bg-[#0D0D0F]/95 text-[9px] font-bold ${badgeTextColor} border ${badgeBorderColor} shadow-lg whitespace-nowrap z-20 flex items-center gap-1">
            <span>${name.split(' ')[0]}</span>
            ${isMobileGps ? '<span class="text-[9px]">📡</span>' : ''}
          </span>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }, []);

  // Helper to construct Driver Popup Content HTML
  const createDriverPopupHtml = useCallback((drv, lat, lng) => {
    const dId = drv.driverId || drv.id || 'DR';
    const name = drv.name || `Driver ${dId}`;
    const rawStatus = (drv.status || 'Active').toLowerCase();
    const isMobileGps = drv.coordinatesSource === 'MOBILE_GPS';
    const drvProvenanceLabel = isMobileGps ? 'Live Device GPS' : 'Operational Location';
    const displayStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);

    let statusBadgeBg = 'rgba(16, 185, 129, 0.15)';
    let statusBadgeText = '#34D399';
    let statusBadgeBorder = 'rgba(16, 185, 129, 0.35)';
    let statusDotColor = '#10B981';

    if (rawStatus === 'maintenance') {
      statusBadgeBg = 'rgba(245, 158, 11, 0.15)';
      statusBadgeText = '#FBBF24';
      statusBadgeBorder = 'rgba(245, 158, 11, 0.35)';
      statusDotColor = '#F59E0B';
    } else if (rawStatus === 'inactive' || rawStatus === 'offline') {
      statusBadgeBg = 'rgba(239, 68, 68, 0.15)';
      statusBadgeText = '#F87171';
      statusBadgeBorder = 'rgba(239, 68, 68, 0.35)';
      statusDotColor = '#EF4444';
    }

    const titleAccent = isMobileGps ? '#06B6D4' : '#10B981';
    const drvTimestamp = drv.locationTimestamp 
      ? new Date(drv.locationTimestamp).toLocaleString() 
      : (drv.updatedAt ? new Date(drv.updatedAt).toLocaleString() : 'N/A');
    const driverDisplayLocation = drv.self_reported_location || drv.currentLocation || 'Assigned Depot';

    return `
      <div class="fleet-popup-card" style="width: 310px; max-width: calc(100vw - 40px); background: #111114; border-radius: 12px; color: #F5F5F5; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box;">
        <div style="padding: 12px 14px 10px 14px; border-bottom: 1px solid #222228; display: flex; flex-direction: column; gap: 6px; padding-right: 32px;">
          <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 15px; font-weight: 700; color: ${titleAccent}; letter-spacing: -0.01em;">${name}</span>
            <span style="font-size: 11px; font-weight: 600; color: #A1A1AA; background: #1A1A20; border: 1px solid #2E2E36; padding: 1px 6px; border-radius: 4px;">(${dId})</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 9999px; background: ${statusBadgeBg}; color: ${statusBadgeText}; border: 1px solid ${statusBadgeBorder}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusDotColor}; display: inline-block;"></span>
              ${displayStatus}
            </span>
            ${isMobileGps ? '<span style="font-size: 9.5px; padding: 2px 6px; border-radius: 4px; background: rgba(6, 182, 212, 0.18); color: #38BDF8; font-weight: 700; border: 1px solid rgba(6, 182, 212, 0.35); text-transform: uppercase;">Live Device GPS</span>' : ''}
          </div>
        </div>

        <div style="padding: 10px 14px 12px 14px; display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Driver ID:</span>
            <span style="color: #FFFFFF; font-weight: 600; text-align: right;">${dId}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Name:</span>
            <span style="color: #FFFFFF; font-weight: 600; text-align: right;">${name}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Status:</span>
            <span style="color: ${statusBadgeText}; font-weight: 600; text-align: right; text-transform: capitalize;">${displayStatus}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Vehicle:</span>
            <span style="color: #FFFFFF; font-weight: 600; text-align: right;">${drv.assigned_vehicle_id || drv.assignedVehicleId || 'Standby'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Current Location:</span>
            <span style="color: #FFFFFF; font-weight: 600; text-align: right;">${driverDisplayLocation}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Coordinates:</span>
            <span style="color: #FFFFFF; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-variant-numeric: tabular-nums; text-align: right;">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
          </div>

          <div style="height: 1px; background: #222228; margin: 4px 0;"></div>

          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; font-size: 11px;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Coordinate Source:</span>
            <span style="color: ${isMobileGps ? '#38BDF8' : '#D1D5DB'}; font-weight: 600; text-align: right;">${drvProvenanceLabel}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; font-size: 11px;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Provenance:</span>
            <span style="color: ${isMobileGps ? '#38BDF8' : '#D1D5DB'}; font-weight: 600; text-align: right;">${drvProvenanceLabel}</span>
          </div>
          ${(typeof drv.accuracy === 'number' && !isNaN(drv.accuracy)) ? `
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; font-size: 11px;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Accuracy:</span>
            <span style="color: #FFFFFF; font-weight: 600; text-align: right;">±${drv.accuracy}m</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; font-size: 11px;">
            <span style="color: #A1A1AA; font-weight: 500; min-width: 105px; flex-shrink: 0;">Location Timestamp:</span>
            <span style="color: #D1D5DB; font-weight: 500; text-align: right; font-size: 10.5px;">${drvTimestamp}</span>
          </div>
        </div>
      </div>
    `;
  }, []);

  // 3. Render Fleet Telemetry Markers with In-Place Updates (Zero Layer Flashing During Polling)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = fleetGroupRef.current;
    if (!map || !group) return;

    let markerToFocus = null;

    // Cluster coordination map to prevent exact marker stacking
    const coordOccurrences = new Map();

    // First pass: count entities at identical coordinate cells
    if (showVehicles && Array.isArray(vehicles)) {
      vehicles.forEach(v => {
        const lat = v.latitude ?? v.lat;
        const lng = v.longitude ?? v.lng;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
          const key = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
          coordOccurrences.set(key, (coordOccurrences.get(key) || 0) + 1);
        }
      });
    }
    if (showDrivers && Array.isArray(drivers)) {
      drivers.forEach(d => {
        const lat = d.latitude ?? d.lat;
        const lng = d.longitude ?? d.lng;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
          const key = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
          coordOccurrences.set(key, (coordOccurrences.get(key) || 0) + 1);
        }
      });
    }

    const coordIndexCounter = new Map();

    // D. In-place Vehicle Markers Update
    const currentVehicleIds = new Set();
    if (showVehicles && Array.isArray(vehicles)) {
      vehicles.forEach((veh) => {
        const rawLat = veh.latitude ?? veh.lat;
        const rawLng = veh.longitude ?? veh.lng;
        if (typeof rawLat !== 'number' || typeof rawLng !== 'number' || isNaN(rawLat) || isNaN(rawLng)) return;

        const vId = veh.vehicleId || veh.id || 'VH';
        currentVehicleIds.add(vId);

        const status = (veh.status || 'idle').toLowerCase();
        const fuel = veh.fuel_level ?? veh.fuelLevel ?? 80;
        const isSelected = Boolean(
          highlightedEntity && (
            highlightedEntity.id === vId ||
            highlightedEntity.vehicleId === vId ||
            (highlightedEntity.type === 'vehicle' && String(highlightedEntity.id).toLowerCase() === String(vId).toLowerCase())
          )
        );

        // Disambiguate co-located markers
        const coordKey = `${rawLat.toFixed(3)}_${rawLng.toFixed(3)}`;
        const totalAtCoord = coordOccurrences.get(coordKey) || 1;
        const currentIndex = coordIndexCounter.get(coordKey) || 0;
        coordIndexCounter.set(coordKey, currentIndex + 1);

        const [lat, lng] = getDisambiguatedLatLng(rawLat, rawLng, currentIndex, totalAtCoord);
        const icon = createVehicleIcon(vId, status, fuel, isSelected);
        const popupHtml = createVehiclePopupHtml(veh, rawLat, rawLng);

        if (vehicleMarkersMapRef.current.has(vId)) {
          // Update existing marker in-place
          const record = vehicleMarkersMapRef.current.get(vId);
          const currentLatLng = record.marker.getLatLng();
          if (Math.abs(currentLatLng.lat - lat) > 0.00001 || Math.abs(currentLatLng.lng - lng) > 0.00001) {
            record.marker.setLatLng([lat, lng]);
          }
          if (record.status !== status || record.fuel !== fuel || record.isSelected !== isSelected) {
            record.marker.setIcon(icon);
            record.status = status;
            record.fuel = fuel;
            record.isSelected = isSelected;
          }
          record.marker.setPopupContent(popupHtml);

          if (isSelected) {
            markerToFocus = record.marker;
          }
        } else {
          // Create new marker
          const marker = L.marker([lat, lng], { icon, zIndexOffset: 300 });
          marker.bindPopup(popupHtml, { 
            maxWidth: 340, 
            minWidth: 290, 
            autoPan: true, 
            autoPanPaddingTopLeft: [70, 110], 
            autoPanPaddingBottomRight: [70, 70] 
          });

          marker.on('click', () => {
            if (onSelectVehicleRef.current) onSelectVehicleRef.current(veh);
          });

          marker.addTo(group);
          vehicleMarkersMapRef.current.set(vId, {
            marker,
            status,
            fuel,
            isSelected,
          });

          if (isSelected) {
            markerToFocus = marker;
          }
        }
      });
    }

    // Clean up stale vehicle markers
    for (const [vId, record] of vehicleMarkersMapRef.current.entries()) {
      if (!currentVehicleIds.has(vId) || !showVehicles) {
        group.removeLayer(record.marker);
        vehicleMarkersMapRef.current.delete(vId);
      }
    }

    // E. In-place Driver Markers Update
    const currentDriverIds = new Set();
    if (showDrivers && Array.isArray(drivers)) {
      drivers.forEach((drv) => {
        const rawLat = drv.latitude ?? drv.lat;
        const rawLng = drv.longitude ?? drv.lng;
        if (typeof rawLat !== 'number' || typeof rawLng !== 'number' || isNaN(rawLat) || isNaN(rawLng)) return;

        const dId = drv.driverId || drv.id || 'DR';
        currentDriverIds.add(dId);

        const name = drv.name || `Driver ${dId}`;
        const status = (drv.status || 'Active').toLowerCase();
        const isSelected = Boolean(
          highlightedEntity && (
            highlightedEntity.id === dId ||
            highlightedEntity.driverId === dId ||
            (highlightedEntity.type === 'driver' && String(highlightedEntity.id).toLowerCase() === String(dId).toLowerCase())
          )
        );

        const isMobileGps = drv.coordinatesSource === 'MOBILE_GPS';
        const isActive = status === 'active' || status === 'on trip' || status === 'on_trip';

        // Disambiguate co-located markers
        const coordKey = `${rawLat.toFixed(3)}_${rawLng.toFixed(3)}`;
        const totalAtCoord = coordOccurrences.get(coordKey) || 1;
        const currentIndex = coordIndexCounter.get(coordKey) || 0;
        coordIndexCounter.set(coordKey, currentIndex + 1);

        const [lat, lng] = getDisambiguatedLatLng(rawLat, rawLng, currentIndex, totalAtCoord);
        const icon = createDriverIcon(dId, name, isMobileGps, isActive, isSelected);
        const popupHtml = createDriverPopupHtml(drv, rawLat, rawLng);

        if (driverMarkersMapRef.current.has(dId)) {
          // Update existing marker in-place
          const record = driverMarkersMapRef.current.get(dId);
          const currentLatLng = record.marker.getLatLng();
          if (Math.abs(currentLatLng.lat - lat) > 0.00001 || Math.abs(currentLatLng.lng - lng) > 0.00001) {
            record.marker.setLatLng([lat, lng]);
          }
          if (record.status !== status || record.isMobileGps !== isMobileGps || record.isSelected !== isSelected) {
            record.marker.setIcon(icon);
            record.status = status;
            record.isMobileGps = isMobileGps;
            record.isSelected = isSelected;
          }
          record.marker.setPopupContent(popupHtml);

          if (isSelected) {
            markerToFocus = record.marker;
          }
        } else {
          // Create new marker
          const marker = L.marker([lat, lng], { icon, zIndexOffset: 350 });
          marker.bindPopup(popupHtml, { 
            maxWidth: 340, 
            minWidth: 290, 
            autoPan: true, 
            autoPanPaddingTopLeft: [70, 110], 
            autoPanPaddingBottomRight: [70, 70] 
          });

          marker.on('click', () => {
            if (onSelectDriverRef.current) onSelectDriverRef.current(drv);
          });

          marker.addTo(group);
          driverMarkersMapRef.current.set(dId, {
            marker,
            status,
            isMobileGps,
            isSelected,
          });

          if (isSelected) {
            markerToFocus = marker;
          }
        }
      });
    }

    // Clean up stale driver markers
    for (const [dId, record] of driverMarkersMapRef.current.entries()) {
      if (!currentDriverIds.has(dId) || !showDrivers) {
        group.removeLayer(record.marker);
        driverMarkersMapRef.current.delete(dId);
      }
    }

    // Smooth focus (flyTo) on selected entity
    if (markerToFocus) {
      const targetLatLng = markerToFocus.getLatLng();
      map.flyTo(targetLatLng, Math.max(map.getZoom(), 13), {
        duration: 0.85,
        easeLinearity: 0.25,
      });

      const focusTimer = setTimeout(() => {
        if (markerToFocus && mapInstanceRef.current) {
          markerToFocus.openPopup();
        }
      }, 350);

      return () => clearTimeout(focusTimer);
    }
  }, [
    vehicles,
    drivers,
    showVehicles,
    showDrivers,
    highlightedEntity,
    createVehicleIcon,
    createVehiclePopupHtml,
    createDriverIcon,
    createDriverPopupHtml
  ]);

  // Floating Control Handlers
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleFitRouteBounds = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const points = [];
    if (originLatLng) points.push(originLatLng);
    if (destLatLng) points.push(destLatLng);
    waypointLatLngs.forEach(p => points.push(p));
    if (Array.isArray(routeGeometry) && routeGeometry.length > 1) {
      routeGeometry.forEach(p => points.push(p));
    }

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: [70, 110],
        paddingBottomRight: [70, 70],
        maxZoom: 14,
        animate: true,
      });
    } else if (points.length === 1) {
      map.setView(points[0], 12, { animate: true });
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  const toggleBasemap = () => {
    setActiveBasemap(prev => {
      if (prev === 'voyager') return 'dark';
      if (prev === 'dark') return 'osm';
      return 'voyager';
    });
  };

  const hasValidCoordinates = Boolean(
    originLatLng || 
    destLatLng || 
    (vehicles && vehicles.some(v => typeof v.latitude === 'number' || typeof v.lat === 'number')) ||
    (drivers && drivers.some(d => typeof d.latitude === 'number' || typeof d.lat === 'number'))
  );

  return (
    <div 
      className={
        isFullscreen 
          ? "fixed inset-0 z-[9999] w-screen h-screen bg-[#0D0D0F] select-none group" 
          : `relative w-full rounded-2xl overflow-hidden border border-[#2A2A2E] bg-[#0D0D0F] shadow-2xl select-none group ${className}`
      }
      style={{ height: isFullscreen ? '100vh' : height }}
    >
      {/* Primary Leaflet Container */}
      <div 
        ref={mapContainerRef} 
        id={`leaflet_map_${uniqueId}`}
        className="w-full h-full z-0 bg-[#0D0D0F]"
        style={{ minHeight: '220px' }}
      />

      {/* Loading State Overlay */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-30 bg-[#0D0D0F]/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-[#16161A]/90 border border-[#2A2A2E] shadow-2xl mb-3">
            <RotateCw className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
          <p className="text-xs font-extrabold text-[#F5F5F5] tracking-wide">Updating Fleet Telemetry & Road Geometry</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">Synchronizing live coordinates with routing engine...</p>
        </div>
      )}

      {/* Error State Banner */}
      {error && (
        <div className="absolute top-4 left-4 right-4 z-30 bg-red-950/90 border border-red-800/60 rounded-xl p-3 shadow-2xl flex items-center justify-between text-xs text-red-200 backdrop-blur-md">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-2.5 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-white font-bold text-[10px] border border-red-700/50 transition-colors flex items-center space-x-1"
            >
              <RotateCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Empty / Unresolved State Overlay */}
      {!hasValidCoordinates && !loading && (
        <div className="absolute inset-0 z-10 bg-[#0D0D0F]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-[#9CA3AF]">
          <Compass className="w-10 h-10 text-zinc-600 animate-pulse mb-3" />
          <p className="text-sm font-bold text-[#F5F5F5]">Corridor Standby</p>
          <p className="text-xs text-[#9CA3AF] max-w-sm mt-1.5 leading-relaxed">
            Select origin, destination, and stops from the control panel to plot high-density road geometry.
          </p>
        </div>
      )}

      {/* Modern Floating Zoom & Navigation Controls (Top-Right) */}
      <div className="absolute top-3 right-3 z-20 flex flex-col items-end space-y-2">
        {/* Telemetry Pill (when HUD enabled) */}
        {showHud && calculatedDistance !== null && (
          <div className="bg-[#16161A]/95 backdrop-blur-md border border-[#2A2A2E] px-3.5 py-2 rounded-xl shadow-2xl flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5">
              <Navigation className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-black text-[#F5F5F5]">{calculatedDistance} km</span>
            </div>
            <div className="w-px h-3.5 bg-[#2A2A2E]"></div>
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-[#F5F5F5]">{calculatedDuration}</span>
            </div>
          </div>
        )}

        {/* Action Controls Cluster */}
        <div className="bg-[#16161A]/95 backdrop-blur-md border border-[#2A2A2E] rounded-xl p-1 shadow-2xl flex flex-col space-y-1">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom In"
            title="Zoom In (+)"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#F5F5F5] hover:bg-[#252528] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom Out"
            title="Zoom Out (-)"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#F5F5F5] hover:bg-[#252528] active:scale-95 transition-all"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="w-6 h-px bg-[#2A2A2E] mx-auto my-0.5"></div>
          <button
            type="button"
            onClick={handleFitRouteBounds}
            aria-label="Fit Route Bounds"
            title="Fit Route Bounds"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#F5F5F5] hover:bg-[#252528] active:scale-95 transition-all"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
          </button>
          <button
            type="button"
            onClick={toggleBasemap}
            aria-label="Toggle Basemap Style"
            title={`Current: ${BASEMAPS[activeBasemap]?.name || 'Basemap'}. Click to toggle.`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#F5F5F5] hover:bg-[#252528] active:scale-95 transition-all"
          >
            <Layers className={`w-3.5 h-3.5 ${activeBasemap === 'voyager' ? 'text-amber-400' : activeBasemap === 'dark' ? 'text-cyan-400' : 'text-emerald-400'}`} />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            title={isFullscreen ? "Exit Fullscreen View" : "Expand to Fullscreen View"}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#F5F5F5] hover:bg-[#252528] active:scale-95 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-amber-400" /> : <Maximize2 className="w-3.5 h-3.5 text-zinc-400 hover:text-white" />}
          </button>
        </div>
      </div>

      {/* Floating Route Legend Badge (Top-Left) */}
      <div 
        data-testid="map-route-legend" 
        className="absolute top-3 left-3 z-20 bg-[#16161A]/95 backdrop-blur-md border border-[#2A2A2E] p-2.5 rounded-xl shadow-2xl flex flex-col gap-2 max-w-[280px]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-2 rounded-full bg-[#00D2FF] border border-[#070A12] shadow-[0_0_8px_rgba(0,210,255,0.9)]"></span>
            <div className="flex flex-col text-left leading-none">
              <span className="text-[10px] font-black text-cyan-300 tracking-wider">OPTIMIZED ROUTE</span>
              <span className="text-[8px] font-bold text-zinc-400 tracking-wider mt-0.5">OSRM ROAD NETWORK</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLegendCollapsed(prev => !prev)}
            className="text-zinc-400 hover:text-white p-0.5 rounded transition-colors text-[10px]"
            title={legendCollapsed ? 'Expand legend key' : 'Collapse legend key'}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Expandable Status Legend Key */}
        {!legendCollapsed && (
          <div className="pt-2 border-t border-[#2A2A2E] grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9.5px] font-semibold text-zinc-300">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_6px_rgba(16,185,129,0.7)]"></span>
              <span>Travelling</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
              <span>Idle / Standby</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
              <span>Maintenance</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse"></span>
              <span>Alert / Low Fuel</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#06B6D4] shadow-[0_0_6px_rgba(6,182,212,0.7)]"></span>
              <span>Driver GPS</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981] border border-white"></span>
              <span>Hub Stations</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Telemetry HUD */}
      {showHud && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-20 bg-[#16161A]/95 backdrop-blur-md border border-[#2A2A2E] px-3.5 py-2 rounded-xl shadow-2xl flex items-center space-x-2.5 text-[11px] text-[#9CA3AF] max-w-lg">
          <AlertCircle className={`w-4 h-4 flex-shrink-0 ${isStraightLineFallback ? 'text-amber-400' : 'text-cyan-400'}`} />
          <div className="leading-snug truncate">
            <span className="font-bold text-[#F5F5F5] block truncate">
              {statusSource || (isStraightLineFallback ? 'Estimated Corridor Route (Direct Path)' : 'Optimized Road-Following Highway Route (OSRM)')}
            </span>
            <span className="text-[10px] text-[#9CA3AF] block truncate">
              {typeof origin === 'string' ? origin : origin?.label || 'Origin'} ➔ {waypoints && waypoints.length > 0 ? waypoints.map(w => typeof w === 'string' ? w : w?.name || 'Stop').join(' ➔ ') + ' ➔ ' : ''}{typeof destination === 'string' ? destination : destination?.label || 'Destination'} • Active Corridor
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveFleetMap;
