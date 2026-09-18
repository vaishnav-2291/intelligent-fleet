import React, { useState, useEffect, useCallback } from 'react';
import { useFleet } from '../../context/FleetContext';
import { SAMPLE_TOWNS, getEstimatedDuration } from '../../data/mockData';
import { optimizeRoute } from '../../services/snsApi';
import { RunningTruckLoop } from '../common/RunningTruckLoop';
import { InteractiveFleetMap } from '../common/InteractiveFleetMap';
import { 
  X, 
  MapPin, 
  Navigation, 
  Clock, 
  CheckCircle2, 
  Lock, 
  Truck, 
  ArrowRight 
} from 'lucide-react';

export const AssignRouteModal = ({ driver, isOpen, onClose }) => {
  const { assignRoute, vehicles, refreshFleetData } = useFleet();

  // Filter idle vehicles directly from centralized fleet context
  const idleVehicles = vehicles.filter(
    (v) => (v.status || '').toLowerCase() === 'idle'
  );
  
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  
  const hasSelfReported = Boolean(driver?.self_reported_location);
  const initialSource = hasSelfReported ? driver.self_reported_location : SAMPLE_TOWNS[0];
  const initialDest = SAMPLE_TOWNS.find((t) => t !== initialSource) || SAMPLE_TOWNS[1];

  const [source, setSource] = useState(initialSource);
  const [destination, setDestination] = useState(initialDest);
  const [duration, setDuration] = useState('1h 45m');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch estimate via SNSIHub route optimizer with corridor matrix fallback
  const fetchEstimate = useCallback(async (src, dest) => {
    if (!src || !dest || src === dest) {
      setDuration('30m (Local)');
      return;
    }

    try {
      const res = await optimizeRoute(src, dest);
      if (res?.data?.estimated_duration || res?.data?.estimatedDuration) {
        setDuration(res.data.estimated_duration || res.data.estimatedDuration);
        return;
      }
    } catch {
      // Graceful fallback to static corridor matrix lookup
    }
    setDuration(getEstimatedDuration(src, dest));
  }, []);

  useEffect(() => {
    if (isOpen && driver) {
      const src = driver.self_reported_location || SAMPLE_TOWNS[0];
      const dest = SAMPLE_TOWNS.find((t) => t !== src) || SAMPLE_TOWNS[1];
      queueMicrotask(() => {
        setSource(src);
        setDestination(dest);
        if (idleVehicles.length > 0) {
          setSelectedVehicleId(String(idleVehicles[0].id));
        }
        fetchEstimate(src, dest);
      });
    }
  }, [isOpen, driver, idleVehicles, fetchEstimate]);

  const handleSourceChange = (e) => {
    const newSrc = e.target.value;
    setSource(newSrc);
    fetchEstimate(newSrc, destination);
  };

  const handleDestinationChange = (e) => {
    const newDest = e.target.value;
    setDestination(newDest);
    fetchEstimate(source, newDest);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (source === destination) {
      alert('Source and Destination cannot be the same town.');
      return;
    }
    if (!selectedVehicleId) {
      alert('Please select an available vehicle.');
      return;
    }

    setIsSubmitting(true);
    const success = await assignRoute(driver.id, source, destination, selectedVehicleId);
    setIsSubmitting(false);

    if (success) {
      await refreshFleetData();
      onClose();
    }
  };

  if (!isOpen || !driver) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0D0F]/90 backdrop-blur-md animate-fadeIn select-none overflow-hidden">
      
      {/* 1. Dynamic Choreographed Drone & Truck Background Animation Loop */}
      <RunningTruckLoop />

      {/* 2. Opaque Truck Cargo Manifest Clipboard Card Container (#1A1A1D surface, #2A2A2E border) */}
      <div className="relative bg-[#1A1A1D] border border-[#2A2A2E] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden z-10 pl-1.5 max-h-[92vh] flex flex-col">
        
        {/* Container Side Rail Detail (Container Hinge Strip) */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#252528] border-r border-[#2A2A2E] rounded-l-3xl"></div>

        {/* Corner Castings Accents (4 Corner Brackets) */}
        <div className="absolute top-2 left-3 w-4 h-4 border-t-2 border-l-2 border-[#3F3F46] rounded-tl pointer-events-none z-20"></div>
        <div className="absolute top-2 right-3 w-4 h-4 border-t-2 border-r-2 border-[#3F3F46] rounded-tr pointer-events-none z-20"></div>
        <div className="absolute bottom-2 left-3 w-4 h-4 border-b-2 border-l-2 border-[#3F3F46] rounded-bl pointer-events-none z-20"></div>
        <div className="absolute bottom-2 right-3 w-4 h-4 border-b-2 border-r-2 border-[#3F3F46] rounded-br pointer-events-none z-20"></div>

        {/* Top Header - Number Plate / Dispatch Manifest Strip */}
        <div className="px-6 py-4 bg-[#0D0D0F] border-b border-[#2A2A2E] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#1A1A1D] text-[#F5F5F5] border border-[#2A2A2E]">
              <Navigation className="w-5 h-5 text-[#F5F5F5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono tracking-widest text-[#9CA3AF] uppercase bg-[#252528] px-2 py-0.5 rounded border border-[#2A2A2E]">
                  DISPATCH MANIFEST
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#F5F5F5] tracking-tight mt-0.5">Assign Route & Vehicle</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#252528] transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Driver Summary Bar */}
          <div className="p-4 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] flex items-center justify-between text-xs">
            <div>
              <p className="font-extrabold text-[#F5F5F5] text-sm tracking-tight">{driver.name}</p>
              <p className="text-[#9CA3AF] text-[11px] mt-0.5 flex items-center space-x-1.5">
                <span>Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[10px] font-bold uppercase inline-flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>{driver.status}</span>
                </span>
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider block">Location</span>
              <span className="font-semibold text-[#F5F5F5] flex items-center justify-end space-x-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>{driver.self_reported_location ? driver.self_reported_location : 'Not shared'}</span>
              </span>
            </div>
          </div>

          {/* VEHICLE SELECTION DROPDOWN */}
          <div>
            <label className="block text-xs font-semibold text-[#9CA3AF] mb-1.5 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Truck className="w-4 h-4 text-[#9CA3AF]" />
                <span className="uppercase tracking-wider text-[11px] font-bold">Select Available Vehicle</span>
              </span>
              <span className="text-[10px] text-[#9CA3AF] font-mono font-bold bg-[#252528] px-2 py-0.5 rounded border border-[#2A2A2E]">
                {idleVehicles.length} Idle Vehicles
              </span>
            </label>

            {idleVehicles.length === 0 ? (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs font-semibold">
                No idle vehicles available in fleet pool right now.
              </div>
            ) : (
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-[#F5F5F5] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-white transition-all cursor-pointer"
              >
                {idleVehicles.map((veh) => (
                  <option key={veh.id} value={veh.id}>
                    {veh.reg_number || veh.reg_no} — {veh.model_name || veh.model} ({veh.capacity})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* SOURCE FIELD */}
          <div>
            <label className="block text-xs font-semibold text-[#9CA3AF] mb-1.5 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-[#9CA3AF]" />
                <span className="uppercase tracking-wider text-[11px] font-bold">Source / Origin Town</span>
              </span>
              {hasSelfReported && (
                <span className="text-[10px] text-[#9CA3AF] font-semibold flex items-center space-x-1">
                  <Lock className="w-3 h-3 text-[#9CA3AF]" />
                  <span>Locked from Driver Self-Report</span>
                </span>
              )}
            </label>

            {hasSelfReported ? (
              <div className="w-full px-4 py-3 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-[#F5F5F5] font-bold text-sm flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-[#9CA3AF]" />
                  <span>{source}</span>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full border border-[#2A2A2E] text-[#9CA3AF] font-mono">
                  Driver Location
                </span>
              </div>
            ) : (
              <select
                value={source}
                onChange={handleSourceChange}
                className="w-full px-4 py-3 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-[#F5F5F5] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-white transition-all cursor-pointer"
              >
                {SAMPLE_TOWNS.map((town) => (
                  <option key={town} value={town}>
                    {town} Hub
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* DESTINATION FIELD */}
          <div>
            <label className="block text-xs font-semibold text-[#9CA3AF] mb-1.5 flex items-center space-x-1.5">
              <MapPin className="w-4 h-4 text-[#9CA3AF]" />
              <span className="uppercase tracking-wider text-[11px] font-bold">Destination Town</span>
            </label>
            <select
              value={destination}
              onChange={handleDestinationChange}
              className="w-full px-4 py-3 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] text-[#F5F5F5] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-white transition-all cursor-pointer"
            >
              {SAMPLE_TOWNS.filter((t) => t !== source).map((town) => (
                <option key={town} value={town}>
                  {town} Delivery Station
                </option>
              ))}
            </select>
          </div>

          {/* Corridor Estimate Box */}
          <div className="p-4 rounded-2xl bg-[#0D0D0F] border border-[#2A2A2E] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-[#9CA3AF]" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF]">Corridor Estimate</span>
                <p className="text-sm font-extrabold text-[#F5F5F5] flex items-center space-x-2">
                  <span>{source}</span>
                  <ArrowRight className="w-4 h-4 text-[#9CA3AF]" />
                  <span>{destination}</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs px-3 py-1.5 rounded-xl bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E] font-mono font-bold">
                {duration}
              </span>
            </div>
          </div>

          {/* Interactive Corridor Route Preview */}
          <div className="rounded-2xl border border-[#2A2A2E] overflow-hidden bg-[#0D0D0F]">
            <div className="px-3 py-1.5 bg-[#16161A] border-b border-[#2A2A2E] flex items-center justify-between text-[10px]">
              <span className="font-bold text-[#F5F5F5] uppercase tracking-wider">Route Preview Map</span>
              <span className="text-[#9CA3AF] font-mono">Live Hub Coordinates</span>
            </div>
            <div className="h-80 sm:h-96 w-full">
              <InteractiveFleetMap
                origin={source}
                destination={destination}
                duration={duration}
                height="100%"
                showHud={true}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#2A2A2E] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-[#252528] hover:bg-[#3F3F46] text-[#F5F5F5] text-xs font-bold border border-[#2A2A2E] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || idleVehicles.length === 0}
              className="px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-[#0D0D0F] text-xs font-extrabold shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-[#0D0D0F] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Assignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
