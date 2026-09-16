import React, { useState, useEffect } from 'react';
import { useFleet } from '../../context/FleetContext';
import {
  MapPin,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Truck,
  User,
  Clock,
  ShieldCheck,
  RotateCw,
  Send,
  Info
} from 'lucide-react';

const PRESET_CORRIDORS = [
  { name: 'Coimbatore Hub', lat: 11.0168, lng: 76.9558 },
  { name: 'Tiruppur Depot', lat: 11.1085, lng: 77.3411 },
  { name: 'Salem Station', lat: 11.6643, lng: 78.1460 },
  { name: 'Madurai Terminal', lat: 9.9252, lng: 78.1198 },
  { name: 'Chennai Port', lat: 13.0827, lng: 80.2707 }
];

export const LocationUpdatePanel = () => {
  const {
    vehicles,
    drivers,
    currentUser,
    updateVehicleCoordinates,
    updateDriverCoordinates,
    applyDemoLocation,
    setHighlightMapEntity
  } = useFleet();

  const [entityType, setEntityType] = useState('vehicle'); // 'vehicle' | 'driver'
  const [selectedId, setSelectedId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [coordinatesSource, setCoordinatesSource] = useState('MOCK_DEMO');
  const [timestamp, setTimestamp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [clientError, setClientError] = useState('');

  // Auto-select first item on entity type switch
  useEffect(() => {
    if (entityType === 'vehicle') {
      if (vehicles.length > 0 && !vehicles.some(v => (v.vehicleId || v.id) === selectedId)) {
        setSelectedId(vehicles[0].vehicleId || vehicles[0].id);
      }
    } else {
      if (drivers.length > 0 && !drivers.some(d => (d.driverId || d.id) === selectedId)) {
        setSelectedId(drivers[0].driverId || drivers[0].id);
      }
    }
  }, [entityType, vehicles, drivers]);

  // Find active entity object
  const activeEntity = entityType === 'vehicle'
    ? vehicles.find(v => (v.vehicleId || v.id) === selectedId)
    : drivers.find(d => (d.driverId || d.id) === selectedId);

  // Sync inputs when active entity changes
  useEffect(() => {
    if (activeEntity) {
      if (typeof activeEntity.latitude === 'number') {
        setLatitude(String(activeEntity.latitude));
      } else {
        setLatitude('');
      }
      if (typeof activeEntity.longitude === 'number') {
        setLongitude(String(activeEntity.longitude));
      } else {
        setLongitude('');
      }
      setCoordinatesSource(activeEntity.coordinatesSource || 'MOCK_DEMO');
    }
  }, [selectedId, entityType]);

  const userRole = String(currentUser?.role || '').toUpperCase();
  const canUpdate = userRole === 'ADMIN' || userRole === 'FLEET_MANAGER' || userRole === 'DISPATCHER';

  const applyPreset = (preset) => {
    setLatitude(String(preset.lat));
    setLongitude(String(preset.lng));
    setCoordinatesSource('MOCK_DEMO');
    setClientError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setClientError('');
    setStatusMessage(null);

    // 1. Role validation
    if (!canUpdate) {
      setClientError('Forbidden: Your account role does not have permission to update coordinates.');
      setStatusMessage({
        type: 'error',
        code: 403,
        text: 'Forbidden: Requires ADMIN, FLEET_MANAGER, or DISPATCHER role.'
      });
      return;
    }

    // 2. Client-side coordinate validation
    if (!selectedId) {
      setClientError('Please select a vehicle or driver.');
      return;
    }

    if (latitude === '' || longitude === '') {
      setClientError('Latitude and Longitude are both required.');
      return;
    }

    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setClientError('Invalid Latitude: Must be a numeric value between -90 and 90 degrees.');
      return;
    }

    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setClientError('Invalid Longitude: Must be a numeric value between -180 and 180 degrees.');
      return;
    }

    setIsSubmitting(true);

    if (coordinatesSource === 'MOCK_DEMO') {
      const presetName = PRESET_CORRIDORS.find(p => p.lat === latNum && p.lng === lngNum)?.name;
      const result = applyDemoLocation(selectedId, entityType, {
        latitude: latNum,
        longitude: lngNum,
        locationName: presetName || 'Operational Location'
      });
      setIsSubmitting(false);
      if (result?.success) {
        setStatusMessage({
          type: 'success',
          text: `Successfully updated ${entityType} ${selectedId} coordinates (${latNum.toFixed(4)}, ${lngNum.toFixed(4)}) with source Operational Location.`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: result?.error || 'Failed to apply location update.'
        });
      }
      return;
    }

    const payload = {
      latitude: latNum,
      longitude: lngNum,
      coordinatesSource: coordinatesSource || 'MANUAL',
      locationTimestamp: timestamp || new Date().toISOString()
    };

    let result;
    if (entityType === 'vehicle') {
      result = await updateVehicleCoordinates(selectedId, payload);
    } else {
      result = await updateDriverCoordinates(selectedId, payload);
    }

    setIsSubmitting(false);

    if (result?.success) {
      setStatusMessage({
        type: 'success',
        text: `Successfully updated ${entityType} ${selectedId} coordinates (${latNum.toFixed(4)}, ${lngNum.toFixed(4)}) with source ${payload.coordinatesSource} in MongoDB Atlas.`
      });

      // Highlight on map
      setHighlightMapEntity({
        id: selectedId,
        type: entityType,
        latitude: latNum,
        longitude: lngNum
      });
    } else {
      const errText = result?.error || 'Failed to update coordinates.';
      setStatusMessage({
        type: 'error',
        code: result?.status,
        text: errText
      });
    }
  };

  return (
    <div
      data-testid="location-update-panel"
      className="bg-[#1A1A1D] rounded-2xl p-6 border border-[#2A2A2E] shadow-sm space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2A2E] pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-[#F5F5F5]">Telemetry Dispatch & Coordinate Update</h3>
              <span className="px-2 py-0.5 rounded-full bg-[#252528] text-[#9CA3AF] border border-[#2A2A2E] text-[10px] font-bold">
                Live Ingestion
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF]">
              Update verified GPS or Manual positions directly to MongoDB Atlas.
            </p>
          </div>
        </div>

        {/* Current Operator Role Badge */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-[#9CA3AF]">Role:</span>
          <span className="px-2 py-0.5 rounded-md bg-[#252528] text-white text-xs font-bold border border-[#2A2A2E]">
            {userRole || 'ANONYMOUS'}
          </span>
        </div>
      </div>

      {/* Role Warning if unauthorized */}
      {!canUpdate && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Notice: Coordinate mutations are restricted to ADMIN, FLEET_MANAGER, or DISPATCHER accounts.</span>
        </div>
      )}

      {/* Status Alerts */}
      {statusMessage && (
        <div
          data-testid="update-status-message"
          className={`p-4 rounded-xl text-xs font-semibold flex items-start space-x-2.5 animate-fadeIn ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
              : 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-bold block mb-0.5">
              {statusMessage.type === 'success' ? 'Update Confirmed' : `Request Failed ${statusMessage.code ? `(HTTP ${statusMessage.code})` : ''}`}
            </span>
            <span>{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* Client Validation Error */}
      {clientError && (
        <div
          data-testid="update-error-message"
          className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center space-x-2 animate-fadeIn"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{clientError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: Entity Type Selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-2">
            1. Select Target Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="entity-type-vehicle"
              onClick={() => { setEntityType('vehicle'); setClientError(''); }}
              className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                entityType === 'vehicle'
                  ? 'bg-cyan-950/50 border-cyan-500/60 text-cyan-300 shadow-sm'
                  : 'bg-[#0D0D0F] border-[#2A2A2E] text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#252528]'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Vehicle Fleet ({vehicles.length})</span>
            </button>

            <button
              type="button"
              data-testid="entity-type-driver"
              onClick={() => { setEntityType('driver'); setClientError(''); }}
              className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                entityType === 'driver'
                  ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-300 shadow-sm'
                  : 'bg-[#0D0D0F] border-[#2A2A2E] text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#252528]'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Driver Roster ({drivers.length})</span>
            </button>
          </div>
        </div>

        {/* Step 2: Entity Selection Dropdown */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
            2. Choose {entityType === 'vehicle' ? 'Vehicle' : 'Driver'}
          </label>
          <select
            data-testid="entity-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
          >
            {entityType === 'vehicle'
              ? vehicles.map((v) => {
                  const id = v.vehicleId || v.id;
                  const reg = v.registrationNumber || v.reg_no || '';
                  const loc = v.location || 'Hub Depot';
                  return (
                    <option key={id} value={id}>
                      {id} {reg ? `(${reg})` : ''} - Current: {loc}
                    </option>
                  );
                })
              : drivers.map((d) => {
                  const id = d.driverId || d.id;
                  const name = d.name || 'Driver';
                  const loc = d.currentLocation || d.self_reported_location || 'Corridor';
                  return (
                    <option key={id} value={id}>
                      {name} ({id}) - Current: {loc}
                    </option>
                  );
                })}
          </select>
        </div>

        {/* Active Entity Preview Card */}
        {activeEntity && (
          <div className="p-3.5 rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
            <div>
              <span className="text-[#9CA3AF] font-medium">Selected Entity: </span>
              <strong className="text-white">
                {entityType === 'vehicle' ? activeEntity.vehicleId || activeEntity.id : activeEntity.name}
              </strong>
              <span className="text-[#9CA3AF] ml-2">
                (Status: <span className="text-emerald-400 font-bold uppercase">{activeEntity.status || 'Active'}</span>)
              </span>
            </div>
            <div className="text-[11px] text-[#9CA3AF] font-mono">
              Current Coordinates:{' '}
              {typeof activeEntity.latitude === 'number' ? (
                <span className="text-cyan-300 font-bold">
                  {activeEntity.latitude.toFixed(4)}, {activeEntity.longitude.toFixed(4)}
                  {activeEntity.coordinatesSource === 'LIVE_GPS' ? ' (Live GPS)' : (activeEntity.coordinatesSource === 'MOBILE_GPS' ? ' (Live Device GPS)' : (activeEntity.coordinatesSource === 'MANUAL' ? ' (Manual)' : ''))}
                </span>
              ) : (
                <span className="text-amber-400">Station Coordinates (Hub Default)</span>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Coordinates Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
            3. Coordinate Inputs (Decimal Degrees)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-[11px] font-semibold text-[#9CA3AF] mb-1">
                Latitude <span className="text-cyan-400 font-normal">(-90.0 to 90.0)</span>
              </span>
              <input
                type="number"
                step="any"
                data-testid="latitude-input"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
                placeholder="e.g. 11.0168"
                className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
              />
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-[#9CA3AF] mb-1">
                Longitude <span className="text-cyan-400 font-normal">(-180.0 to 180.0)</span>
              </span>
              <input
                type="number"
                step="any"
                data-testid="longitude-input"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
                placeholder="e.g. 76.9558"
                className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
              />
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#9CA3AF] mr-1">Quick Presets:</span>
            {PRESET_CORRIDORS.map((p) => (
              <button
                key={p.name}
                type="button"
                data-testid={`preset-${p.name.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => applyPreset(p)}
                className="px-2 py-1 rounded-lg bg-[#252528] hover:bg-[#3F3F46] text-[#F5F5F5] text-[10px] font-semibold border border-[#2A2A2E] transition-all flex items-center space-x-1"
              >
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 4: Provenance Source & Timestamp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
              4. Coordinate Provenance Source
            </label>
            <select
              data-testid="source-select"
              value={coordinatesSource}
              onChange={(e) => setCoordinatesSource(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
            >
              <option value="MOCK_DEMO">Operational Location (Session Coordinates)</option>
              <option value="MANUAL">MANUAL (Admin / Dispatch Entry - Persist to DB)</option>
              <option value="LIVE_GPS">LIVE_GPS (Verified Telemetry Stream)</option>
              <option value="HUB_GEOLOCATION">HUB_GEOLOCATION (Station Anchor)</option>
            </select>
            <span className="block text-[10px] text-[#9CA3AF] mt-1">
              {coordinatesSource === 'MOCK_DEMO' ? (
                <span>Session mode: Updates local map marker for route optimization immediately.</span>
              ) : (
                <span>Manual entries will be labeled <strong className="text-cyan-400">MANUAL</strong> on the map and persisted to database.</span>
              )}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
              Timestamp Override (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                placeholder="Defaults to current timestamp"
                className="w-full px-4 py-2.5 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] text-[#F5F5F5] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
              />
              <Clock className="w-4 h-4 text-[#9CA3AF] absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Operational Coordination Notice */}
        <div className="p-3 bg-[#111113] border border-cyan-900/40 rounded-xl flex items-start space-x-2.5 text-xs text-[#9CA3AF]">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-cyan-400">Operational Coordinate Sync:</strong> Selecting a preset corridor updates the vehicle position and route optimizer instantly across active sessions.
          </span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          data-testid="submit-location-update"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-[#0D0D0F] font-extrabold text-xs shadow-md transition-all flex items-center justify-center space-x-2"
        >
          {isSubmitting ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin text-[#0D0D0F]" />
              <span>UPDATING LOCATION...</span>
            </>
          ) : coordinatesSource === 'MOCK_DEMO' ? (
            <>
              <MapPin className="w-4 h-4 text-[#0D0D0F]" />
              <span>APPLY LOCATION UPDATE</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4 text-[#0D0D0F]" />
              <span>PERSIST COORDINATES TO MONGODB ATLAS</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default LocationUpdatePanel;
