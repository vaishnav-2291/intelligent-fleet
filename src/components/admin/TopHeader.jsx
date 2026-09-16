import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFleet } from '../../context/FleetContext';
import { 
  Menu, 
  Search, 
  LogOut, 
  Bell, 
  ArrowRightLeft, 
  Truck, 
  User, 
  Route, 
  X, 
  AlertTriangle, 
  Wrench, 
  Fuel, 
  CheckCircle2,
  Clock
} from 'lucide-react';

export const TopHeader = ({ setMobileOpen, setActiveTab }) => {
  const { 
    logout, 
    drivers, 
    vehicles, 
    trips, 
    maintenance, 
    safetyAlerts, 
    stats, 
    login,
    setHighlightMapEntity,
    currentUser,
    switchToDriverPreview
  } = useFleet();

  const [timeString, setTimeString] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState(new Set());

  const searchContainerRef = useRef(null);
  const notifContainerRef = useRef(null);

  // Live Digital Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Authoritative Search Filtering across loaded live data
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { vehicles: [], drivers: [], trips: [], total: 0 };

    const matchedVehicles = (vehicles || []).filter((v) => {
      const vId = String(v.vehicleId || v.id || '').toLowerCase();
      const reg = String(v.reg_number || v.reg_no || v.registrationNumber || '').toLowerCase();
      const model = String(v.model_name || v.model || v.type || '').toLowerCase();
      const loc = String(v.location || '').toLowerCase();
      return vId.includes(q) || reg.includes(q) || model.includes(q) || loc.includes(q);
    });

    const matchedDrivers = (drivers || []).filter((d) => {
      const dId = String(d.driverId || d.id || '').toLowerCase();
      const name = String(d.name || '').toLowerCase();
      const phone = String(d.phone || '').toLowerCase();
      const lic = String(d.license_number || d.licenseNumber || '').toLowerCase();
      const loc = String(d.self_reported_location || d.currentLocation || '').toLowerCase();
      return dId.includes(q) || name.includes(q) || phone.includes(q) || lic.includes(q) || loc.includes(q);
    });

    const matchedTrips = (trips || []).filter((t) => {
      const tId = String(t.tripId || t.id || '').toLowerCase();
      const origin = String(t.origin || t.source || '').toLowerCase();
      const dest = String(t.destination || '').toLowerCase();
      const driver = String(t.driver_name || t.driverName || t.driverId || '').toLowerCase();
      return tId.includes(q) || origin.includes(q) || dest.includes(q) || driver.includes(q);
    });

    return {
      vehicles: matchedVehicles.slice(0, 5),
      drivers: matchedDrivers.slice(0, 5),
      trips: matchedTrips.slice(0, 4),
      total: matchedVehicles.length + matchedDrivers.length + matchedTrips.length
    };
  }, [searchQuery, vehicles, drivers, trips]);

  // Compiled Live Operational Alerts
  const rawAlerts = useMemo(() => {
    const list = [];

    // 1. Maintenance Alerts
    (maintenance || []).forEach((m) => {
      const status = (m.status || '').toLowerCase();
      if (status !== 'completed') {
        list.push({
          id: `maint-${m.id || m.vehicleId}`,
          type: 'maintenance',
          icon: Wrench,
          severity: m.priority === 'High' ? 'high' : 'medium',
          title: `Maintenance: ${m.vehicleId || 'Vehicle'}`,
          desc: m.issue || m.description || 'Scheduled service due at depot',
          time: 'Active'
        });
      }
    });

    // 2. Low Fuel Alerts
    (vehicles || []).forEach((v) => {
      const fuel = typeof v.fuel_level === 'number' ? v.fuel_level : (typeof v.fuelLevel === 'number' ? v.fuelLevel : null);
      if (fuel !== null && fuel < 50) {
        list.push({
          id: `fuel-${v.id || v.vehicleId}`,
          type: 'fuel',
          icon: Fuel,
          severity: fuel < 30 ? 'high' : 'medium',
          title: `Low Fuel Level: ${v.reg_number || v.vehicleId}`,
          desc: `Current tank is at ${fuel}% capacity. Refuel recommended.`,
          time: 'Telemetry'
        });
      }
    });

    // 3. Safety Alerts
    (safetyAlerts || []).forEach((s) => {
      list.push({
        id: `safety-${s.id || Math.random()}`,
        type: 'safety',
        icon: AlertTriangle,
        severity: s.severity?.toLowerCase() === 'high' || s.severity?.toLowerCase() === 'critical' ? 'high' : 'medium',
        title: s.alertType || s.type || 'Safety Alert',
        desc: s.description || s.message || 'Corridor telemetry anomaly detected',
        time: 'Corridor'
      });
    });

    // If stats report fuel anomalies but list has none, add summary alert
    if (stats?.fuel_anomalies > 0 && !list.some(a => a.type === 'fuel')) {
      list.push({
        id: 'anomaly-summary',
        type: 'fuel',
        icon: Fuel,
        severity: 'high',
        title: 'Fuel Siphon Anomaly Flagged',
        desc: `${stats.fuel_anomalies} fuel anomalies recorded across active corridors.`,
        time: 'Active'
      });
    }

    return list;
  }, [maintenance, vehicles, safetyAlerts, stats]);

  const activeAlerts = rawAlerts.filter(a => !dismissedAlertIds.has(a.id));

  const handleSelectSearchResult = (type, item) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    if (type === 'vehicle') {
      if (setActiveTab) setActiveTab('fleet');
      if (setHighlightMapEntity) setHighlightMapEntity(item);
    } else if (type === 'driver') {
      if (setActiveTab) setActiveTab('drivers');
      if (setHighlightMapEntity) setHighlightMapEntity(item);
    } else if (type === 'trip') {
      if (setActiveTab) setActiveTab('dispatch');
    }
  };

  const handleDismissAlert = (id) => {
    setDismissedAlertIds(prev => new Set(prev).add(id));
  };

  const handleClearAllAlerts = () => {
    setDismissedAlertIds(new Set(rawAlerts.map(a => a.id)));
  };

  return (
    <header className="h-16 bg-[#1A1A1D] border-b border-[#2A2A2E] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Mobile Toggle & Global Search */}
      <div className="flex items-center space-x-3 flex-1 max-w-xl">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 rounded-xl text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#252528] focus:outline-none"
          aria-label="Open Mobile Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Bar with Autocomplete Dropdown */}
        <div ref={searchContainerRef} className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            placeholder="Search drivers, vehicles, routes..."
            aria-label="Search drivers, vehicles, routes"
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-xs text-[#F5F5F5] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-white transition-all font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              aria-label="Clear Search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F5F5F5]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Search Results Dropdown */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute left-0 top-full mt-2 w-full min-w-[300px] sm:min-w-[360px] bg-[#1A1A1D] border border-[#2A2A2E] rounded-2xl shadow-2xl p-2 z-50 animate-fadeIn max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2A2A2E] mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                  Search Results ({searchResults.total})
                </span>
                <span className="text-[10px] text-[#9CA3AF]">Esc to close</span>
              </div>

              {searchResults.total === 0 ? (
                <div className="p-4 text-center text-xs text-[#9CA3AF]">
                  <p className="font-semibold text-[#F5F5F5]">No matching fleet assets found</p>
                  <p className="text-[11px] mt-1">Try searching by Vehicle ID (VH104), Registration, or Driver Name.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Vehicles Category */}
                  {searchResults.vehicles.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#9CA3AF] px-3 py-1 flex items-center space-x-1.5">
                        <Truck className="w-3 h-3" />
                        <span>Vehicles</span>
                      </p>
                      <div className="space-y-1">
                        {searchResults.vehicles.map((v) => (
                          <button
                            key={v.id || v.vehicleId}
                            onClick={() => handleSelectSearchResult('vehicle', v)}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#252528] flex items-center justify-between transition-colors group"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-[#F5F5F5] truncate group-hover:text-white flex items-center space-x-1.5">
                                <span className="font-mono text-emerald-400">{v.vehicleId || v.id}</span>
                                <span>·</span>
                                <span>{v.reg_number || v.reg_no || v.registrationNumber}</span>
                              </p>
                              <p className="text-[11px] text-[#9CA3AF] truncate">{v.model_name || v.model || v.type} • {v.location || 'Depot'}</p>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-[#0D0D0F] border border-[#2A2A2E] text-[#9CA3AF] whitespace-nowrap">
                              {v.status || 'Active'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Drivers Category */}
                  {searchResults.drivers.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#9CA3AF] px-3 py-1 flex items-center space-x-1.5">
                        <User className="w-3 h-3" />
                        <span>Drivers</span>
                      </p>
                      <div className="space-y-1">
                        {searchResults.drivers.map((d) => (
                          <button
                            key={d.id || d.driverId}
                            onClick={() => handleSelectSearchResult('driver', d)}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#252528] flex items-center justify-between transition-colors group"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-[#F5F5F5] truncate group-hover:text-white flex items-center space-x-1.5">
                                <span>{d.name}</span>
                                <span className="font-mono text-xs text-[#9CA3AF]">({d.driverId || d.id})</span>
                              </p>
                              <p className="text-[11px] text-[#9CA3AF] truncate">{d.phone || 'No phone'} • {d.self_reported_location || 'Coimbatore'}</p>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-[#0D0D0F] border border-[#2A2A2E] text-[#9CA3AF] whitespace-nowrap">
                              {d.status || 'Active'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trips Category */}
                  {searchResults.trips.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#9CA3AF] px-3 py-1 flex items-center space-x-1.5">
                        <Route className="w-3 h-3" />
                        <span>Trips & Routes</span>
                      </p>
                      <div className="space-y-1">
                        {searchResults.trips.map((t) => (
                          <button
                            key={t.id || t.tripId}
                            onClick={() => handleSelectSearchResult('trip', t)}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#252528] flex items-center justify-between transition-colors group"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-[#F5F5F5] truncate group-hover:text-white">
                                {t.origin || t.source} → {t.destination}
                              </p>
                              <p className="text-[11px] text-[#9CA3AF] truncate">Trip ID: {t.tripId || t.id}</p>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-[#0D0D0F] border border-[#2A2A2E] text-[#9CA3AF] whitespace-nowrap">
                              {t.status || 'Ongoing'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Live Clock, Driver Switcher, Notifications, Profile, Sign Out */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Live Clock Badge */}
        <div 
          className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-xs font-mono text-[#F5F5F5]"
          title="Authoritative Live System Clock"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{timeString}</span>
        </div>

        {/* Quick Driver Switcher */}
        <div className="relative group">
          <button
            onClick={() => switchToDriverPreview(drivers[0]?.id || 'drv-1')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#252528] hover:bg-[#3F3F46] border border-[#2A2A2E] text-[#F5F5F5] text-xs font-bold transition-all shadow-sm focus:outline-none"
            title="Switch to Driver view"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span className="hidden sm:inline">Switch to Driver View</span>
          </button>
          
          <div className="absolute right-0 top-full mt-2 w-60 bg-[#1A1A1D] border border-[#2A2A2E] rounded-2xl shadow-2xl p-2 hidden group-hover:block z-50 animate-fadeIn">
            <p className="text-[10px] uppercase font-bold text-[#9CA3AF] px-3 py-1.5">Select Driver Account</p>
            {drivers.length > 0 ? (
              drivers.map((drv) => (
                <button
                  key={drv.id}
                  onClick={() => switchToDriverPreview(drv.id)}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#F5F5F5] hover:bg-[#252528] flex items-center justify-between transition-colors"
                >
                  <span className="font-semibold truncate">{drv.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    (drv.status || '').toLowerCase() === 'ready' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' :
                    (drv.status || '').toLowerCase() === 'on_trip' || drv.status === 'On Trip' ? 'bg-blue-950/60 text-blue-400 border border-blue-800/40' :
                    'bg-[#252528] text-[#9CA3AF]'
                  }`}>
                    {drv.status}
                  </span>
                </button>
              ))
            ) : (
              <button
                onClick={() => switchToDriverPreview('drv-1')}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#F5F5F5] hover:bg-[#252528] flex items-center justify-between transition-colors"
              >
                <span className="font-semibold truncate">Arun Kumar</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-[#252528] text-[#9CA3AF]">
                  Driver
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications Icon with Popover */}
        <div ref={notifContainerRef} className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl bg-[#252528] border border-[#2A2A2E] text-[#9CA3AF] hover:text-[#F5F5F5] hover:border-[#3F3F46] transition-colors relative focus:outline-none"
            aria-label="Fleet Notifications"
            title="Operational Notifications"
          >
            <Bell className="w-4 h-4" />
            {activeAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[9px] font-extrabold text-[#0D0D0F] flex items-center justify-center border-2 border-[#1A1A1D]">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#1A1A1D] border border-[#2A2A2E] rounded-2xl shadow-2xl p-3 z-50 animate-fadeIn">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#2A2A2E] mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-[#F5F5F5]">Operational Alerts</span>
                  {activeAlerts.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40 text-[10px] font-bold">
                      {activeAlerts.length} active
                    </span>
                  )}
                </div>
                {activeAlerts.length > 0 && (
                  <button
                    onClick={handleClearAllAlerts}
                    className="text-[11px] text-[#9CA3AF] hover:text-[#F5F5F5] font-semibold"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {activeAlerts.length === 0 ? (
                <div className="py-6 px-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-bold text-[#F5F5F5]">All Telemetry Nominal</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">No active maintenance issues, fuel anomalies, or corridor safety alerts.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {activeAlerts.map((alert) => {
                    const Icon = alert.icon;
                    return (
                      <div 
                        key={alert.id}
                        className="p-2.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] flex items-start space-x-2.5 hover:border-[#3F3F46] transition-colors"
                      >
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          alert.severity === 'high' 
                            ? 'bg-rose-950/40 text-rose-400 border border-rose-800/40' 
                            : 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
                        }`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-[#F5F5F5] truncate">{alert.title}</p>
                            <button
                              onClick={() => handleDismissAlert(alert.id)}
                              className="text-[#9CA3AF] hover:text-[#F5F5F5] ml-2"
                              aria-label="Dismiss alert"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-tight">{alert.desc}</p>
                          <span className="inline-block mt-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                            {alert.time}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Admin Profile Chip */}
        <div className="flex items-center space-x-2 pl-2 border-l border-[#2A2A2E]">
          <div className="w-8 h-8 rounded-xl bg-[#252528] border border-[#3F3F46] flex items-center justify-center text-[#F5F5F5] font-extrabold text-xs select-none">
            FM
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-[#F5F5F5] leading-tight">Fleet Manager</p>
            <p className="text-[10px] text-[#9CA3AF] font-semibold">{currentUser?.name || 'Operations'}</p>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={logout}
          className="px-2.5 py-1.5 rounded-xl bg-[#252528] border border-[#2A2A2E] text-[#9CA3AF] hover:text-rose-400 hover:border-rose-900/50 transition-colors flex items-center space-x-1.5 focus:outline-none"
          title="Sign Out of Fleet Management"
          aria-label="Sign Out"
          data-testid="sign-out-button"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-semibold">Sign Out</span>
        </button>
      </div>
    </header>
  );
};
