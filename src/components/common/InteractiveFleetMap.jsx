import React, { useEffect, useRef, useMemo, useId } from 'react';
import L from 'leaflet';
import { 
  getTownLatLng, 
  getCorridorDistanceKm, 
  getEstimatedDuration 
} from '../../data/mockData';
import { Navigation, Clock, AlertCircle, Compass } from 'lucide-react';

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

/**
 * InteractiveFleetMap
 * 
 * Interactive Leaflet map component for Intelligent Fleet:
 * - Direct Leaflet instance lifecycle management (create, bounds, resize, destroy)
 * - CartoDB / OpenStreetMap dark tiles matching application palette
 * - Real backend vehicle & driver map markers with popups & provenance labeling
 * - Real OSRM highway road-following polyline
 * - Highlights active/queried vehicle or driver when selected or referenced in AI chat
 * - Telemetry overlay HUD with real Distance (km) and Duration (ETA)
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
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeGroupRef = useRef(null);
  const fleetGroupRef = useRef(null);
  const uniqueId = useId().replace(/:/g, '_');

  const isStraightLineFallback = !(Array.isArray(routeGeometry) && routeGeometry.length > 1);

  // Derive coordinates (supports backend { lat, lng } or town name)
  const originLatLng = useMemo(() => resolvePointCoords(origin), [origin]);
  const destLatLng = useMemo(() => resolvePointCoords(destination), [destination]);

  // Derived waypoints coordinates
  const waypointLatLngs = useMemo(() => {
    return Array.isArray(waypoints)
      ? waypoints.map(resolvePointCoords).filter(Boolean)
      : [];
  }, [waypoints]);

  // Derive distance
  const calculatedDistance = (typeof distanceKm === 'number' && distanceKm > 0)
    ? distanceKm
    : (typeof origin === 'string' && typeof destination === 'string' ? getCorridorDistanceKm(origin, destination) : null);

  // Derive estimated duration
  const calculatedDuration = duration || (typeof origin === 'string' && typeof destination === 'string' ? getEstimatedDuration(origin, destination) : '1h 30m');

  // Stable callback refs to prevent layer redraws on selection
  const onSelectVehicleRef = useRef(onSelectVehicle);
  onSelectVehicleRef.current = onSelectVehicle;
  const onSelectDriverRef = useRef(onSelectDriver);
  onSelectDriverRef.current = onSelectDriver;

  // 1. Initialize Map Instance Once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const defaultCenter = [11.1271, 78.6569];
    const defaultZoom = 7;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      dragging: interactive,
      touchZoom: interactive,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France',
      referrerPolicy: 'no-referrer',
    }).addTo(map);

    const routeGroup = L.layerGroup().addTo(map);
    const fleetGroup = L.layerGroup().addTo(map);
    routeGroupRef.current = routeGroup;
    fleetGroupRef.current = fleetGroup;
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
        routeGroupRef.current = null;
        fleetGroupRef.current = null;
      }
    };
  }, [interactive]);

  // 2. Render Route, Stations, Waypoints, and Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = routeGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const boundsPoints = [];

    // A. Custom Origin Marker (Emerald Dispatch Hub - Badge A)
    if (originLatLng) {
      const originLabel = typeof origin === 'object' ? (origin.label || origin.name || 'Origin Hub') : (origin || 'Origin Hub');
      const originIcon = L.divIcon({
        className: 'custom-fleet-marker origin-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer" data-testid="origin-marker" data-origin-hub="${originLabel}" style="width: 32px; height: 32px;">
            <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-35 animate-ping"></span>
            <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-[#16161A] border-2 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]">
              <span class="text-[12px] font-extrabold text-emerald-300 font-mono">A</span>
            </div>
            <span class="absolute -bottom-6 px-2 py-0.5 rounded-md bg-[#0D0D0F]/95 text-[9px] font-extrabold text-emerald-300 border border-emerald-500/50 shadow-lg tracking-wide whitespace-nowrap pointer-events-none">
              START: ${originLabel}
            </span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const originMarker = L.marker(originLatLng, { icon: originIcon });
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
      `, { maxWidth: 320, minWidth: 280, autoPan: true, autoPanPaddingTopLeft: [60, 90], autoPanPaddingBottomRight: [60, 60] });
      originMarker.addTo(group);
      boundsPoints.push(originLatLng);
    }

    // B. Custom Destination Marker (Blue Delivery Station - Badge B)
    if (destLatLng) {
      const destLabel = typeof destination === 'object' ? (destination.label || destination.name || 'Destination') : (destination || 'Destination');
      const destIcon = L.divIcon({
        className: 'custom-fleet-marker destination-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer" data-testid="destination-marker" data-destination-terminal="${destLabel}" style="width: 32px; height: 32px;">
            <span class="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-35 animate-ping"></span>
            <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-[#16161A] border-2 border-cyan-400 shadow-[0_0_12px_rgba(0,210,255,0.6)]">
              <span class="text-[12px] font-extrabold text-cyan-300 font-mono">B</span>
            </div>
            <span class="absolute -bottom-6 px-2 py-0.5 rounded-md bg-[#0D0D0F]/95 text-[9px] font-extrabold text-cyan-300 border border-cyan-500/50 shadow-lg tracking-wide whitespace-nowrap pointer-events-none">
              DEST: ${destLabel}
            </span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const destMarker = L.marker(destLatLng, { icon: destIcon });
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
      `, { maxWidth: 320, minWidth: 280, autoPan: true, autoPanPaddingTopLeft: [60, 90], autoPanPaddingBottomRight: [60, 60] });
      destMarker.addTo(group);
      boundsPoints.push(destLatLng);
    }

    // C. Waypoint Markers with Numbered Sequence (#1, #2, #3...)
    waypointLatLngs.forEach((latLng, idx) => {
      const stopNum = idx + 1;
      const wpName = Array.isArray(waypoints) && waypoints[idx]
        ? (typeof waypoints[idx] === 'string' ? waypoints[idx] : waypoints[idx]?.name || `Stop ${stopNum}`)
        : `Stop ${stopNum}`;

      const wpIcon = L.divIcon({
        className: 'custom-fleet-marker waypoint-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer" data-testid="waypoint-marker" data-waypoint-index="${stopNum}" data-stop-number="${stopNum}" style="width: 32px; height: 32px;">
            <span class="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-35 animate-ping"></span>
            <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-[#16161A] border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]">
              <span class="text-[11px] font-extrabold text-amber-300 font-mono">${stopNum}</span>
            </div>
            <span class="absolute -bottom-6 px-2 py-0.5 rounded-md bg-[#0D0D0F]/95 text-[9px] font-extrabold text-amber-300 border border-amber-500/50 shadow-lg tracking-wide whitespace-nowrap pointer-events-none">
              #${stopNum}: ${wpName}
            </span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const wpMarker = L.marker(latLng, { icon: wpIcon });
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
      `, { maxWidth: 320, minWidth: 280, autoPan: true, autoPanPaddingTopLeft: [60, 90], autoPanPaddingBottomRight: [60, 60] });
      wpMarker.addTo(group);
      boundsPoints.push(latLng);
    });

    // F. Road-Following Polyline (Rendered when real OSRM road geometry is available)
    if (Array.isArray(routeGeometry) && routeGeometry.length > 1) {
      const polylinePoints = routeGeometry;

      // Layer 0: Ambient soft cyan glow halo
      L.polyline(polylinePoints, {
        color: '#00D2FF',
        weight: 14,
        opacity: 0.22,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);

      // Layer 1: Dark high-contrast casing underneath the route
      L.polyline(polylinePoints, {
        color: '#070A12',
        weight: 9,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);

      // Layer 2: Core primary bright cyan/blue enterprise highway route
      const mainLine = L.polyline(polylinePoints, {
        color: '#00D2FF',
        weight: 5.5,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round',
      });
      mainLine.addTo(group);

      // Layer 3: Inner crisp navigation highway centerline highlight
      L.polyline(polylinePoints, {
        color: '#E0F7FE',
        weight: 1.5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);

      mainLine.bindTooltip(
        'Optimized Road-Following Highway Geometry (OSRM)',
        { sticky: true, className: 'leaflet-dark-tooltip' }
      );

      // Include road geometry points in bounds to ensure complete curve coverage
      polylinePoints.forEach((pt) => {
        if (Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
          boundsPoints.push(pt);
        }
      });
    }

    // Auto-fit bounds for route if boundsPoints has items and no highlightedEntity
    let fitTimeoutId = null;
    if (boundsPoints.length > 1 && !highlightedEntity) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, {
        paddingTopLeft: [50, 90],
        paddingBottomRight: [50, 60],
        maxZoom: 13,
        animate: false,
      });

      // Quick deferred fit to guarantee edge-to-edge layout after rendering
      fitTimeoutId = setTimeout(() => {
        if (mapInstanceRef.current && boundsPoints.length > 1) {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.fitBounds(bounds, {
            paddingTopLeft: [60, 110],
            paddingBottomRight: [60, 60],
            maxZoom: 13,
            animate: false,
          });
          const openPopup = mapInstanceRef.current._popup;
          if (openPopup && openPopup.isOpen && openPopup.isOpen() && typeof openPopup._panIntoView === 'function') {
            openPopup._panIntoView();
          }
        }
      }, 100);
    } else if (boundsPoints.length === 1 && !highlightedEntity) {
      map.setView(boundsPoints[0], 10, { animate: false });
      const openPopup = map._popup;
      if (openPopup && openPopup.isOpen && openPopup.isOpen() && typeof openPopup._panIntoView === 'function') {
        openPopup._panIntoView();
      }
    }

    return () => {
      if (fitTimeoutId) clearTimeout(fitTimeoutId);
    };
  }, [
    origin,
    destination,
    waypoints,
    routeGeometry,
    originLatLng,
    destLatLng,
    waypointLatLngs,
    isStraightLineFallback
  ]);

  // 3. Render Fleet Telemetry Markers (Vehicles and Drivers)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = fleetGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    let selectedMarkerToOpen = null;

    // D. Real Backend Vehicle Markers
    if (showVehicles && Array.isArray(vehicles)) {
      vehicles.forEach((veh) => {
        const lat = veh.latitude ?? veh.lat;
        const lng = veh.longitude ?? veh.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;

        const vId = veh.vehicleId || veh.id || 'VH';
        const status = (veh.status || 'idle').toLowerCase();
        const fuel = veh.fuel_level ?? veh.fuelLevel ?? 80;
        const isSelected = highlightedEntity && (
          highlightedEntity.id === vId ||
          highlightedEntity.vehicleId === vId ||
          (highlightedEntity.type === 'vehicle' && String(highlightedEntity.id).toLowerCase() === String(vId).toLowerCase())
        );

        const isMaintenance = status === 'maintenance';
        const isTravelling = status === 'travelling' || status === 'active';
        const badgeColor = isMaintenance ? '#F59E0B' : (isTravelling ? '#10B981' : '#64748B');
        const pingColor = isMaintenance ? 'bg-amber-400' : (isTravelling ? 'bg-emerald-400' : 'bg-slate-400');
        const borderRing = isSelected ? 'ring-4 ring-cyan-400 ring-offset-2 ring-offset-[#0D0D0F]' : '';

        const vehIcon = L.divIcon({
          className: `custom-fleet-marker vehicle-marker ${isSelected ? 'selected-vehicle' : ''}`,
          html: `
            <div class="relative flex items-center justify-center cursor-pointer group" data-vehicle-id="${vId}" style="width: 32px; height: 32px;">
              <span class="absolute inline-flex h-full w-full rounded-full ${pingColor} opacity-30 ${isTravelling ? 'animate-ping' : ''}"></span>
              <div class="relative flex items-center justify-center w-7 h-7 rounded-xl bg-[#16161A] border-2 shadow-xl ${borderRing}" style="border-color: ${badgeColor};">
                <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
              </div>
              <span class="absolute -bottom-5 px-1.5 py-0.5 rounded bg-[#0D0D0F]/95 text-[9px] font-bold text-white border border-[#2A2A2E] shadow whitespace-nowrap pointer-events-none">
                ${vId} • ${fuel}%
              </span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const isTrueGps = veh.coordinatesSource === 'LIVE_GPS';
        const isManual = veh.coordinatesSource === 'MANUAL';
        const formattedTimestamp = veh.locationTimestamp 
          ? new Date(veh.locationTimestamp).toLocaleString() 
          : (veh.updatedAt ? new Date(veh.updatedAt).toLocaleString() : 'N/A');
        const displayLocation = veh.currentLocation || veh.location || 'Hub Station';

        const vehMarker = L.marker([lat, lng], { icon: vehIcon });
        const vehProvenanceLabel = isTrueGps ? 'LIVE_GPS' : isManual ? 'MANUAL' : 'Operational Location';
        const rawVehStatus = (status || 'Active').toLowerCase();
        const displayVehStatus = rawVehStatus.charAt(0).toUpperCase() + rawVehStatus.slice(1);

        let vehStatusBadgeBg = 'rgba(16, 185, 129, 0.15)';
        let vehStatusBadgeText = '#34D399';
        let vehStatusBadgeBorder = 'rgba(16, 185, 129, 0.35)';
        let vehStatusDotColor = '#10B981';

        if (isMaintenance) {
          vehStatusBadgeBg = 'rgba(245, 158, 11, 0.15)';
          vehStatusBadgeText = '#FBBF24';
          vehStatusBadgeBorder = 'rgba(245, 158, 11, 0.35)';
          vehStatusDotColor = '#F59E0B';
        } else if (rawVehStatus === 'inactive' || rawVehStatus === 'offline') {
          vehStatusBadgeBg = 'rgba(239, 68, 68, 0.15)';
          vehStatusBadgeText = '#F87171';
          vehStatusBadgeBorder = 'rgba(239, 68, 68, 0.35)';
          vehStatusDotColor = '#EF4444';
        }

        const fuelColor = fuel < 30 ? '#F87171' : fuel < 60 ? '#FBBF24' : '#34D399';
        const regNumber = veh.registrationNumber || veh.reg_no || 'TN Commercial';
        const assignedDriver = veh.assigned_driver_id || veh.driverId || 'Unassigned';

        vehMarker.bindPopup(`
          <div class="fleet-popup-card" style="width: 310px; max-width: calc(100vw - 40px); background: #111114; border-radius: 12px; color: #F5F5F5; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box;">
            <!-- Header: PRIMARY Vehicle ID + Registration & SECONDARY Status -->
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

            <!-- Two-Column Information Layout -->
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
                <span style="color: ${fuelColor}; font-weight: 700; text-align: right;">${fuel}%</span>
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

              <!-- Metadata Section -->
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
        `, { maxWidth: 340, minWidth: 290, autoPan: true, autoPanPaddingTopLeft: [60, 90], autoPanPaddingBottomRight: [60, 60] });

        vehMarker.on('click', () => {
          if (onSelectVehicleRef.current) onSelectVehicleRef.current(veh);
        });
        vehMarker.addTo(group);

        if (isSelected) {
          selectedMarkerToOpen = vehMarker;
        }
      });
    }

    // E. Real Backend Driver Markers
    if (showDrivers && Array.isArray(drivers)) {
      drivers.forEach((drv) => {
        const lat = drv.latitude ?? drv.lat;
        const lng = drv.longitude ?? drv.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;

        const dId = drv.driverId || drv.id || 'DR';
        const name = drv.name || `Driver ${dId}`;
        const status = (drv.status || 'Active').toLowerCase();
        const isSelected = highlightedEntity && (
          highlightedEntity.id === dId ||
          highlightedEntity.driverId === dId ||
          (highlightedEntity.type === 'driver' && String(highlightedEntity.id).toLowerCase() === String(dId).toLowerCase())
        );

        const isActive = status === 'active' || status === 'on trip';
        const borderRing = isSelected ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-[#0D0D0F]' : '';

        const isMobileGps = drv.coordinatesSource === 'MOBILE_GPS';
        const drvTimestamp = drv.locationTimestamp 
          ? new Date(drv.locationTimestamp).toLocaleString() 
          : (drv.updatedAt ? new Date(drv.updatedAt).toLocaleString() : 'N/A');
        const driverDisplayLocation = drv.self_reported_location || drv.currentLocation || 'Assigned Depot';

        const pulseColor = isMobileGps ? 'bg-cyan-400' : 'bg-emerald-400';
        const borderColor = isMobileGps ? 'border-cyan-400' : 'border-emerald-400';
        const badgeTextColor = isMobileGps ? 'text-cyan-300' : 'text-emerald-300';
        const badgeBorderColor = isMobileGps ? 'border-cyan-800/40' : 'border-emerald-800/40';

        const drvIcon = L.divIcon({
          className: `custom-fleet-marker driver-marker ${isSelected ? 'selected-driver' : ''}`,
          html: `
            <div class="relative flex items-center justify-center cursor-pointer group" data-testid="driver-marker" data-driver-id="${dId}" style="width: 28px; height: 28px;">
              <span class="absolute inline-flex h-full w-full rounded-full ${pulseColor} opacity-30 ${isActive || isMobileGps ? 'animate-ping' : ''}"></span>
              <div class="relative flex items-center justify-center w-6 h-6 rounded-full bg-[#16161A] border-2 ${borderColor} shadow-xl ${borderRing}">
                <span class="text-[9px] font-extrabold ${badgeTextColor}">${dId.replace(/\D/g, '') || 'D'}</span>
              </div>
              <span class="absolute -bottom-5 px-1.5 py-0.5 rounded bg-[#0D0D0F]/95 text-[9px] font-bold ${badgeTextColor} border ${badgeBorderColor} shadow whitespace-nowrap pointer-events-none">
                ${name.split(' ')[0]} ${isMobileGps ? '📡' : ''}
              </span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const drvMarker = L.marker([lat, lng], { icon: drvIcon });
        const drvProvenanceLabel = isMobileGps ? 'Live Device GPS' : 'Operational Location';
        const rawStatus = (drv.status || 'Active').toLowerCase();
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

        drvMarker.bindPopup(`
          <div class="fleet-popup-card" style="width: 310px; max-width: calc(100vw - 40px); background: #111114; border-radius: 12px; color: #F5F5F5; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box;">
            <!-- Header: PRIMARY Name + ID & SECONDARY Status -->
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

            <!-- Two-Column Information Layout -->
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

              <!-- Metadata Section -->
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
        `, { maxWidth: 340, minWidth: 290, autoPan: true, autoPanPaddingTopLeft: [60, 90], autoPanPaddingBottomRight: [60, 60] });

        drvMarker.on('click', () => {
          if (onSelectDriverRef.current) onSelectDriverRef.current(drv);
        });
        drvMarker.addTo(group);

        if (isSelected) {
          selectedMarkerToOpen = drvMarker;
        }
      });
    }

    if (selectedMarkerToOpen) {
      setTimeout(() => {
        if (mapInstanceRef.current && selectedMarkerToOpen) {
          selectedMarkerToOpen.openPopup();
        }
      }, 50);
    }
  }, [
    vehicles,
    drivers,
    showVehicles,
    showDrivers,
    highlightedEntity
  ]);

  const hasValidCoordinates = Boolean(originLatLng || destLatLng || (vehicles && vehicles.some(v => v.latitude)));

  return (
    <div 
      className={`relative w-full rounded-2xl overflow-hidden border border-[#2A2A2E] bg-[#0D0D0F] shadow-inner select-none ${className}`}
      style={{ height }}
    >
      {/* Map Container */}
      <div 
        ref={mapContainerRef} 
        id={`leaflet_map_${uniqueId}`}
        className="w-full h-full z-0 bg-[#0D0D0F]"
        style={{ minHeight: '160px' }}
      />

      {/* Empty / Unresolved State Overlay */}
      {!hasValidCoordinates && (
        <div className="absolute inset-0 z-10 bg-[#0D0D0F]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-[#9CA3AF]">
          <Compass className="w-8 h-8 text-zinc-600 animate-pulse mb-2" />
          <p className="text-xs font-semibold text-[#F5F5F5]">Corridor Map Standby</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">Select valid origin and destination towns to render the route.</p>
        </div>
      )}

      {/* Floating Route Legend Badge */}
      {Array.isArray(routeGeometry) && routeGeometry.length > 1 && (
        <div 
          data-testid="map-route-legend" 
          className="absolute top-3 left-14 z-10 bg-[#16161A]/95 backdrop-blur-md border border-[#2A2A2E] px-3 py-1.5 rounded-xl shadow-xl flex items-center space-x-2.5 pointer-events-none select-none"
        >
          <div className="flex items-center space-x-1">
            <span className="w-5 h-2 rounded-full bg-[#00D2FF] border border-[#070A12] shadow-[0_0_8px_rgba(0,210,255,0.8)]"></span>
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="text-[10px] font-extrabold text-cyan-300 tracking-wider">OPTIMIZED ROUTE</span>
            <span className="text-[8px] font-bold text-zinc-400 tracking-wide">OSRM ROAD NETWORK</span>
          </div>
        </div>
      )}

      {/* Floating Telemetry & Route Details HUD */}
      {showHud && (
        <>
          {/* Top-Right: Distance & Duration Pill */}
          {calculatedDistance !== null && (
            <div className="absolute top-3 right-3 z-10 bg-[#16161A]/90 backdrop-blur-md border border-[#2A2A2E] px-3 py-1.5 rounded-xl shadow-lg flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-extrabold text-[#F5F5F5]">{calculatedDistance} km</span>
              </div>
              <div className="w-px h-3 bg-[#2A2A2E]"></div>
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-[#F5F5F5]">{calculatedDuration}</span>
              </div>
            </div>
          )}

          {/* Bottom-Left: Disclaimer & Corridor Telemetry Badge */}
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-10 bg-[#16161A]/95 backdrop-blur-md border border-[#2A2A2E] px-3 py-2 rounded-xl shadow-xl flex items-center space-x-2.5 text-[11px] text-[#9CA3AF]">
            <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 ${isStraightLineFallback ? 'text-amber-400' : 'text-cyan-400'}`} />
            <div className="leading-tight">
              <span className="font-bold text-[#F5F5F5] block">
                {statusSource || (isStraightLineFallback ? 'Estimated Corridor Route (Direct Path)' : 'Optimized Road-Following Highway Route (OSRM)')}
              </span>
              <span className="text-[10px] text-[#9CA3AF]">
                {typeof origin === 'string' ? origin : origin?.label || 'Origin'} ➔ {waypoints && waypoints.length > 0 ? waypoints.map(w => typeof w === 'string' ? w : w?.name || 'Stop').join(' ➔ ') + ' ➔ ' : ''}{typeof destination === 'string' ? destination : destination?.label || 'Destination'} • Active Corridor
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InteractiveFleetMap;
