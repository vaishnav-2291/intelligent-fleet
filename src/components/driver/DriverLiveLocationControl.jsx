import React, { useState, useEffect, useRef } from 'react';
import { useFleet } from '../../context/FleetContext';
import {
  startDriverLocationWatch,
  stopDriverLocationWatch
} from '../../services/driverGeolocation';
import {
  Radio,
  Clock,
  Signal,
  Power,
  Info
} from 'lucide-react';

export const DriverLiveLocationControl = ({ driverId, driverName }) => {
  const { transmitDriverLocation, currentUser } = useFleet();

  const [isSharing, setIsSharing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('OFFLINE'); // 'OFFLINE' | 'ACQUIRING' | 'STREAMING' | 'STALE'
  const [lastCoords, setLastCoords] = useState(null); // { latitude, longitude, accuracy, timestamp }
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [showPermissionInfo, setShowPermissionInfo] = useState(true);

  const watchIdRef = useRef(null);
  const isSharingRef = useRef(false);
  const isStartingRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    isSharingRef.current = isSharing;
  }, [isSharing]);

  // Clean up geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        stopDriverLocationWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      isStartingRef.current = false;
    };
  }, []);

  // Check for stale coordinates periodically (if > 30 seconds since last transmission while active)
  useEffect(() => {
    if (!isSharing) return;

    const interval = setInterval(() => {
      if (lastSyncTime && Date.now() - lastSyncTime.getTime() > 30000) {
        setGpsStatus('STALE');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isSharing, lastSyncTime]);

  const handleStartSharing = () => {
    setGpsStatus('ACQUIRING');
    setIsSharing(false);
    isStartingRef.current = true;

    if (watchIdRef.current !== null) {
      stopDriverLocationWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const watchId = startDriverLocationWatch({
      minIntervalMs: 8000,
      onLocation: async (frame) => {
        if (!isSharingRef.current && !isStartingRef.current) return;

        setLastCoords(frame);

        // Transmit frame to authenticated backend
        const payload = {
          driverId: driverId || currentUser?.driverId || 'DR001',
          latitude: frame.latitude,
          longitude: frame.longitude,
          accuracy: frame.accuracy,
          timestamp: frame.timestamp,
          source: 'MOBILE_GPS'
        };

        try {
          const result = await transmitDriverLocation(payload);
          if (result && result.success) {
            isStartingRef.current = false;
            setIsSharing(true);
            setLastSyncTime(new Date());
            setGpsStatus('STREAMING');
          } else {
            // Optional telemetry transmission unsuccessful or backend unavailable:
            // Quietly revert to neutral inactive state without throwing user-facing technical errors.
            if (watchIdRef.current !== null) {
              stopDriverLocationWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
            isStartingRef.current = false;
            setIsSharing(false);
            setGpsStatus('OFFLINE');
            setLastCoords(null);
          }
        } catch (err) {
          if (watchIdRef.current !== null) {
            stopDriverLocationWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          isStartingRef.current = false;
          setIsSharing(false);
          setGpsStatus('OFFLINE');
          setLastCoords(null);
        }
      },
      onError: () => {
        // Geolocation denied, unavailable, or timed out:
        // Safely reset watcher and remain in quiet, non-blocking neutral inactive state.
        if (watchIdRef.current !== null) {
          stopDriverLocationWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        isStartingRef.current = false;
        setIsSharing(false);
        setGpsStatus('OFFLINE');
        setLastCoords(null);
      }
    });

    watchIdRef.current = watchId;
  };

  const handleStopSharing = () => {
    if (watchIdRef.current !== null) {
      stopDriverLocationWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    isStartingRef.current = false;
    setIsSharing(false);
    setGpsStatus('OFFLINE');
    setLastCoords(null);
  };

  const toggleSharing = () => {
    if (isSharing || gpsStatus === 'ACQUIRING') {
      handleStopSharing();
    } else {
      handleStartSharing();
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return 'Not yet synced';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <div
      data-testid="driver-live-location-control"
      className="bg-[#1A1A1D] rounded-2xl border border-[#2A2A2E] p-3.5 sm:p-4 shadow-sm relative overflow-hidden transition-all"
    >
      {/* Background Accent Pulse */}
      {isSharing && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      )}

      {/* Header with Title and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all flex-shrink-0 ${
            isSharing
              ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300 shadow-lg shadow-cyan-950/40'
              : 'bg-[#252528] border-[#2A2A2E] text-[#9CA3AF]'
          }`}>
            <Radio className={`w-4 h-4 ${isSharing ? 'animate-pulse text-cyan-400' : ''}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs sm:text-sm font-bold text-[#F5F5F5] tracking-tight">Live Device GPS Telemetry</h3>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-cyan-950/40 text-cyan-300 border border-cyan-800/40">
                LOCATION SERVICES
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
              Optional telemetry broadcast to operations dispatch. Route assignment and navigation operate independently.
            </p>
          </div>
        </div>

        {/* Action Button & Status */}
        <div className="flex items-center space-x-3 self-end sm:self-auto">
          {/* Status Indicator Badge */}
          <span
            data-testid="gps-status-indicator"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center space-x-1.5 ${
              gpsStatus === 'STREAMING'
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/50'
                : gpsStatus === 'ACQUIRING'
                ? 'bg-amber-950/70 text-amber-300 border-amber-800/50'
                : gpsStatus === 'STALE'
                ? 'bg-amber-950/70 text-amber-300 border-amber-800/50'
                : 'bg-[#252528] text-zinc-400 border-[#2A2A2E]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              gpsStatus === 'STREAMING' ? 'bg-emerald-400 animate-ping' :
              gpsStatus === 'ACQUIRING' ? 'bg-amber-400 animate-pulse' :
              gpsStatus === 'STALE' ? 'bg-amber-400' : 'bg-zinc-500'
            }`}></span>
            <span>
              {gpsStatus === 'STREAMING' && 'Location Sharing Active • Broadcasting Live GPS'}
              {gpsStatus === 'ACQUIRING' && 'Acquiring GPS Signal...'}
              {gpsStatus === 'STALE' && 'GPS Signal Stale'}
              {gpsStatus === 'OFFLINE' && 'Location Sharing Inactive'}
            </span>
          </span>

          {/* Toggle Button */}
          <button
            type="button"
            data-testid="toggle-location-sharing"
            onClick={toggleSharing}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 border shadow-sm transition-all cursor-pointer ${
              isSharing
                ? 'bg-rose-950/70 hover:bg-rose-900 border-rose-800/60 text-rose-200 active:scale-95'
                : gpsStatus === 'ACQUIRING'
                ? 'bg-amber-950/70 hover:bg-amber-900 border-amber-800/60 text-amber-200 active:scale-95'
                : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white active:scale-95'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>
              {isSharing ? 'Stop Live Location' : (gpsStatus === 'ACQUIRING' ? 'Acquiring Signal...' : 'Share Live Location')}
            </span>
          </button>
        </div>
      </div>

      {/* Active Telemetry Readout (Only visible when actively streaming) */}
      {isSharing && lastCoords && (
        <div className="mt-3 pt-3 border-t border-[#2A2A2E] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-[10px] text-[#9CA3AF] uppercase font-semibold mr-1.5">Lat:</span>
              <span data-testid="gps-latitude" className="font-mono font-bold text-cyan-300">
                {lastCoords.latitude.toFixed(5)}° N
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#9CA3AF] uppercase font-semibold mr-1.5">Lng:</span>
              <span data-testid="gps-longitude" className="font-mono font-bold text-cyan-300">
                {lastCoords.longitude.toFixed(5)}° E
              </span>
            </div>
            <div data-testid="gps-accuracy" className="flex items-center space-x-1 text-emerald-400 font-mono">
              <Signal className="w-3 h-3" />
              <span>{lastCoords.accuracy !== null ? `±${lastCoords.accuracy}m` : 'Active'}</span>
            </div>
          </div>

          {lastSyncTime && (
            <div className="flex items-center space-x-1.5 text-[11px] text-[#9CA3AF]" data-testid="gps-last-sync">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>Synced: <strong className="text-[#F5F5F5]">{formatTimeAgo(lastSyncTime)}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Permission Explanation Banner (Optional info) */}
      {!isSharing && showPermissionInfo && (
        <div
          data-testid="gps-permission-info"
          className="mt-2.5 p-2.5 rounded-xl bg-[#121215] border border-cyan-900/30 text-[11px] text-zinc-300 flex items-center justify-between gap-2 animate-fadeIn"
        >
          <div className="flex items-center space-x-2">
            <Info className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <p>When you click <strong>Share Live Location</strong>, your browser will request permission to access device GPS coordinates.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPermissionInfo(false)}
            className="text-zinc-500 hover:text-zinc-300 text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
