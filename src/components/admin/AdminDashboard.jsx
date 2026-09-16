import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { StatCards } from './StatCards';
import { AvailableDriversPanel } from './AvailableDriversPanel';
import { OngoingTripsTable } from './OngoingTripsTable';
import { Phase2Placeholders } from './Phase2Placeholders';
import { DispatchRoutingView } from './DispatchRoutingView';
import { FleetAIChatView } from './FleetAIChatView';
import { useFleet } from '../../context/FleetContext';
import { 
  Users, 
  Truck, 
  UserPlus, 
  PlusCircle, 
  HelpCircle,
  CheckCircle2,
  Lock,
  Phone,
  CreditCard,
  MapPin,
  Compass,
  ArrowRight,
  RotateCw,
  AlertTriangle,
  Info,
  ShieldCheck,
  Cpu,
  Route,
  Activity,
  Zap,
  BookOpen,
  Hash,
  Layers
} from 'lucide-react';

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { 
    drivers, 
    vehicles, 
    createDriverAccount,
    createVehicleAccount,
    loading,
    refreshFleetData 
  } = useFleet();

  // ==========================================================
  // Add Driver Form State (Admin / Fleet Manager)
  // ==========================================================
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverLicense, setNewDriverLicense] = useState('');
  const [newDriverId, setNewDriverId] = useState('');
  const [newDriverVehicle, setNewDriverVehicle] = useState('');
  const [newDriverStatus, setNewDriverStatus] = useState('active');
  const [newDriverLocation, setNewDriverLocation] = useState('Coimbatore Regional Depot');
  const [isSubmittingDriver, setIsSubmittingDriver] = useState(false);
  const [addDriverStatus, setAddDriverStatus] = useState(null);

  const handleAddDriverSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingDriver(true);
    setAddDriverStatus(null);

    const generatedId = newDriverId.trim() || `DR${Math.floor(111 + Math.random() * 888)}`;
    const generatedLicense = newDriverLicense.trim() || `TN2026${Math.floor(1000 + Math.random() * 9000)}`;

    const res = await createDriverAccount({
      name: newDriverName.trim(),
      phone: newDriverPhone.trim() || '+91 98765 00000',
      licenseNumber: generatedLicense,
      driverId: generatedId,
      status: newDriverStatus,
      assignedVehicleId: newDriverVehicle || null,
      currentLocation: newDriverLocation
    });

    setIsSubmittingDriver(false);
    if (res.success) {
      setAddDriverStatus({ 
        type: 'success', 
        text: `Driver "${newDriverName}" successfully onboarded with ID ${generatedId}.`,
        driverId: generatedId
      });
      setNewDriverName('');
      setNewDriverPhone('');
      setNewDriverLicense('');
      setNewDriverId('');
      setNewDriverVehicle('');
    } else {
      setAddDriverStatus({ 
        type: 'error', 
        text: res.error || 'Failed to onboard driver. Please check your inputs.' 
      });
    }
  };

  // ==========================================================
  // Add Vehicle Form State (Admin / Fleet Manager)
  // ==========================================================
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newVehicleReg, setNewVehicleReg] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('Mini Truck');
  const [newVehicleStatus, setNewVehicleStatus] = useState('active');
  const [newVehicleFuel, setNewVehicleFuel] = useState(85);
  const [newVehicleLocation, setNewVehicleLocation] = useState('Coimbatore Regional Depot');
  const [newVehicleMileage, setNewVehicleMileage] = useState(0);
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);
  const [addVehicleStatus, setAddVehicleStatus] = useState(null);

  const handleAddVehicleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingVehicle(true);
    setAddVehicleStatus(null);

    const vId = newVehicleId.trim().toUpperCase() || `VH${Math.floor(111 + Math.random() * 888)}`;
    const reg = newVehicleReg.trim().toUpperCase() || `TN38AB${Math.floor(1000 + Math.random() * 9000)}`;

    const res = await createVehicleAccount({
      vehicleId: vId,
      registrationNumber: reg,
      type: newVehicleType,
      status: newVehicleStatus,
      location: newVehicleLocation,
      mileage: Number(newVehicleMileage) || 0,
      fuelLevel: Number(newVehicleFuel) || 80
    });

    setIsSubmittingVehicle(false);
    if (res.success) {
      setAddVehicleStatus({ 
        type: 'success', 
        text: `Vehicle "${vId}" (${reg}) successfully onboarded into telemetry fleet.`,
        vehicleId: vId
      });
      setNewVehicleId('');
      setNewVehicleReg('');
      setNewVehicleMileage(0);
      setNewVehicleFuel(85);
    } else {
      setAddVehicleStatus({ 
        type: 'error', 
        text: res.error || 'Failed to onboard vehicle. Please verify registration and ID uniqueness.' 
      });
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-[#F5F5F5] flex overflow-hidden select-none">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-transparent text-[#F5F5F5]">
        {/* Top Header with Functional Global Search & Alerts */}
        <TopHeader 
          setMobileOpen={setMobileOpen} 
          setActiveTab={setActiveTab} 
        />

        {/* Dashboard Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto animate-fadeIn">
          
          {/* ========================================================
              TAB 1: DASHBOARD OVERVIEW
              ======================================================== */}
          {activeTab === 'overview' && (
            <>
              {/* Page Title */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5] tracking-tight">
                    Dashboard Overview
                  </h1>
                  <p className="text-xs text-[#9CA3AF] mt-1">Real-time corridor telemetry and dispatch management</p>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1.5 rounded-xl bg-[#1A1A1D] border border-[#2A2A2E] text-xs font-semibold text-[#F5F5F5] flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Tamil Nadu Logistics Corridor</span>
                  </span>
                  <button
                    onClick={() => refreshFleetData()}
                    className="p-2 rounded-xl bg-[#1A1A1D] border border-[#2A2A2E] text-[#9CA3AF] hover:text-[#F5F5F5] hover:border-[#3F3F46] transition-colors"
                    title="Refresh Live Data"
                    aria-label="Refresh Live Data"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* A) Top Stat Cards Row */}
              <StatCards />

              {/* B) Available Drivers Panel */}
              <AvailableDriversPanel />

              {/* C) Ongoing & Recent Trips Table */}
              <OngoingTripsTable />

              {/* D) Telemetry Anomalies & Upcoming Maintenance */}
              <Phase2Placeholders />
            </>
          )}

          {/* ========================================================
              TAB 2: DISPATCH & ROUTING
              ======================================================== */}
          {activeTab === 'dispatch' && (
            <DispatchRoutingView />
          )}

          {/* ========================================================
              TAB 3: DRIVER ROSTER
              ======================================================== */}
          {activeTab === 'drivers' && (
            <div className="bg-[#1A1A1D] rounded-2xl p-6 sm:p-8 border border-[#2A2A2E] shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2E] pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E]">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#F5F5F5]">Registered Drivers ({drivers.length})</h2>
                    <p className="text-xs text-[#9CA3AF]">Active driver records, duty cycles, and vehicle assignments.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('add-driver')}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-[#0D0D0F] text-xs font-bold transition-all inline-flex items-center space-x-2 shadow-sm hover:scale-[1.01] active:scale-[0.99] self-start sm:self-auto"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Onboard Driver</span>
                </button>
              </div>

              {drivers.length === 0 ? (
                <div className="text-center py-12 bg-[#0D0D0F] rounded-xl border border-dashed border-[#2A2A2E]">
                  <Users className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-[#F5F5F5]">No Drivers Found in Fleet</p>
                  <p className="text-xs text-[#9CA3AF] mt-1 max-w-sm mx-auto">
                    No driver records are registered in the live database. Click below to onboard the first driver account.
                  </p>
                  <button
                    onClick={() => setActiveTab('add-driver')}
                    className="mt-4 px-4 py-2 rounded-xl bg-white text-[#0D0D0F] text-xs font-bold"
                  >
                    Onboard Driver
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {drivers.map((drv) => {
                    const rawStatus = (drv.status || '').toLowerCase();
                    const isLeave = rawStatus === 'on_leave' || rawStatus === 'on leave';
                    const isInactive = rawStatus === 'inactive' || rawStatus === 'offline';
                    const normalizedStatus = isLeave ? 'ON LEAVE' : isInactive ? 'INACTIVE' : 'ACTIVE';

                    return (
                      <div 
                        key={drv.id || drv.driverId} 
                        className="p-4 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] flex flex-col justify-between space-y-3 hover:border-[#3F3F46] transition-all group"
                      >
                        {/* Header: Driver Name & Normalized Badge */}
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 pr-2">
                            <h4 className="font-bold text-[#F5F5F5] text-sm truncate group-hover:text-white">
                              {drv.name}
                            </h4>
                            <p className="text-xs text-[#9CA3AF] flex items-center space-x-1.5 mt-0.5">
                              <Phone className="w-3 h-3 text-[#9CA3AF]" />
                              <span>{drv.phone || 'No phone'}</span>
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border ${
                            normalizedStatus === 'ACTIVE' 
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' 
                              : normalizedStatus === 'ON LEAVE' 
                                ? 'bg-amber-950/60 text-amber-300 border-amber-800/40' 
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          }`}>
                            {normalizedStatus}
                          </span>
                        </div>

                        {/* Metadata Details */}
                        <div className="text-[11px] text-[#9CA3AF] space-y-1.5 pt-2 border-t border-[#2A2A2E]">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center space-x-1">
                              <Truck className="w-3 h-3 text-[#9CA3AF]" />
                              <span>Assigned Vehicle:</span>
                            </span>
                            <span className="font-mono text-[#F5F5F5] font-semibold">
                              {drv.assigned_vehicle_id || drv.assignedVehicleId || 'Unassigned'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                              <span>Current Location:</span>
                            </span>
                            <span className="text-[#F5F5F5] font-medium truncate max-w-[140px]">
                              {drv.self_reported_location || drv.currentLocation || 'Coimbatore Hub'}
                            </span>
                          </div>

                          {drv.license_number && (
                            <div className="flex items-center justify-between">
                              <span className="flex items-center space-x-1">
                                <CreditCard className="w-3 h-3 text-[#9CA3AF]" />
                                <span>License No:</span>
                              </span>
                              <span className="font-mono text-[#9CA3AF] font-medium">
                                {drv.license_number}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Footer: Driver ID & Trips Completed */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#2A2A2E] text-[10px]">
                          <span className="text-[#9CA3AF] font-mono font-semibold">
                            ID #{drv.driverId || drv.id}
                          </span>
                          <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{drv.trips_completed ?? drv.tripsCompleted ?? 0} Trips Completed</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 4: FLEET ROSTER
              ======================================================== */}
          {activeTab === 'fleet' && (
            <div className="bg-[#1A1A1D] rounded-2xl p-6 sm:p-8 border border-[#2A2A2E] shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2E] pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E]">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#F5F5F5]">Fleet Roster ({vehicles.length})</h2>
                    <p className="text-xs text-[#9CA3AF]">Live inventory of logistics vehicles in operational fleet pool.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('add-vehicle')}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-[#0D0D0F] text-xs font-bold transition-all inline-flex items-center space-x-2 shadow-sm hover:scale-[1.01] active:scale-[0.99] self-start sm:self-auto"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Vehicle</span>
                </button>
              </div>

              {vehicles.length === 0 ? (
                <div className="text-center py-12 bg-[#0D0D0F] rounded-xl border border-dashed border-[#2A2A2E]">
                  <Truck className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-[#F5F5F5]">No Vehicles in Fleet Inventory</p>
                  <p className="text-xs text-[#9CA3AF] mt-1 max-w-sm mx-auto">
                    No vehicle records exist in the database. Click below to onboard a vehicle into the pool.
                  </p>
                  <button
                    onClick={() => setActiveTab('add-vehicle')}
                    className="mt-4 px-4 py-2 rounded-xl bg-white text-[#0D0D0F] text-xs font-bold"
                  >
                    Add Vehicle
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vehicles.map((v) => {
                    const rawStatus = (v.status || '').toLowerCase();
                    const isTravelling = rawStatus === 'travelling' || rawStatus === 'active';
                    const isMaint = rawStatus === 'maintenance';
                    const normalizedStatus = isMaint ? 'MAINTENANCE' : isTravelling ? 'TRAVELLING' : 'IDLE';

                    const fuelPct = typeof v.fuel_level === 'number' 
                      ? v.fuel_level 
                      : (typeof v.fuelLevel === 'number' ? v.fuelLevel : 80);

                    const fuelBarColor = fuelPct < 30 ? 'bg-rose-500' : fuelPct < 55 ? 'bg-amber-500' : 'bg-emerald-500';

                    return (
                      <div 
                        key={v.id || v.vehicleId} 
                        className="p-4 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] flex flex-col justify-between space-y-3 hover:border-[#3F3F46] transition-all group"
                      >
                        {/* Header: Reg Number, Vehicle ID, Status Badge */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-[#F5F5F5] text-sm group-hover:text-white">
                                {v.reg_number || v.reg_no || v.registrationNumber}
                              </span>
                              <span className="font-mono text-[11px] text-[#9CA3AF] font-semibold">
                                ({v.vehicleId || v.id})
                              </span>
                            </div>
                            <p className="text-xs text-[#9CA3AF] font-medium mt-0.5">
                              {v.model_name || v.model || v.type} {v.capacity ? `(${v.capacity})` : ''}
                            </p>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border ${
                            normalizedStatus === 'TRAVELLING' 
                              ? 'bg-blue-950/60 text-blue-300 border-blue-800/40' 
                              : normalizedStatus === 'IDLE' 
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' 
                                : 'bg-amber-950/60 text-amber-300 border-amber-800/40'
                          }`}>
                            {normalizedStatus}
                          </span>
                        </div>

                        {/* Location & Mileage */}
                        <div className="text-[11px] text-[#9CA3AF] space-y-1 pt-2 border-t border-[#2A2A2E]">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                              <span>Hub Depot:</span>
                            </span>
                            <span className="text-[#F5F5F5] font-medium truncate max-w-[150px]">
                              {v.location || 'Coimbatore Depot'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Odometer / Mileage:</span>
                            <span className="font-mono text-[#F5F5F5]">
                              {Number(v.mileage || 0).toLocaleString()} km
                            </span>
                          </div>
                        </div>

                        {/* Fuel Telemetry Bar */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-[#9CA3AF] flex items-center space-x-1">
                              <Zap className="w-3 h-3 text-emerald-400" />
                              <span>Fuel Level:</span>
                            </span>
                            <span className="font-mono font-bold text-[#F5F5F5]">
                              {fuelPct}%
                            </span>
                          </div>
                          <div className="w-full bg-[#252528] rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`${fuelBarColor} h-full transition-all duration-500 rounded-full`}
                              style={{ width: `${Math.min(Math.max(fuelPct, 0), 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 5: ADD DRIVER (ENTERPRISE ONBOARDING FORM)
              ======================================================== */}
          {activeTab === 'add-driver' && (
            <div className="bg-[#1A1A1D] rounded-2xl p-6 sm:p-8 border border-[#2A2A2E] shadow-sm max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E]">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xl font-bold text-[#F5F5F5]">Onboard New Driver Account</h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E] text-[10px] font-bold flex items-center space-x-1">
                        <Lock className="w-3 h-3 text-[#9CA3AF]" />
                        <span>Admin Only</span>
                      </span>
                    </div>
                    <p className="text-xs text-[#9CA3AF]">Register a driver profile in the authoritative fleet database.</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('drivers')}
                  className="text-xs text-[#9CA3AF] hover:text-[#F5F5F5] font-semibold flex items-center space-x-1"
                >
                  <span>View Roster</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {addDriverStatus && (
                <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
                  addDriverStatus.type === 'success' 
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' 
                    : 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
                }`}>
                  <div className="flex items-center space-x-2">
                    {addDriverStatus.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{addDriverStatus.text}</span>
                  </div>

                  {addDriverStatus.type === 'success' && (
                    <button
                      onClick={() => setActiveTab('drivers')}
                      className="px-3 py-1 bg-emerald-800/60 hover:bg-emerald-700/80 rounded-lg text-white text-[11px] font-bold transition-all ml-2"
                    >
                      View in Roster →
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={handleAddDriverSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Driver Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newDriverName}
                      onChange={(e) => setNewDriverName(e.target.value)}
                      required
                      placeholder="e.g. Ramesh V"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Phone Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newDriverPhone}
                      onChange={(e) => setNewDriverPhone(e.target.value)}
                      required
                      placeholder="e.g. 9876543210"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Driver License Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newDriverLicense}
                      onChange={(e) => setNewDriverLicense(e.target.value)}
                      required
                      placeholder="e.g. TN20261011"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Driver ID (optional)
                    </label>
                    <input
                      type="text"
                      value={newDriverId}
                      onChange={(e) => setNewDriverId(e.target.value)}
                      placeholder="e.g. DR111 (auto-generated if empty)"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Initial Duty Status
                    </label>
                    <select
                      value={newDriverStatus}
                      onChange={(e) => setNewDriverStatus(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    >
                      <option value="active">Active (On Duty)</option>
                      <option value="on_leave">On Leave</option>
                      <option value="inactive">Inactive / Standby</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Assign Vehicle (optional)
                    </label>
                    <select
                      value={newDriverVehicle}
                      onChange={(e) => setNewDriverVehicle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    >
                      <option value="">None (Unassigned Pool)</option>
                      {vehicles.map((v) => (
                        <option key={v.id || v.vehicleId} value={v.vehicleId || v.id}>
                          {v.vehicleId || v.id} - {v.reg_number || v.reg_no || v.registrationNumber} ({v.model_name || v.model || v.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                    Base Corridor Depot Location
                  </label>
                  <select
                    value={newDriverLocation}
                    onChange={(e) => setNewDriverLocation(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs focus:outline-none focus:ring-2 focus:ring-white transition-all"
                  >
                    <option value="Coimbatore Regional Depot">Coimbatore Regional Depot</option>
                    <option value="Erode Logistics Hub">Erode Logistics Hub</option>
                    <option value="Salem North Distribution Center">Salem North Distribution Center</option>
                    <option value="Tiruppur Industrial Waystation">Tiruppur Industrial Waystation</option>
                    <option value="Madurai Southern Hub">Madurai Southern Hub</option>
                    <option value="Chennai Central Port Terminal">Chennai Central Port Terminal</option>
                    <option value="Tiruchirappalli Central Waystation">Tiruchirappalli Central Waystation</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingDriver}
                  className="mt-4 w-full py-3.5 rounded-xl bg-white hover:bg-neutral-200 text-[#0D0D0F] font-extrabold text-xs shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isSubmittingDriver ? (
                    <div className="w-4 h-4 border-2 border-[#0D0D0F] border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>ONBOARD DRIVER TO DATABASE</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ========================================================
              TAB 6: ADD VEHICLE (ENTERPRISE ONBOARDING FORM)
              ======================================================== */}
          {activeTab === 'add-vehicle' && (
            <div className="bg-[#1A1A1D] rounded-2xl p-6 sm:p-8 border border-[#2A2A2E] shadow-sm max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E]">
                    <PlusCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xl font-bold text-[#F5F5F5]">Onboard New Vehicle Asset</h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E] text-[10px] font-bold flex items-center space-x-1">
                        <Lock className="w-3 h-3 text-[#9CA3AF]" />
                        <span>Admin Only</span>
                      </span>
                    </div>
                    <p className="text-xs text-[#9CA3AF]">Register a vehicle asset into the live telemetry pool.</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('fleet')}
                  className="text-xs text-[#9CA3AF] hover:text-[#F5F5F5] font-semibold flex items-center space-x-1"
                >
                  <span>View Roster</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {addVehicleStatus && (
                <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
                  addVehicleStatus.type === 'success' 
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' 
                    : 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
                }`}>
                  <div className="flex items-center space-x-2">
                    {addVehicleStatus.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{addVehicleStatus.text}</span>
                  </div>

                  {addVehicleStatus.type === 'success' && (
                    <button
                      onClick={() => setActiveTab('fleet')}
                      className="px-3 py-1 bg-emerald-800/60 hover:bg-emerald-700/80 rounded-lg text-white text-[11px] font-bold transition-all ml-2"
                    >
                      View in Roster →
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={handleAddVehicleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Vehicle ID <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newVehicleId}
                      onChange={(e) => setNewVehicleId(e.target.value)}
                      required
                      placeholder="e.g. VH111"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Registration Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newVehicleReg}
                      onChange={(e) => setNewVehicleReg(e.target.value)}
                      required
                      placeholder="e.g. TN38AB1111"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Vehicle Category / Model
                    </label>
                    <select
                      value={newVehicleType}
                      onChange={(e) => setNewVehicleType(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    >
                      <option value="Mini Truck">Mini Truck (0.8 Ton)</option>
                      <option value="Van">Cargo Van (1.0 Ton)</option>
                      <option value="Heavy Cargo">Heavy Cargo (2.5 Tons)</option>
                      <option value="Container 20ft">Container 20ft (5.0 Tons)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Initial Operational Status
                    </label>
                    <select
                      value={newVehicleStatus}
                      onChange={(e) => setNewVehicleStatus(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    >
                      <option value="active">Active (Available)</option>
                      <option value="idle">Idle (Depot Staged)</option>
                      <option value="maintenance">Under Maintenance</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Base Hub Location
                    </label>
                    <select
                      value={newVehicleLocation}
                      onChange={(e) => setNewVehicleLocation(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    >
                      <option value="Coimbatore Regional Depot">Coimbatore Regional Depot</option>
                      <option value="Erode Logistics Hub">Erode Logistics Hub</option>
                      <option value="Salem North Distribution Center">Salem North Distribution Center</option>
                      <option value="Tiruppur Industrial Waystation">Tiruppur Industrial Waystation</option>
                      <option value="Madurai Southern Hub">Madurai Southern Hub</option>
                      <option value="Chennai Central Port Terminal">Chennai Central Port Terminal</option>
                      <option value="Tiruchirappalli Central Waystation">Tiruchirappalli Central Waystation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                      Initial Mileage (km)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newVehicleMileage}
                      onChange={(e) => setNewVehicleMileage(e.target.value)}
                      placeholder="e.g. 12500"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    />
                  </div>
                </div>

                {/* Fuel Level Slider */}
                <div className="p-4 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#9CA3AF] flex items-center space-x-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Initial Fuel Tank Level:</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {newVehicleFuel}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={newVehicleFuel}
                    onChange={(e) => setNewVehicleFuel(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-[#252528] rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-[#9CA3AF]">
                    <span>Reserve (10%)</span>
                    <span>Half (50%)</span>
                    <span>Full (100%)</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingVehicle}
                  className="mt-4 w-full py-3.5 rounded-xl bg-white hover:bg-neutral-200 text-[#0D0D0F] font-extrabold text-xs shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isSubmittingVehicle ? (
                    <div className="w-4 h-4 border-2 border-[#0D0D0F] border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>ONBOARD VEHICLE TO DATABASE</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ========================================================
              TAB 7: HELP & DOCUMENTATION (11 ENTERPRISE SECTIONS)
              ======================================================== */}
          {activeTab === 'help' && (
            <div className="bg-[#1A1A1D] rounded-2xl p-6 sm:p-8 border border-[#2A2A2E] shadow-sm space-y-8 max-w-5xl mx-auto">
              {/* Header */}
              <div className="flex items-center space-x-3 border-b border-[#2A2A2E] pb-4">
                <div className="p-3 rounded-xl bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E]">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#F5F5F5]">Intelligent Fleet User Manual & Documentation</h2>
                  <p className="text-xs text-[#9CA3AF]">Comprehensive operations guide across corridor routing, dispatching, and AI workflows.</p>
                </div>
              </div>

              {/* 11 Structured Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-[#9CA3AF]">
                
                {/* 1. System Overview */}
                <div className="p-5 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2">
                  <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-sm">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>1. System Architecture & Single Source of Truth</span>
                  </div>
                  <p>
                    All operational data is persisted in <strong>MongoDB Atlas</strong> and served live through the <strong>FleetBackend</strong> and <strong>Express Gateway</strong>.
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#9CA3AF]">
                    <li>MongoDB Atlas $\rightarrow$ Express Gateway $\rightarrow$ Intelligent Fleet Operations Console.</li>
                    <li>Direct synchronization ensures zero ungrounded counts or secondary state drift.</li>
                    <li>Live database changes reflect simultaneously across Dashboard KPIs and AI Assistant.</li>
                  </ul>
                </div>

                {/* 2. Fleet Dashboard */}
                <div className="p-5 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2">
                  <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-sm">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>2. Fleet Dashboard & Real-Time KPIs</span>
                  </div>
                  <p>
                    The Overview screen consolidates real-time corridor operations into four authoritative metrics:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#9CA3AF]">
                    <li><strong>Travelling:</strong> Vehicles actively traversing assigned corridor routes.</li>
                    <li><strong>Idle / Available:</strong> Vehicles stationed at depot hubs ready for dispatch.</li>
                    <li><strong>In Maintenance:</strong> Vehicles scheduled for repair or oil servicing.</li>
                    <li><strong>Active Drivers Today:</strong> Verified drivers currently logged into on-duty status.</li>
                  </ul>
                </div>

                {/* 3. Driver Management */}
                <div className="p-5 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2">
                  <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-sm">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>3. Driver Management & Duty Cycles</span>
                  </div>
                  <p>
                    Drivers operate within an isolated workflow portal with strict role-based access:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#9CA3AF]">
                    <li><strong>Start Duty:</strong> Driver clocks in, self-reporting initial hub location.</li>
                    <li><strong>Active Trip:</strong> Upon dispatch, turns to "On Trip" with road routing.</li>
                    <li><strong>Complete Trip:</strong> Marks arrival and increments completed trip counter.</li>
                    <li><strong>Offline:</strong> Sets driver to off-duty standby state.</li>
                  </ul>
                </div>

                {/* 4. Vehicle Management */}
                <div className="p-5 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2">
                  <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-sm">
                    <Truck className="w-4 h-4 text-amber-400" />
                    <span>4. Vehicle Inventory & Fuel Telemetry</span>
                  </div>
                  <p>
                    Fleet inventory captures license plates, load capacities, and fuel levels:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#9CA3AF]">
                    <li><strong>Registration:</strong> Unique RTO registration numbers (e.g. TN38AB1104).</li>
                    <li><strong>Fuel Bar:</strong> Proportional visual telemetry bar reflecting backend tank levels.</li>
                    <li><strong>Depot Hub:</strong> Primary municipal transit staging ground in Tamil Nadu.</li>
                  </ul>
                </div>

                {/* 5. Dispatch & Routing */}
                <div className="p-5 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2">
                  <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-sm">
                    <Route className="w-4 h-4 text-purple-400" />
                    <span>5. Dispatch & Route Assignment</span>
                  </div>
                  <p>
                    Corridor dispatching links an available driver, a staged vehicle, and a sequence of destination waypoints:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#9CA3AF]">
                    <li>Select origin hub, intermediate deliveries, and final depot terminal.</li>
                    <li>Preview distance and duration prior to live dispatch commitment.</li>
                    <li>Dispatch immediately shifts vehicle status to <em>Travelling</em>.</li>
                  </ul>
                </div>

                {/* 6. Route Optimization */}
                <div className="p-5 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2">
                  <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-sm">
                    <Compass className="w-4 h-4 text-emerald-400" />
                    <span>6. Route Optimization & OSRM Road Geometry</span>
                  </div>
                  <p>
                    Stop sequencing and routing are computed using real highway geometry:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#9CA3AF]">
                    <li><strong>Nearest-Neighbor TSP:</strong> Arranges intermediate deliveries to minimize mileage.</li>
                    <li><strong>OSRM Engine:</strong> Calculates road coordinates following actual Tamil Nadu highways (NH 544, NH 48).</li>
                    <li>No straight-line coordinate fallbacks or imaginary geometry.</li>
                  </ul>
                </div>

                {/* 7. AI Fleet Assistant */}
                <div className="p-5 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2">
                  <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-sm">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>7. AI Fleet Assistant (SNS Agent Workbench)</span>
                  </div>
                  <p>
                    Autonomous enterprise intelligence assistant for fleet logistics operations:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#9CA3AF]">
                    <li>Ask queries like <em>"What is the status of VH104?"</em> or <em>"Show fleet fuel summary"</em>.</li>
                    <li>Retrieves authoritative answers directly from live database telemetry.</li>
                    <li>Synchronized with live fleet metrics and corridor status.</li>
                  </ul>
                </div>

                {/* 8. Fleet Status Meanings */}
                <div className="p-5 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2">
                  <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-sm">
                    <Info className="w-4 h-4 text-blue-400" />
                    <span>8. Fleet Status Terminology</span>
                  </div>
                  <p>
                    Terminology is normalized across all cards and filters:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#9CA3AF]">
                    <li><strong className="text-emerald-400">ACTIVE / READY:</strong> Operational asset ready for dispatch.</li>
                    <li><strong className="text-blue-400">TRAVELLING / ON TRIP:</strong> En route on logistics corridor.</li>
                    <li><strong className="text-amber-400">ON LEAVE / MAINTENANCE:</strong> Scheduled servicing or leave.</li>
                    <li><strong className="text-zinc-400">INACTIVE / OFFLINE:</strong> Staged in standby or off-shift.</li>
                  </ul>
                </div>

                {/* 9. Hub Telemetry Architecture */}
                <div className="p-5 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2">
                  <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-sm">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span>9. Hub Telemetry & Location Architecture</span>
                  </div>
                  <p>
                    Enterprise-grade location management supporting both stationary hub coordinates and live hardware streams:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#9CA3AF]">
                    <li>Uses integrated Tamil Nadu logistics hub coordinates (Coimbatore, Erode, Salem, Chennai, Madurai, Trichy).</li>
                    <li>Operates reliably with or without mobile GPS hardware enabled.</li>
                    <li>Real road geometry is always calculated via OSRM routing engine.</li>
                  </ul>
                </div>

                {/* 10. Troubleshooting */}
                <div className="p-5 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2">
                  <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>10. Troubleshooting & Operational FAQs</span>
                  </div>
                  <p>
                    Solutions to common operational scenarios:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#9CA3AF]">
                    <li><strong>Driver cannot see trip:</strong> Verify the driver account is selected in the Driver Portal.</li>
                    <li><strong>Duplicate Vehicle Error:</strong> Registration numbers must be globally unique in MongoDB.</li>
                    <li><strong>Map Tiles Slow:</strong> Check internet connectivity for OpenStreetMap tile fetching.</li>
                  </ul>
                </div>

                {/* 11. Authentication & Security */}
                <div className="p-5 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] space-y-2 md:col-span-2">
                  <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>11. Authentication, Roles & RBAC Protection</span>
                  </div>
                  <p>
                    Strict role segregation prevents unauthorized mutations and protects sensitive fleet data:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px]">
                    <div className="p-3 rounded-xl bg-[#1A1A1D] border border-[#2A2A2E]">
                      <p className="font-bold text-[#F5F5F5]">Fleet Manager / Admin</p>
                      <p className="text-[#9CA3AF] mt-1">Full access to dispatching, vehicle onboarding, driver creation, audit logs, and AI Chat.</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#1A1A1D] border border-[#2A2A2E]">
                      <p className="font-bold text-[#F5F5F5]">Dispatcher</p>
                      <p className="text-[#9CA3AF] mt-1">Can create corridor trips, optimize stop sequences, and monitor telemetry status.</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#1A1A1D] border border-[#2A2A2E]">
                      <p className="font-bold text-[#F5F5F5]">Driver Portal</p>
                      <p className="text-[#9CA3AF] mt-1">Restricted to assigned route navigation, duty clock-in, and arrival completion.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>
      </div>

      {/* Floating FleetAI Assistant Widget */}
      <FleetAIChatView onNavigateTab={setActiveTab} />
    </div>
  );
};
