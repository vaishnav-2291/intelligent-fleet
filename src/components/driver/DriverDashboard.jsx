import React, { useState, useEffect, useMemo } from 'react';
import { useFleet } from '../../context/FleetContext';
import { SAMPLE_TOWNS } from '../../data/mockData';
import { getRoadFollowingRoute } from '../../services/routeOptimizer';
import { 
  Play, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Navigation, 
  Truck, 
  LogOut, 
  Shield, 
  Radio, 
  Activity, 
  ArrowRight,
  RotateCcw,
  Compass,
  Layers,
  AlertCircle
} from 'lucide-react';
import { InteractiveFleetMap, resolvePointCoords } from '../common/InteractiveFleetMap';
import { FleetAIChatView } from '../admin/FleetAIChatView';
import { DriverLiveLocationControl } from './DriverLiveLocationControl';

export const DriverDashboard = () => {
  const { 
    currentUser, 
    drivers, 
    vehicles, 
    trips,
    startDuty, 
    goOffline, 
    startTrip, 
    completeTrip, 
    resetDuty, 
    logout, 
    switchToAdminView,
    refreshFleetData 
  } = useFleet();

  // Strict RBAC: Real Driver sessions must NEVER render or access the Admin Dashboard control.
  // Only administrative sessions explicitly previewing a driver profile may have the return control.
  const authRoleUpper = String(currentUser?.authenticatedRole || '').trim().toUpperCase();
  const uiRoleLower = String(currentUser?.role || '').trim().toLowerCase();
  const isRealDriver = authRoleUpper === 'DRIVER' || 
    (uiRoleLower === 'driver' && authRoleUpper !== 'ADMIN' && authRoleUpper !== 'FLEET_MANAGER' && authRoleUpper !== 'DISPATCHER');
  const canSwitchToAdmin = !isRealDriver && ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER'].includes(authRoleUpper);

  // Resolve current active driver record
  const currentDriver = drivers.find((d) => 
    String(d.id || d.driverId).toUpperCase() === String(currentUser?.driverId || '').toUpperCase()
  ) || (currentUser?.role === 'driver' && currentUser?.driverId ? {
    id: currentUser.driverId,
    driverId: currentUser.driverId,
    name: currentUser.name || 'Driver Arun Kumar',
    phone: currentUser.phone || '+91 91234 56789',
    status: 'Ready'
  } : (drivers[0] || {
    id: 'DR001',
    driverId: 'DR001',
    name: 'Driver Arun Kumar',
    phone: '+91 91234 56789',
    status: 'Ready'
  }));

  const driverIdStr = String(currentDriver?.id || currentDriver?.driverId || '').toUpperCase();

  // Poll route assignment updates using existing live sync
  useEffect(() => {
    refreshFleetData().catch(() => {});
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshFleetData().catch(() => {});
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [refreshFleetData]);

  // Find active/ongoing trip assigned to this driver
  const assignedTrip = (trips || []).find((t) => {
    const tDriverId = String(t.driver_id || t.driverId || '').toUpperCase();
    const tStatus = (t.status || '').toLowerCase();
    return tDriverId === driverIdStr && ['ongoing', 'assigned', 'dispatched', 'in_transit', 'on trip', 'on_trip'].includes(tStatus);
  });

  // Resolve unified assigned route object
  const assignedRoute = useMemo(() => {
    // 1. Direct assigned route on driver record (from Dispatch & Routing)
    if (currentDriver?.assigned_route?.source && currentDriver?.assigned_route?.destination) {
      return currentDriver.assigned_route;
    }
    // 2. Active trip from trips collection if driver has an assigned route/trip
    const driverStatusLower = String(currentDriver?.status || '').toLowerCase();
    if (['assigned', 'on trip', 'on_trip', 'active', 'ready'].includes(driverStatusLower) && (assignedTrip?.destination || assignedTrip?.to)) {
      const src = assignedTrip.origin || assignedTrip.source || assignedTrip.from || 'Coimbatore';
      const dest = assignedTrip.destination || assignedTrip.to || 'Chennai';
      return {
        source: src,
        origin: src,
        destination: dest,
        waypoints: assignedTrip.waypoints || assignedTrip.stops || [],
        distance_km: assignedTrip.distance_km || assignedTrip.distanceKm,
        distanceKm: assignedTrip.distance_km || assignedTrip.distanceKm,
        estimated_duration: assignedTrip.estimated_duration || assignedTrip.duration,
        duration: assignedTrip.estimated_duration || assignedTrip.duration,
        tripId: assignedTrip.id || assignedTrip.tripId,
        vehicleId: assignedTrip.vehicle_id || assignedTrip.vehicleId || currentDriver?.assigned_vehicle_id,
        routeGeometry: assignedTrip.route_geometry || assignedTrip.routeGeometry
      };
    }
    return null;
  }, [currentDriver?.assigned_route, currentDriver?.status, assignedTrip, currentDriver?.assigned_vehicle_id]);

  const hasAssignedRoute = Boolean(assignedRoute?.source && assignedRoute?.destination);

  // Match assigned vehicle
  const assignedVehicle = vehicles.find((v) => {
    const targetVehId = assignedRoute?.vehicleId || currentDriver?.assigned_vehicle_id;
    return String(v.id || v.vehicleId).toUpperCase() === String(targetVehId || '').toUpperCase() ||
           String(v.assigned_driver_id || v.assigned_driver).toUpperCase() === driverIdStr;
  });

  const [selectedLocation, setSelectedLocation] = useState(SAMPLE_TOWNS[0]);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);
  const [isLoadingGeometry, setIsLoadingGeometry] = useState(false);

  // Load or compute real OSRM road geometry for the assigned route
  useEffect(() => {
    if (!hasAssignedRoute) {
      setRouteGeometry(null);
      setRouteDistance(null);
      setRouteDuration(null);
      return;
    }

    const src = assignedRoute.source;
    const dest = assignedRoute.destination;
    const waypoints = assignedRoute.waypoints || [];

    // If high-density road geometry is already pre-computed, use it
    if (Array.isArray(assignedRoute.routeGeometry) && assignedRoute.routeGeometry.length > 1) {
      setRouteGeometry(assignedRoute.routeGeometry);
      setRouteDistance(assignedRoute.distance_km);
      setRouteDuration(assignedRoute.estimated_duration);
      return;
    }

    let isCurrent = true;
    setIsLoadingGeometry(true);
    getRoadFollowingRoute(src, dest, waypoints)
      .then((res) => {
        if (!isCurrent) return;
        if (res.success && Array.isArray(res.routeGeometry)) {
          setRouteGeometry(res.routeGeometry);
        }
        if (res.distanceKm) {
          setRouteDistance(res.distanceKm);
        }
        if (res.duration) {
          setRouteDuration(res.duration);
        }
      })
      .catch((err) => {
        if (isCurrent) console.warn('Error computing road geometry for driver:', err);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingGeometry(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [
    assignedRoute?.source,
    assignedRoute?.destination,
    JSON.stringify(assignedRoute?.waypoints || []),
    assignedRoute?.routeGeometry
  ]);

  // Driver current position with coordinates for Leaflet map
  const driverLocationName = currentDriver.self_reported_location || currentDriver.currentLocation || selectedLocation || 'Coimbatore';
  const driverCoords = resolvePointCoords(driverLocationName) || [11.0140, 76.9520];
  const driverWithCoords = useMemo(() => ({
    ...currentDriver,
    latitude: currentDriver.latitude ?? driverCoords[0],
    longitude: currentDriver.longitude ?? driverCoords[1],
    currentLocation: driverLocationName
  }), [currentDriver, driverLocationName, driverCoords]);

  const [isStartingDuty, setIsStartingDuty] = useState(false);
  const [isEndingDuty, setIsEndingDuty] = useState(false);

  const handleStartDutyClick = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isStartingDuty) return;
    setIsStartingDuty(true);
    try {
      await startDuty(currentDriver.id || currentDriver.driverId, selectedLocation);
    } finally {
      setIsStartingDuty(false);
    }
  };

  const handleGoOfflineClick = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isEndingDuty) return;
    setIsEndingDuty(true);
    try {
      await goOffline(currentDriver.id || currentDriver.driverId);
    } finally {
      setIsEndingDuty(false);
    }
  };

  const statusBadgeColors = {
    offline: 'bg-zinc-900 text-zinc-400 border-zinc-800',
    ready: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
    active: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
    assigned: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
    assigned_route: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
    on_trip: 'bg-blue-950/60 text-blue-300 border-blue-800/40',
    completed: 'bg-zinc-900 text-zinc-300 border-zinc-700',

    Offline: 'bg-zinc-900 text-zinc-400 border-zinc-800',
    Ready: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
    Active: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
    Assigned: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
    'Assigned Route': 'bg-amber-950/60 text-amber-300 border-amber-800/40',
    'On Trip': 'bg-blue-950/60 text-blue-300 border-blue-800/40',
    Completed: 'bg-zinc-900 text-zinc-300 border-zinc-700'
  };

  const driverStatusStr = (currentDriver.status || 'ready').toLowerCase();
  const isOffDuty = driverStatusStr === 'ready' || driverStatusStr === 'offline';
  const isTripCompleted = driverStatusStr === 'completed';

  return (
    <div className="min-h-screen bg-transparent text-[#F5F5F5] flex flex-col select-none">
      {/* Driver Top Navigation Header */}
      <header className="bg-[#1A1A1D] border-b border-[#2A2A2E] sticky top-0 z-30 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          
          {/* Left: Driver Profile */}
          <div className="flex items-center space-x-3.5">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold text-[#F5F5F5] tracking-tight">{currentDriver.name}</h1>
                <span className="text-xs text-[#9CA3AF]">({currentDriver.phone})</span>
              </div>
              <p className="text-xs text-[#9CA3AF]">Driver Portal • ID: #{currentDriver.id}</p>
            </div>
          </div>

          {/* Right: Status Badge & Quick Actions */}
          <div className="flex items-center space-x-3">
            <div className={`px-3.5 py-1.5 rounded-full text-xs font-bold border flex items-center space-x-2 uppercase ${statusBadgeColors[currentDriver.status] || statusBadgeColors.ready}`}>
              <span className={`w-2 h-2 rounded-full ${
                driverStatusStr === 'on_trip' || currentDriver.status === 'On Trip' ? 'bg-blue-400 animate-ping' :
                driverStatusStr === 'active' ? 'bg-emerald-400 animate-pulse' :
                driverStatusStr === 'ready' ? 'bg-emerald-400' :
                driverStatusStr === 'assigned' ? 'bg-amber-400' : 'bg-zinc-400'
              }`}></span>
              <span data-testid="driver-status-badge">{currentDriver.status}</span>
            </div>

            {canSwitchToAdmin && (
              <button
                type="button"
                data-testid="admin-dashboard-return-btn"
                onClick={switchToAdminView}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#252528] hover:bg-[#3F3F46] border border-[#2A2A2E] text-[#F5F5F5] text-xs font-bold transition-all"
                title="Return to Admin Dashboard"
              >
                <Shield className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Admin Dashboard</span>
              </button>
            )}

            <button
              type="button"
              onClick={logout}
              className="px-3 py-2 rounded-xl bg-[#252528] border border-[#2A2A2E] text-[#9CA3AF] hover:text-rose-400 hover:border-rose-900/50 transition-colors flex items-center space-x-1.5 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-semibold">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col space-y-4">
        {/* Continuous Device GPS Telemetry Ingestion Control */}
        <DriverLiveLocationControl
          driverId={currentDriver.driverId || currentDriver.id}
          driverName={currentDriver.name}
        />
        
        {/* ==================== 1. OFF DUTY (Ready/Offline) ==================== */}
        {isOffDuty && (
          <div className="bg-[#1A1A1D] p-8 sm:p-12 rounded-3xl text-center max-w-xl mx-auto border border-[#2A2A2E] shadow-2xl animate-fadeIn">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#252528] border border-[#2A2A2E] flex items-center justify-center text-[#F5F5F5] shadow-xl mb-6">
              <Radio className="w-8 h-8 animate-pulse text-[#F5F5F5]" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5]">Start Your Duty Shift</h2>
            <p className="mt-2 text-sm text-[#9CA3AF] leading-relaxed max-w-md mx-auto">
              Once you start duty, dispatch managers will be able to view your location and assign available vehicle routes.
            </p>

            {/* Location Sharing Dropdown */}
            <div className="mt-8 text-left bg-[#0D0D0F] p-5 rounded-2xl border border-[#2A2A2E] space-y-2">
              <label className="flex items-center space-x-2 text-xs font-semibold text-[#9CA3AF]">
                <MapPin className="w-4 h-4 text-[#F5F5F5]" />
                <span>Share Location (Reporting Hub)</span>
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#1A1A1D] border border-[#2A2A2E] text-[#F5F5F5] text-sm focus:outline-none focus:ring-2 focus:ring-white transition-all cursor-pointer"
              >
                {SAMPLE_TOWNS.map((town) => (
                  <option key={town} value={town}>
                    📍 {town} Hub
                  </option>
                ))}
              </select>
            </div>

            {/* Solid White Start Duty Button */}
            <button
              type="button"
              data-testid="start-duty-button"
              disabled={isStartingDuty}
              onClick={handleStartDutyClick}
              className="mt-8 w-full py-4 px-8 rounded-2xl bg-white hover:bg-neutral-200 text-[#0D0D0F] font-extrabold text-base shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isStartingDuty ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#0D0D0F] border-t-transparent rounded-full animate-spin"></div>
                  <span>STARTING DUTY SHIFT...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>START DUTY NOW</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* ==================== 2. ON DUTY (Active, Assigned, or On Trip) ==================== */}
        {!isOffDuty && !isTripCompleted && (
          <>
            {/* 2A: Waiting for Route Assignment (no route yet) */}
            {!hasAssignedRoute ? (
              <div className="bg-[#1A1A1D] p-8 sm:p-12 rounded-3xl text-center max-w-xl mx-auto border border-[#2A2A2E] shadow-2xl animate-fadeIn">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[#252528] border border-[#2A2A2E] flex items-center justify-center text-[#F5F5F5] shadow-lg mb-6">
                  <Navigation className="w-8 h-8 text-emerald-400" />
                </div>

                <h2 className="text-2xl font-bold text-[#F5F5F5]">Waiting for Route Assignment...</h2>
                <p className="mt-2 text-sm text-[#9CA3AF]">
                  You are marked as <span className="text-emerald-400 font-semibold uppercase">Active Duty</span> on the Fleet Dispatcher board.
                </p>

                <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 bg-[#0D0D0F] px-5 py-3 rounded-2xl border border-[#2A2A2E] text-xs text-[#9CA3AF]">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Duty Started: <strong className="text-[#F5F5F5]">{currentDriver.duty_start_time_str || 'Just now'}</strong></span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="w-4 h-4 text-[#F5F5F5]" />
                    <span>Location: <strong className="text-[#F5F5F5]">{driverLocationName}</strong></span>
                  </div>
                </div>

                <div className="mt-10 pt-6 border-t border-[#2A2A2E]">
                  <button
                    type="button"
                    data-testid="go-offline-button"
                    disabled={isEndingDuty}
                    onClick={handleGoOfflineClick}
                    className="px-5 py-2.5 rounded-xl bg-[#252528] hover:bg-[#3F3F46] text-[#9CA3AF] hover:text-rose-400 border border-[#2A2A2E] text-xs font-semibold transition-colors disabled:opacity-60"
                  >
                    {isEndingDuty ? 'Ending Duty...' : 'Go Offline / Take Break'}
                  </button>
                </div>
              </div>
            ) : (
              /* 2B: Enterprise Driver Route View (Assigned / On Trip) */
              <div data-testid="driver-route-view" className="space-y-6 animate-fadeIn">
                {/* Route Overview Header Card */}
                <div className="bg-[#1A1A1D] rounded-3xl p-6 sm:p-8 border border-[#2A2A2E] shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2E] pb-5 mb-6">
                    <div className="flex items-center space-x-3.5">
                      <div className="p-3 rounded-2xl bg-[#252528] border border-[#2A2A2E] text-emerald-400 shadow">
                        <Navigation className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            driverStatusStr === 'on_trip' || currentDriver.status === 'On Trip'
                              ? 'bg-blue-950/60 text-blue-300 border-blue-800/40'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
                          }`}>
                            {driverStatusStr === 'on_trip' || currentDriver.status === 'On Trip' ? 'En Route (Active Trip)' : 'Assigned (Ready for Dispatch)'}
                          </span>
                          <span className="text-[10px] font-mono text-[#9CA3AF] bg-[#0D0D0F] px-2 py-0.5 rounded border border-[#2A2A2E]">
                            Trip #{assignedRoute.tripId || `TR${driverIdStr.replace(/\D/g, '')}`}
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-[#F5F5F5] tracking-tight mt-1">
                          {assignedRoute.source} → {assignedRoute.destination}
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-xs">
                      <div className="px-3.5 py-2 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-right">
                        <span className="text-[10px] text-[#9CA3AF] uppercase block font-semibold">Assigned Asset</span>
                        <span className="font-bold text-[#F5F5F5] flex items-center space-x-1 mt-0.5">
                          <Truck className="w-3.5 h-3.5 text-amber-400 inline" />
                          <span>{assignedVehicle?.reg_number || assignedVehicle?.reg_no || assignedRoute.vehicleId || 'Assigned Vehicle'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Route Key Telemetry Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    <div className="p-4 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E]">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Origin Hub</span>
                      <p className="text-sm sm:text-base font-extrabold text-[#F5F5F5] mt-1 truncate">{assignedRoute.source}</p>
                      <span className="text-[10px] text-[#9CA3AF]">Departure Hub</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E]">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Destination</span>
                      <p className="text-sm sm:text-base font-extrabold text-[#F5F5F5] mt-1 truncate">{assignedRoute.destination}</p>
                      <span className="text-[10px] text-[#9CA3AF]">Delivery Station</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E]">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">Total Distance</span>
                      <p className="text-sm sm:text-base font-extrabold text-[#F5F5F5] mt-1">
                        {routeDistance || assignedRoute.distance_km || 100} km
                      </p>
                      <span className="text-[10px] text-[#9CA3AF]">OSRM Highway Distance</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E]">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Travel Time / ETA</span>
                      <p className="text-sm sm:text-base font-extrabold text-[#F5F5F5] mt-1">
                        {routeDuration || assignedRoute.estimated_duration || '1h 30m'}
                      </p>
                      <span className="text-[10px] text-[#9CA3AF]">Traffic Corridor Estimate</span>
                    </div>
                  </div>

                  {/* Ordered Stop / Waypoint Sequence */}
                  <div className="mt-5 p-4 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E]">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-bold text-[#F5F5F5] uppercase tracking-wider flex items-center space-x-1.5">
                        <Compass className="w-3.5 h-3.5 text-amber-400" />
                        <span>Optimized Stop Sequence</span>
                      </span>
                      <span className="text-[10px] text-[#9CA3AF]">
                        {assignedRoute.waypoints && assignedRoute.waypoints.length > 0 
                          ? `${assignedRoute.waypoints.length} Intermediate Stop${assignedRoute.waypoints.length > 1 ? 's' : ''}`
                          : 'Direct Route (0 intermediate stops)'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-800/40 text-emerald-300 font-bold flex items-center space-x-1">
                        <span>A</span>
                        <span>{assignedRoute.source}</span>
                      </span>

                      {Array.isArray(assignedRoute.waypoints) && assignedRoute.waypoints.map((wp, idx) => {
                        const wpName = typeof wp === 'string' ? wp : (wp?.name || wp?.label || `Stop ${idx + 1}`);
                        return (
                          <React.Fragment key={idx}>
                            <ArrowRight className="w-3.5 h-3.5 text-[#9CA3AF]" />
                            <span className="px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-800/40 text-amber-300 font-bold flex items-center space-x-1">
                              <span>#{idx + 1}</span>
                              <span>{wpName}</span>
                            </span>
                          </React.Fragment>
                        );
                      })}

                      <ArrowRight className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      <span className="px-2.5 py-1 rounded-lg bg-blue-950/50 border border-blue-800/40 text-blue-300 font-bold flex items-center space-x-1">
                        <span>B</span>
                        <span>{assignedRoute.destination}</span>
                      </span>
                    </div>
                  </div>

                  {/* Driver Current Location Status */}
                  <div className="mt-4 pt-4 border-t border-[#2A2A2E] flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#9CA3AF] gap-2">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Current Reported Location: <strong className="text-[#F5F5F5]">{driverLocationName}</strong></span>
                    </div>
                    <div>
                      <span>Duty Clock-in: <strong className="text-[#F5F5F5]">{currentDriver.duty_start_time_str || 'Today'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Leaflet Interactive Route Map */}
                <div className="rounded-3xl border border-[#2A2A2E] bg-[#1A1A1D] overflow-hidden shadow-2xl">
                  <div className="px-5 py-3.5 bg-[#16161A] border-b border-[#2A2A2E] flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                      <span className="text-xs font-bold text-[#F5F5F5] uppercase tracking-wider">
                        Optimized Route Navigation Map
                      </span>
                      {isLoadingGeometry && (
                        <span className="text-[10px] text-cyan-400 font-medium">Computing road geometry...</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] text-[#9CA3AF]">
                      <span className="px-2 py-0.5 rounded bg-[#0D0D0F] border border-[#2A2A2E] font-semibold text-emerald-300">
                        OSRM Highway Polyline
                      </span>
                    </div>
                  </div>

                  <div className="relative w-full h-96 sm:h-[420px] bg-[#0D0D0F]">
                    <InteractiveFleetMap
                      origin={assignedRoute.source}
                      destination={assignedRoute.destination}
                      waypoints={assignedRoute.waypoints || []}
                      routeGeometry={routeGeometry}
                      duration={routeDuration || assignedRoute.estimated_duration}
                      distanceKm={routeDistance || assignedRoute.distance_km}
                      drivers={[driverWithCoords]}
                      showDrivers={true}
                      vehicles={assignedVehicle ? [assignedVehicle] : []}
                      showVehicles={Boolean(assignedVehicle)}
                      height="100%"
                    />
                  </div>
                </div>

                {/* Dispatch & Trip Controls */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  {!(driverStatusStr === 'on_trip' || currentDriver.status === 'On Trip') ? (
                    <button
                      type="button"
                      data-testid="start-trip-button"
                      onClick={() => startTrip(currentDriver.id)}
                      className="w-full sm:flex-1 py-4 px-8 rounded-2xl bg-white hover:bg-neutral-200 text-[#0D0D0F] font-extrabold text-base shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-3"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      <span>START TRIP NOW</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid="complete-trip-button"
                      onClick={() => completeTrip(currentDriver.id)}
                      className="w-full sm:flex-1 py-4 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#0D0D0F] font-extrabold text-base shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-3"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>MARK TRIP AS COMPLETED</span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="go-offline-button"
                    disabled={isEndingDuty}
                    onClick={handleGoOfflineClick}
                    className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-[#252528] hover:bg-[#3F3F46] text-[#9CA3AF] hover:text-rose-400 border border-[#2A2A2E] text-xs font-bold transition-all disabled:opacity-60"
                  >
                    {isEndingDuty ? 'Ending Duty...' : 'Go Offline / Take Break'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== 3. TRIP COMPLETED ==================== */}
        {isTripCompleted && (
          <div className="bg-[#1A1A1D] p-8 sm:p-12 rounded-3xl text-center max-w-xl mx-auto border border-[#2A2A2E] shadow-2xl animate-fadeIn">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#252528] border border-[#2A2A2E] flex items-center justify-center text-emerald-400 shadow-lg mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold text-[#F5F5F5]">Trip Completed!</h2>
            <p className="mt-2 text-sm text-[#9CA3AF]">
              Great job! Your trip has been logged and the vehicle returned to the operational fleet pool.
            </p>

            <div className="mt-6 bg-[#0D0D0F] p-5 rounded-2xl border border-[#2A2A2E] text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Completed Route:</span>
                <span className="font-bold text-[#F5F5F5]">{assignedRoute?.source || 'Erode'} → {assignedRoute?.destination || 'Coimbatore'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Duty Shift:</span>
                <span className="font-semibold text-[#F5F5F5]">{currentDriver.duty_start_time_str || 'Completed Shift'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Status:</span>
                <span className="font-bold text-emerald-400">Logged & Closed</span>
              </div>
            </div>

            <button
              onClick={() => resetDuty(currentDriver.id)}
              className="mt-8 w-full py-3.5 px-6 rounded-xl bg-[#252528] hover:bg-[#3F3F46] text-[#F5F5F5] border border-[#2A2A2E] font-bold text-sm transition-all flex items-center justify-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Start New Duty Shift</span>
            </button>
          </div>
        )}
      </main>

      {/* Floating FleetAI Assistant for Drivers */}
      <FleetAIChatView />
    </div>
  );
};
