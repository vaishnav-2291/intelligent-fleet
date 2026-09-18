import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFleet } from '../../context/FleetContext';
import { SAMPLE_TOWNS } from '../../data/mockData';
import { 
  CORRIDOR_PRESETS, 
  getRoadFollowingRoute, 
  solveOptimalStopSequence 
} from '../../services/routeOptimizer';
import { InteractiveFleetMap } from '../common/InteractiveFleetMap';
import { 
  Navigation, 
  MapPin, 
  Clock, 
  Sparkles, 
  Plus, 
  Trash2, 
  RotateCw, 
  Send, 
  CheckCircle2, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';

/**
 * Resolves a driver's active, assigned, or most recent route from live context data.
 * Priority:
 * 1. Active / Ongoing trip
 * 2. Assigned route (trip with status 'Assigned' or driver.assigned_route)
 * 3. Most recent relevant trip
 * 4. None (returns null)
 */
export const getDriverCurrentRoute = (driverId, drivers = [], trips = []) => {
  if (!driverId) return null;
  const dIdStr = String(driverId).trim().toLowerCase();

  // 1. Locate driver object
  const driver = (drivers || []).find((d) => {
    const id = String(d?.id || d?.driverId || d?.driver_id || '').trim().toLowerCase();
    return id === dIdStr;
  });

  // 2. Locate all trips matching this driver
  const driverTrips = (trips || []).filter((t) => {
    const tDriverId = String(t?.driver_id || t?.driverId || t?.driver?.id || '').trim().toLowerCase();
    return tDriverId === dIdStr;
  });

  // Priority 1: Active / Ongoing trip
  const activeTrip = driverTrips.find((t) => {
    const s = String(t?.status || '').trim().toLowerCase();
    return s === 'ongoing' || s === 'on_trip' || s === 'active';
  });
  if (activeTrip) {
    const origin = activeTrip.source || activeTrip.origin || activeTrip.from;
    const destination = activeTrip.destination || activeTrip.to;
    const rawWaypoints = activeTrip.waypoints || activeTrip.stops || activeTrip.routeInfo?.waypoints || activeTrip.routeInfo?.stops || [];
    if (origin && destination) {
      return {
        origin,
        destination,
        waypoints: Array.isArray(rawWaypoints) ? rawWaypoints : [],
        vehicleId: activeTrip.vehicle_id || activeTrip.vehicleId || driver?.assigned_vehicle_id,
        tripId: activeTrip.id || activeTrip.tripId,
        status: 'Ongoing',
        type: 'Active Trip',
        distanceKm: activeTrip.distance_km || activeTrip.distanceKm,
        duration: activeTrip.estimated_duration || activeTrip.duration
      };
    }
  }

  // Priority 2: Assigned trip
  const assignedTrip = driverTrips.find((t) => {
    const s = String(t?.status || '').trim().toLowerCase();
    return s === 'assigned';
  });
  if (assignedTrip) {
    const origin = assignedTrip.source || assignedTrip.origin || assignedTrip.from;
    const destination = assignedTrip.destination || assignedTrip.to;
    const rawWaypoints = assignedTrip.waypoints || assignedTrip.stops || assignedTrip.routeInfo?.waypoints || assignedTrip.routeInfo?.stops || [];
    if (origin && destination) {
      return {
        origin,
        destination,
        waypoints: Array.isArray(rawWaypoints) ? rawWaypoints : [],
        vehicleId: assignedTrip.vehicle_id || assignedTrip.vehicleId || driver?.assigned_vehicle_id,
        tripId: assignedTrip.id || assignedTrip.tripId,
        status: 'Assigned',
        type: 'Assigned Route',
        distanceKm: assignedTrip.distance_km || assignedTrip.distanceKm,
        duration: assignedTrip.estimated_duration || assignedTrip.duration
      };
    }
  }

  // Priority 2b: driver.assigned_route
  if (driver?.assigned_route) {
    const ar = driver.assigned_route;
    const origin = ar.source || ar.origin || ar.from;
    const destination = ar.destination || ar.to;
    const rawWaypoints = ar.waypoints || ar.stops || [];
    if (origin && destination) {
      return {
        origin,
        destination,
        waypoints: Array.isArray(rawWaypoints) ? rawWaypoints : [],
        vehicleId: ar.vehicleId || ar.vehicle_id || driver.assigned_vehicle_id,
        tripId: ar.tripId || ar.trip_id || null,
        status: 'Assigned',
        type: 'Assigned Route',
        distanceKm: ar.distance_km || ar.distanceKm,
        duration: ar.estimated_duration || ar.duration
      };
    }
  }

  // Priority 3: Most recent relevant trip
  if (driverTrips.length > 0) {
    const recentTrip = driverTrips[0];
    const origin = recentTrip.source || recentTrip.origin || recentTrip.from;
    const destination = recentTrip.destination || recentTrip.to;
    const rawWaypoints = recentTrip.waypoints || recentTrip.stops || recentTrip.routeInfo?.waypoints || recentTrip.routeInfo?.stops || [];
    if (origin && destination) {
      return {
        origin,
        destination,
        waypoints: Array.isArray(rawWaypoints) ? rawWaypoints : [],
        vehicleId: recentTrip.vehicle_id || recentTrip.vehicleId || driver?.assigned_vehicle_id,
        tripId: recentTrip.id || recentTrip.tripId,
        status: recentTrip.status || 'Completed',
        type: `Recent Trip (${recentTrip.status || 'Past'})`,
        distanceKm: recentTrip.distance_km || recentTrip.distanceKm,
        duration: recentTrip.estimated_duration || recentTrip.duration
      };
    }
  }

  // Priority 4: No assigned/current route
  return null;
};

/**
 * Resolves the paired vehicle ID for a driver based on route, assignment, or vehicle reference.
 */
const resolveVehicleForDriver = (driverId, routeObj, drivers, vehicles) => {
  const drv = (drivers || []).find((d) =>
    String(d?.id || d?.driverId || d?.driver_id || '').toLowerCase() === String(driverId).toLowerCase()
  );

  // If route explicitly specified a vehicle
  if (routeObj?.vehicleId) {
    const matchingVeh = (vehicles || []).find((v) =>
      String(v?.id || v?.vehicleId || v?.vehicle_id || '').toLowerCase() === String(routeObj.vehicleId).toLowerCase()
    );
    if (matchingVeh) return String(matchingVeh.id || matchingVeh.vehicleId);
  }

  // If driver has registered assigned vehicle id
  if (drv?.assigned_vehicle_id) {
    const matchingVeh = (vehicles || []).find((v) =>
      String(v?.id || v?.vehicleId || v?.vehicle_id || '').toLowerCase() === String(drv.assigned_vehicle_id).toLowerCase()
    );
    if (matchingVeh) return String(matchingVeh.id || matchingVeh.vehicleId);
  }

  // If vehicle has assigned_driver_id
  const vehByDriver = (vehicles || []).find((v) =>
    String(v?.assigned_driver_id || v?.assigned_driver || '').toLowerCase() === String(driverId).toLowerCase()
  );
  if (vehByDriver) return String(vehByDriver.id || vehByDriver.vehicleId);

  return vehicles && vehicles.length > 0 ? String(vehicles[0].id || vehicles[0].vehicleId) : '';
};

export const DispatchRoutingView = () => {
  const { 
    drivers, 
    vehicles, 
    trips, 
    assignRoute, 
    showNotification,
    highlightMapEntity
  } = useFleet();

  // Route Planning State
  const [selectedPreset, setSelectedPreset] = useState('kongu-ring');
  const [origin, setOrigin] = useState('Erode');
  const [destination, setDestination] = useState('Coimbatore');
  const [waypoints, setWaypoints] = useState(['Tiruppur']);
  const [newWaypoint, setNewWaypoint] = useState('');

  // Optimization & Telemetry State
  const [routeData, setRouteData] = useState({
    loading: false,
    routeGeometry: null,
    distanceKm: 114.2,
    duration: '1h 38m',
    statusSource: 'OSRM Highway Telemetry (NH 544 / Active Corridor)',
    isRoadFollowing: true,
    legs: [],
    pointCount: 0
  });

  const [routeStatusMessage, setRouteStatusMessage] = useState(null);
  const [optimizationNote, setOptimizationNote] = useState(null);

  // Dispatch Assignment State
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);

  // Driver Route Status
  const [driverRouteStatus, setDriverRouteStatus] = useState({
    loading: false,
    hasRoute: false,
    label: '',
    tripId: null,
    status: null
  });

  // Async Race Protection Refs
  const routeRequestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const hasInitializedDriverRef = useRef(false);

  /**
   * Fetch road-following highway route with strict async race protection.
   * Monotonic request ID ensures older async OSRM responses are immediately ignored.
   */
  const computeRoute = useCallback(async (src, dest, stops) => {
    if (!src || !dest) return;

    // 1. Monotonic request ID
    const requestId = ++routeRequestIdRef.current;

    // 2. Abort any previous pending HTTP request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 3. Invalidate previous route geometry immediately so stale geometry is never rendered with new destination
    setRouteData((prev) => ({
      ...prev,
      loading: true,
      routeGeometry: null,
      statusSource: 'Calculating road route...'
    }));
    setRouteStatusMessage('Updating optimized route...');

    try {
      const result = await getRoadFollowingRoute(src, dest, stops, { signal: abortController.signal });

      // 4. Stale check: if a newer request was initiated, discard this response
      if (result?.aborted || requestId !== routeRequestIdRef.current) {
        return;
      }

      setRouteData({
        loading: false,
        routeGeometry: result.routeGeometry,
        distanceKm: result.distanceKm,
        duration: result.duration,
        statusSource: result.statusSource,
        isRoadFollowing: result.isRoadFollowing,
        legs: result.legs || [],
        pointCount: result.pointCount || 0
      });
      setRouteStatusMessage(null);
    } catch {
      if (requestId !== routeRequestIdRef.current) return;
      setRouteData((prev) => ({
        ...prev,
        loading: false,
        statusSource: 'Corridor Matrix Fallback'
      }));
      setRouteStatusMessage(null);
    }
  }, []);

  /**
   * Destination Change Handler:
   * Removes duplicate stops, invalidates previous route calculation, and recalculates immediately.
   */
  const handleDestinationChange = (newDest) => {
    if (newDest === destination) return;
    const cleanedWaypoints = waypoints.filter((w) => w !== newDest && w !== origin);
    setDestination(newDest);
    setWaypoints(cleanedWaypoints);
    setSelectedPreset('custom');
    setOptimizationNote(null);
    computeRoute(origin, newDest, cleanedWaypoints);
  };

  /**
   * Origin Change Handler:
   * Removes duplicate stops and recalculates immediately.
   */
  const handleOriginChange = (newOrigin) => {
    if (newOrigin === origin) return;
    const cleanedWaypoints = waypoints.filter((w) => w !== newOrigin && w !== destination);
    setOrigin(newOrigin);
    setWaypoints(cleanedWaypoints);
    setSelectedPreset('custom');
    setOptimizationNote(null);
    computeRoute(newOrigin, destination, cleanedWaypoints);
  };

  /**
   * Driver Change Handler:
   * Auto-loads that driver's own active/assigned route or clearly indicates 'No current route assigned'.
   * Auto-pairs vehicle and triggers map recalculation.
   */
  const handleDriverChange = useCallback((driverId) => {
    setSelectedDriverId(driverId);
    setDriverRouteStatus({
      loading: true,
      hasRoute: false,
      label: "Loading driver's assigned route...",
      tripId: null,
      status: null
    });

    const drv = (drivers || []).find((d) =>
      String(d?.id || d?.driverId || d?.driver_id || '').toLowerCase() === String(driverId).toLowerCase()
    );

    // Resolve driver route according to priority: Active > Assigned > Recent > None
    const route = getDriverCurrentRoute(driverId, drivers, trips);
    const pairedVehId = resolveVehicleForDriver(driverId, route, drivers, vehicles);
    if (pairedVehId) {
      setSelectedVehicleId(pairedVehId);
    }

    if (route && route.origin && route.destination) {
      // Driver HAS a route!
      setOrigin(route.origin);
      setDestination(route.destination);
      setWaypoints(route.waypoints || []);
      setSelectedPreset('custom');
      setOptimizationNote(null);
      setDriverRouteStatus({
        loading: false,
        hasRoute: true,
        label: `${route.type}: ${route.origin} → ${route.destination}`,
        tripId: route.tripId,
        status: route.status
      });

      // Recalculate route immediately
      computeRoute(route.origin, route.destination, route.waypoints || []);
    } else {
      // Driver has NO assigned / current route
      setDriverRouteStatus({
        loading: false,
        hasRoute: false,
        label: 'No current route assigned',
        tripId: null,
        status: null
      });

      // Do NOT copy another driver's route onto this driver.
      // Provide clean default corridor for creating a new route:
      setOrigin('Erode');
      setDestination('Coimbatore');
      setWaypoints([]);
      setSelectedPreset('custom');
      setOptimizationNote(null);
      computeRoute('Erode', 'Coimbatore', []);
    }
  }, [drivers, vehicles, trips, computeRoute]);

  // Initial driver and route selection on mount
  useEffect(() => {
    if (!hasInitializedDriverRef.current && drivers && drivers.length > 0) {
      hasInitializedDriverRef.current = true;
      const firstAvail = drivers.find((d) => {
        const s = (d.status || '').toLowerCase();
        return s === 'ready' || s === 'active' || s === 'offline';
      }) || drivers[0];

      const dId = String(firstAvail.id || firstAvail.driverId);
      handleDriverChange(dId);
    }
  }, [drivers, handleDriverChange]);

  // Synchronize AI Chat or Roster Highlighted Entity with Live Map
  useEffect(() => {
    if (highlightMapEntity) {
      if (highlightMapEntity.type === 'vehicle' || highlightMapEntity.vehicleId) {
        const vId = highlightMapEntity.id || highlightMapEntity.vehicleId;
        const matchingVeh = (vehicles || []).find((v) =>
          String(v.vehicleId || v.id).toUpperCase() === String(vId).toUpperCase()
        );
        if (matchingVeh) {
          setSelectedVehicleId(matchingVeh.vehicleId || matchingVeh.id);
          if (matchingVeh.location && matchingVeh.location !== destination) {
            setOrigin(matchingVeh.location);
          }
        }
      } else if (highlightMapEntity.type === 'driver' || highlightMapEntity.driverId) {
        const dId = highlightMapEntity.id || highlightMapEntity.driverId;
        handleDriverChange(dId);
      }
    }
  }, [highlightMapEntity, vehicles, destination, handleDriverChange]);

  // Handle Preset Selection
  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset.id);
    setOrigin(preset.origin);
    setDestination(preset.destination);
    setWaypoints([...preset.waypoints]);
    setOptimizationNote(null);
    computeRoute(preset.origin, preset.destination, [...preset.waypoints]);
  };

  // Add intermediate waypoint
  const handleAddWaypoint = () => {
    if (!newWaypoint) return;
    if (newWaypoint === origin || newWaypoint === destination || waypoints.includes(newWaypoint)) {
      showNotification('Waypoint is already part of the route.', 'warning');
      return;
    }
    const updated = [...waypoints, newWaypoint];
    setWaypoints(updated);
    setNewWaypoint('');
    setSelectedPreset('custom');
    setOptimizationNote(null);
    computeRoute(origin, destination, updated);
  };

  // Remove intermediate waypoint
  const handleRemoveWaypoint = (indexToRemove) => {
    const updated = waypoints.filter((_, idx) => idx !== indexToRemove);
    setWaypoints(updated);
    setSelectedPreset('custom');
    setOptimizationNote(null);
    computeRoute(origin, destination, updated);
  };

  // Optimize stop sequence using road network TSP
  const handleOptimizeSequence = async () => {
    if (waypoints.length <= 1) {
      showNotification('Add at least 2 intermediate stops to sequence.', 'info');
      return;
    }

    setRouteStatusMessage('Optimizing stop sequence using road network...');
    try {
      const { orderedWaypoints, savedKm, improvementPct, savedMinutes } = await solveOptimalStopSequence(
        origin,
        destination,
        waypoints
      );

      setWaypoints(orderedWaypoints);
      setSelectedPreset('custom');

      if (savedKm > 0 || savedMinutes > 0) {
        const timeNote = savedMinutes > 0 ? ` & ${savedMinutes}m` : '';
        setOptimizationNote(`Optimized sequence: Saved ~${savedKm} km${timeNote} (${improvementPct}% reduction)`);
        showNotification(`Route sequence optimized! Saved ${savedKm} km${timeNote}.`, 'success');
      } else {
        setOptimizationNote('Current stop sequence is already optimal.');
        showNotification('Sequence is already optimal.', 'info');
      }
      computeRoute(origin, destination, orderedWaypoints);
    } catch (err) {
      showNotification(`Sequence optimization error: ${err.message}`, 'error');
    }
  };

  // Dispatch Route directly to selected driver & vehicle
  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!selectedDriverId) {
      showNotification('Please select a driver for dispatch.', 'error');
      return;
    }
    if (!selectedVehicleId) {
      showNotification('Please select a vehicle for dispatch.', 'error');
      return;
    }

    setIsDispatching(true);
    try {
      const success = await assignRoute(
        selectedDriverId, 
        origin, 
        destination, 
        selectedVehicleId,
        {
          waypoints,
          distanceKm: routeData.distanceKm,
          duration: routeData.duration,
          routeGeometry: routeData.routeGeometry,
          statusSource: routeData.statusSource
        }
      );
      if (success) {
        setDriverRouteStatus({
          loading: false,
          hasRoute: true,
          label: `Active Trip: ${origin} → ${destination}`,
          tripId: `TR${String(selectedDriverId).replace(/\D/g, '')}`,
          status: 'Ongoing'
        });
        showNotification(
          `Dispatched ${selectedDriverId} with ${selectedVehicleId} on ${origin} → ${destination} (${routeData.distanceKm} km)!`,
          'success'
        );
      }
    } catch (err) {
      showNotification(err.message || 'Dispatch failed', 'error');
    } finally {
      setIsDispatching(false);
    }
  };

  // Towns available to add as intermediate stops
  const availableTownsForWaypoint = SAMPLE_TOWNS.filter(
    (t) => t !== origin && t !== destination && !waypoints.includes(t)
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header & Corridor Status Strip */}
      <div className="bg-[#1A1A1D] rounded-2xl p-6 border border-[#2A2A2E] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-[#252528] text-blue-400 border border-[#2A2A2E] shadow">
            <Navigation className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono tracking-wider uppercase bg-blue-950/60 text-blue-400 px-2 py-0.5 rounded border border-blue-800/40 font-bold">
                Corridor Dispatch Engine
              </span>
              <span className="text-[10px] font-mono uppercase bg-emerald-950/60 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/40 font-bold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>OSRM Live</span>
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-[#F5F5F5] tracking-tight mt-1">
              Dispatch & Corridor Routing
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              Real-time route optimization, road-following highway telemetry, and multi-stop fleet dispatch.
            </p>
          </div>
        </div>

        {/* Corridor Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mr-1">
            Corridors:
          </span>
          {CORRIDOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                selectedPreset === preset.id
                  ? 'bg-white text-[#0D0D0F] border-white shadow-md'
                  : 'bg-[#0D0D0F] text-[#9CA3AF] border-[#2A2A2E] hover:text-[#F5F5F5] hover:bg-[#252528]'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Main 2-Column Grid: Controls & Primary Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Route Optimization Controls & Stop Sequence (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1: Primary Dispatch & Route Configuration */}
          <div className="bg-[#1A1A1D] rounded-2xl p-6 border border-[#2A2A2E] shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Configuration</span>
                <h3 className="text-sm font-extrabold text-[#F5F5F5] uppercase tracking-wider flex items-center space-x-2 mt-0.5">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>Dispatch & Routing Setup</span>
                </h3>
              </div>
              <span className="text-[10px] text-[#9CA3AF] font-mono bg-[#0D0D0F] px-2.5 py-1 rounded-lg border border-[#2A2A2E]">
                {waypoints.length} Stop{waypoints.length !== 1 ? 's' : ''} Configured
              </span>
            </div>

            {/* Driver Route Status Indicator */}
            {driverRouteStatus.loading ? (
              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-blue-300 text-xs font-semibold flex items-center space-x-2 animate-pulse">
                <RotateCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>Loading driver's assigned route...</span>
              </div>
            ) : driverRouteStatus.hasRoute ? (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-semibold flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-[#F5F5F5]">{driverRouteStatus.label}</span>
                    <span className="text-[10px] text-emerald-400/80 block font-mono">
                      Auto-loaded driver's live trip route into dispatch configuration
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded font-bold border border-emerald-700/50">
                  {driverRouteStatus.status || 'Active'}
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#252528] border border-[#3F3F46] text-[#D4D4D8] text-xs font-semibold flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-[#F5F5F5]">Ready for Corridor Dispatch</span>
                    <span className="text-[10px] text-[#9CA3AF] block font-mono">
                      Driver and vehicle are available for assignment. Configure route below.
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-800/50">
                  Available
                </span>
              </div>
            )}

            {/* STEP 1: VEHICLE & DRIVER PAIRING */}
            <div className="space-y-3 pt-1">
              <span className="text-[11px] font-bold text-[#F5F5F5] uppercase tracking-wider flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span>1. Operational Asset Assignment</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Vehicle Picker */}
                <div>
                  <label className="block text-[10px] font-bold text-[#9CA3AF] uppercase mb-1">
                    Assign Vehicle
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-[#F5F5F5] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                  >
                    {vehicles.map((veh) => {
                      const vId = veh.id || veh.vehicleId;
                      const s = (veh.status || '').toLowerCase();
                      const isMaintenance = s === 'maintenance' || s === 'in_maintenance';

                      return (
                        <option 
                          key={vId} 
                          value={vId}
                          disabled={isMaintenance}
                        >
                          {vId} — {veh.reg_number || veh.reg_no} ({veh.model_name || veh.model}) [{veh.status || 'Active'}]{isMaintenance ? ' (In Maintenance)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Driver Picker */}
                <div>
                  <label className="block text-[10px] font-bold text-[#9CA3AF] uppercase mb-1">
                    Assign Driver
                  </label>
                  <select
                    data-testid="driver-dispatch-select"
                    value={selectedDriverId}
                    onChange={(e) => handleDriverChange(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-[#F5F5F5] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                  >
                    {drivers.map((drv) => {
                      const dId = drv.id || drv.driverId;
                      const s = (drv.status || '').toLowerCase();
                      const isUnavailable = s === 'on_trip' || s === 'on trip' || s === 'on_leave' || s === 'on leave';
                      const pairedVeh = vehicles.find((v) => 
                        String(v?.id || v?.vehicleId || '').toLowerCase() === String(drv.assigned_vehicle_id || '').toLowerCase()
                      );
                      const vehLabel = pairedVeh ? ` • ${pairedVeh.reg_number || pairedVeh.reg_no}` : '';

                      return (
                        <option 
                          key={dId} 
                          value={dId}
                          disabled={isUnavailable}
                        >
                          {dId} — {drv.name} [{drv.status}]{vehLabel}{isUnavailable ? ' (Unavailable)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* STEP 2: ORIGIN & DESTINATION */}
            <div className="space-y-3 pt-2 border-t border-[#2A2A2E]">
              <span className="text-[11px] font-bold text-[#F5F5F5] uppercase tracking-wider flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>2. Corridor Terminal Pair</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* ORIGIN SELECTOR */}
                <div>
                  <label className="block text-[10px] font-bold text-emerald-400 uppercase mb-1 flex items-center justify-between">
                    <span>Origin Dispatch Hub (A)</span>
                  </label>
                  <select
                    data-testid="origin-select"
                    value={origin}
                    onChange={(e) => handleOriginChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-[#F5F5F5] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    {SAMPLE_TOWNS.filter((t) => t !== destination).map((town) => (
                      <option key={town} value={town}>
                        {town} Logistics Hub
                      </option>
                    ))}
                  </select>
                </div>

                {/* DESTINATION SELECTOR */}
                <div>
                  <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1 flex items-center justify-between">
                    <span>Destination Delivery Station (B)</span>
                  </label>
                  <select
                    data-testid="destination-select"
                    value={destination}
                    onChange={(e) => handleDestinationChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-[#F5F5F5] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    {SAMPLE_TOWNS.filter((t) => t !== origin).map((town) => (
                      <option key={town} value={town}>
                        {town} Terminal
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* STEP 3: INTERMEDIATE STOPS MANAGER */}
            <div className="space-y-3 pt-2 border-t border-[#2A2A2E]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#F5F5F5] uppercase tracking-wider flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>3. Intermediate Stops</span>
                </span>
                {waypoints.length > 1 && (
                  <button
                    type="button"
                    data-testid="optimize-sequence-btn"
                    onClick={handleOptimizeSequence}
                    className="text-[11px] text-amber-300 hover:text-white font-bold flex items-center space-x-1.5 bg-amber-950/60 border border-amber-700/60 px-2.5 py-1 rounded-lg transition-all shadow-sm"
                    title="Run TSP algorithm to find the most fuel-efficient sequence"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Optimize Sequence</span>
                  </button>
                )}
              </div>

              {/* Waypoints List */}
              {waypoints.length === 0 ? (
                <div className="p-3 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-center text-xs text-[#9CA3AF]">
                  Direct express route (no intermediate stops added).
                </div>
              ) : (
                <div className="space-y-2">
                  {waypoints.map((wp, idx) => (
                    <div
                      key={`${wp}-${idx}`}
                      className="p-2.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] flex items-center justify-between text-xs hover:border-[#3F3F46] transition-colors"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="w-5 h-5 rounded-full bg-amber-950 text-amber-400 border border-amber-800/60 font-mono text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-[#F5F5F5]">{wp} Station</span>
                          <span className="text-[10px] text-[#9CA3AF] block font-mono">Stop #{idx + 1} in route sequence</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveWaypoint(idx)}
                        className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Remove Stop"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Waypoint Row */}
              {availableTownsForWaypoint.length > 0 && (
                <div className="flex items-center space-x-2 pt-1">
                  <select
                    data-testid="stop-add-select"
                    value={newWaypoint}
                    onChange={(e) => setNewWaypoint(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-[#F5F5F5] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                  >
                    <option value="">+ Select Stop to Add...</option>
                    {availableTownsForWaypoint.map((t) => (
                      <option key={t} value={t}>
                        {t} Waystation
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    data-testid="add-stop-btn"
                    onClick={handleAddWaypoint}
                    disabled={!newWaypoint}
                    className="px-4 py-2.5 rounded-xl bg-[#252528] hover:bg-[#3F3F46] text-[#F5F5F5] text-xs font-bold border border-[#2A2A2E] disabled:opacity-40 transition-colors flex items-center space-x-1.5 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Stop</span>
                  </button>
                </div>
              )}

              {optimizationNote && (
                <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-[11px] font-semibold flex items-center space-x-1.5 animate-fadeIn">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                  <span>{optimizationNote}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Route Summary & Dispatch Action */}
          <div className="bg-[#1A1A1D] rounded-2xl p-6 border border-[#2A2A2E] shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Telemetry</span>
                <h3 className="text-sm font-extrabold text-[#F5F5F5] uppercase tracking-wider flex items-center space-x-2 mt-0.5">
                  <Navigation className="w-4 h-4 text-emerald-400" />
                  <span>Route Summary & Optimization</span>
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-1 rounded-lg font-bold">
                OSRM Real Highway
              </span>
            </div>

            {/* 4 Key Statistics Tiles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E]">
                <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block">Road Distance</span>
                <span className="text-lg font-extrabold text-[#F5F5F5] mt-0.5 block">{routeData.distanceKm} km</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E]">
                <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block">Estimated Duration</span>
                <span className="text-lg font-extrabold text-emerald-400 mt-0.5 block">{routeData.duration}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E]">
                <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block">Highway Routing</span>
                <span className="text-xs font-bold text-[#F5F5F5] mt-1 truncate block">
                  {routeData.isRoadFollowing ? 'OSRM Road Following' : 'Corridor Route'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E]">
                <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block">Total Points</span>
                <span className="text-xs font-bold text-cyan-300 mt-1 block font-mono">
                  {waypoints.length + 2} Stations
                </span>
              </div>
            </div>

            {/* Direct Dispatch Submit CTA */}
            <button
              type="button"
              data-testid="dispatch-button"
              onClick={handleDispatch}
              disabled={isDispatching || !selectedDriverId || !selectedVehicleId}
              className="w-full py-3.5 rounded-xl bg-white hover:bg-neutral-200 text-[#0D0D0F] font-extrabold text-xs shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isDispatching ? (
                <div className="w-4 h-4 border-2 border-[#0D0D0F] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>DISPATCH OPTIMIZED ROUTE NOW</span>
                </>
              )}
            </button>
          </div>

          {/* Card 3: Optimized Stop Sequence Timeline */}
          <div className="bg-[#1A1A1D] rounded-2xl p-6 border border-[#2A2A2E] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
              <h3 className="text-sm font-extrabold text-[#F5F5F5] uppercase tracking-wider flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Optimized Stop Sequence</span>
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                {waypoints.length + 2} Total Points
              </span>
            </div>

            {/* Step-by-step corridor timeline */}
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#2A2A2E]">
              {/* Origin Point */}
              <div className="relative">
                <span className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-950 border-2 border-emerald-400 flex items-center justify-center text-[9px] font-bold text-emerald-300">
                  A
                </span>
                <div className="bg-[#0D0D0F] p-3 rounded-xl border border-[#2A2A2E]">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#F5F5F5] text-xs">{origin} Hub</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Origin</span>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] block mt-0.5">Corridor dispatch departure depot</span>
                </div>
              </div>

              {/* Waypoints */}
              {waypoints.map((wp, idx) => {
                const legInfo = routeData.legs[idx];
                return (
                  <div key={`step-${wp}-${idx}`} className="relative">
                    <span className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-amber-950 border-2 border-amber-400 flex items-center justify-center text-[9px] font-bold text-amber-300">
                      {idx + 1}
                    </span>
                    <div className="bg-[#0D0D0F] p-3 rounded-xl border border-[#2A2A2E]">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#F5F5F5] text-xs">{wp} Waystation</span>
                        <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">Stop {idx + 1}</span>
                      </div>
                      {legInfo && (
                        <div className="flex items-center space-x-3 text-[10px] text-[#9CA3AF] font-mono mt-1 pt-1 border-t border-[#1F1F23]">
                          <span>Leg Distance: <strong className="text-[#F5F5F5]">{legInfo.distanceKm} km</strong></span>
                          <span>Est: <strong className="text-[#F5F5F5]">{legInfo.duration}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Destination Point */}
              <div className="relative">
                <span className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-blue-950 border-2 border-blue-400 flex items-center justify-center text-[9px] font-bold text-blue-300">
                  B
                </span>
                <div className="bg-[#0D0D0F] p-3 rounded-xl border border-[#2A2A2E]">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#F5F5F5] text-xs">{destination} Terminal</span>
                    <span className="text-[10px] font-mono text-blue-400 font-bold uppercase">Destination</span>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] block mt-0.5">Final freight delivery station</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Primary Interactive Leaflet Map (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="bg-[#1A1A1D] rounded-2xl p-5 border border-[#2A2A2E] shadow-xl space-y-4">
            
            {/* Map Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2A2E] pb-3.5">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E]">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-extrabold text-[#F5F5F5] tracking-tight">
                      Primary Highway Route Map
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/40 font-bold">
                      Interactive Leaflet
                    </span>
                    {routeData.loading && (
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2.5 py-0.5 rounded-full flex items-center space-x-1 animate-pulse">
                        <RotateCw className="w-3 h-3 animate-spin text-amber-400" />
                        <span>Updating optimized route...</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9CA3AF] flex items-center space-x-1.5 mt-0.5">
                    <span>{origin}</span>
                    <ArrowRight className="w-3 h-3 text-[#9CA3AF]" />
                    {waypoints.map((w) => (
                      <React.Fragment key={w}>
                        <span className="text-amber-400 font-semibold">{w}</span>
                        <ArrowRight className="w-3 h-3 text-[#9CA3AF]" />
                      </React.Fragment>
                    ))}
                    <span>{destination}</span>
                  </p>
                </div>
              </div>

              {/* Status & Re-center button */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => computeRoute(origin, destination, waypoints)}
                  className="px-3 py-1.5 rounded-xl bg-[#252528] hover:bg-[#3F3F46] text-[#F5F5F5] text-xs font-bold border border-[#2A2A2E] transition-colors flex items-center space-x-1.5"
                  title="Recalculate route and center map"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${routeData.loading ? 'animate-spin' : ''}`} />
                  <span>Recalculate</span>
                </button>
              </div>
            </div>

            {/* Primary Interactive Map Container */}
            <div className="relative w-full h-[740px] lg:h-[820px] xl:h-[860px] rounded-xl overflow-hidden border border-[#2A2A2E] bg-[#0D0D0F] shadow-2xl transition-all">
              <InteractiveFleetMap
                origin={origin}
                destination={destination}
                waypoints={waypoints}
                routeGeometry={routeData.routeGeometry}
                distanceKm={routeData.distanceKm}
                duration={routeData.duration}
                statusSource={routeData.statusSource}
                vehicles={vehicles}
                drivers={drivers}
                highlightedEntity={highlightMapEntity}
                loading={routeData.loading}
                error={routeData.error}
                onRetry={() => computeRoute(origin, destination, waypoints)}
                onSelectVehicle={(veh) => {
                  setSelectedVehicleId(veh.vehicleId || veh.id);
                  showNotification(`Selected ${veh.vehicleId || veh.id} (${veh.fuel_level ?? veh.fuelLevel}% Fuel, ${veh.status})`, 'info');
                }}
                onSelectDriver={(drv) => {
                  handleDriverChange(drv.driverId || drv.id);
                  showNotification(`Selected driver ${drv.name} (${drv.driverId || drv.id})`, 'info');
                }}
                height="100%"
                showHud={true}
                interactive={true}
              />
            </div>

            {/* Bottom Telemetry Info Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] flex items-center space-x-3">
                <Navigation className="w-5 h-5 text-blue-400" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block">Road Distance</span>
                  <span className="text-sm font-extrabold text-[#F5F5F5]">{routeData.distanceKm} km</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] flex items-center space-x-3">
                <Clock className="w-5 h-5 text-emerald-400" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block">Est. Duration</span>
                  <span className="text-sm font-extrabold text-[#F5F5F5]">{routeData.duration}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] flex items-center space-x-3">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block">Route Status</span>
                  <span className="text-xs font-bold text-amber-300 truncate block">
                    {routeData.loading
                      ? (routeStatusMessage || 'Updating route...')
                      : (routeData.isRoadFollowing ? 'Road Following Active' : 'Standard Corridor Route')}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default DispatchRoutingView;
