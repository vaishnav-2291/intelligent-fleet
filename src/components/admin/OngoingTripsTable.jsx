import React, { useState } from 'react';
import { useFleet } from '../../context/FleetContext';
import { Route, Clock, CheckCircle, XCircle } from 'lucide-react';

export const OngoingTripsTable = () => {
  const { trips, completeTrip, cancelTrip } = useFleet();
  const [pendingAction, setPendingAction] = useState(null); // { tripId, action: 'complete' | 'cancel' }
  const inFlightRef = React.useRef(new Set());

  const statusBadgeStyles = {
    assigned: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
    ongoing: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
    completed: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40',
    cancelled: 'bg-zinc-900 text-zinc-400 border-zinc-800',

    Assigned: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
    Ongoing: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
    Completed: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40',
    Cancelled: 'bg-zinc-900 text-zinc-400 border-zinc-800'
  };

  const handleMarkComplete = async (trip) => {
    const tripId = trip.tripId || trip.id || trip.trip_id;
    const driverId = trip.driverId || trip.driver_id || trip.driver;
    const vehicleId = trip.vehicleId || trip.vehicle_id || trip.vehicle;

    const statusStr = (trip.status || '').toLowerCase();
    if (statusStr === 'completed' || statusStr === 'cancelled') return;
    if (inFlightRef.current.has(tripId) || pendingAction?.tripId === tripId) return;

    inFlightRef.current.add(tripId);
    setPendingAction({ tripId, action: 'complete' });

    if (import.meta.env.DEV) {
      console.log(`[OngoingTripsTable] Clicked Action: Mark Complete | Trip ID: ${tripId} | Driver ID: ${driverId} | Vehicle ID: ${vehicleId}`);
    }

    try {
      const res = await completeTrip(tripId, driverId, vehicleId);
      if (import.meta.env.DEV) {
        console.log(`[OngoingTripsTable] Mark Complete Result:`, res);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error(`[OngoingTripsTable] Mark Complete Error:`, err);
      }
    } finally {
      inFlightRef.current.delete(tripId);
      setPendingAction(null);
    }
  };

  const handleCancelTrip = async (trip) => {
    const tripId = trip.tripId || trip.id || trip.trip_id;
    const driverId = trip.driverId || trip.driver_id || trip.driver;
    const vehicleId = trip.vehicleId || trip.vehicle_id || trip.vehicle;

    const statusStr = (trip.status || '').toLowerCase();
    if (statusStr === 'completed' || statusStr === 'cancelled') return;
    if (inFlightRef.current.has(tripId) || pendingAction?.tripId === tripId) return;

    inFlightRef.current.add(tripId);
    setPendingAction({ tripId, action: 'cancel' });

    if (import.meta.env.DEV) {
      console.log(`[OngoingTripsTable] Clicked Action: Cancel Trip | Trip ID: ${tripId} | Driver ID: ${driverId} | Vehicle ID: ${vehicleId}`);
    }

    try {
      const res = await cancelTrip(tripId, driverId, vehicleId);
      if (import.meta.env.DEV) {
        console.log(`[OngoingTripsTable] Cancel Trip Result:`, res);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error(`[OngoingTripsTable] Cancel Trip Error:`, err);
      }
    } finally {
      inFlightRef.current.delete(tripId);
      setPendingAction(null);
    }
  };

  return (
    <div className="bg-[#1A1A1D] rounded-2xl p-6 border border-[#2A2A2E] shadow-sm select-none">
      {/* Table Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E]">
            <Route className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#F5F5F5] tracking-tight">Ongoing & Recent Trips</h2>
            <p className="text-xs text-[#9CA3AF]">Live corridor telemetry tracking across assigned dispatch routes.</p>
          </div>
        </div>
        <span className="text-xs text-[#9CA3AF] font-semibold">
          Total Logs: {trips.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#2A2A2E] text-[#9CA3AF] font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Driver</th>
              <th className="py-3 px-4">Assigned Route</th>
              <th className="py-3 px-4">Est. Duration</th>
              <th className="py-3 px-4">Vehicle Reg</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2A2E] font-medium text-[#F5F5F5]">
            {trips.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-8 text-center text-[#9CA3AF]">
                  No trips dispatched yet today.
                </td>
              </tr>
            ) : (
              trips.map((trip) => {
                const statusStr = (trip.status || '').toLowerCase();
                const isCompleted = statusStr === 'completed';
                const isCancelled = statusStr === 'cancelled';
                const isActive = !isCompleted && !isCancelled;

                const resolvedTripId = trip.tripId || trip.id || trip.trip_id;
                const isRowBusy = pendingAction?.tripId === resolvedTripId;
                const isCompleting = isRowBusy && pendingAction?.action === 'complete';
                const isCancelling = isRowBusy && pendingAction?.action === 'cancel';

                return (
                  <tr key={resolvedTripId} className="hover:bg-[#252528] transition-colors">
                    {/* Driver Name */}
                    <td className="py-3.5 px-4 font-bold text-[#F5F5F5]">
                      {trip.driver_name || 'Driver'}
                    </td>

                    {/* Route Source -> Destination */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2 font-semibold">
                        <span className="text-[#F5F5F5]">{trip.source}</span>
                        <span className="text-[#9CA3AF]">→</span>
                        <span className="text-[#F5F5F5]">{trip.destination}</span>
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="py-3.5 px-4 font-mono text-[#9CA3AF]">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-[#9CA3AF]" />
                        <span>{trip.estimated_duration}</span>
                      </div>
                    </td>

                    {/* Vehicle Reg */}
                    <td className="py-3.5 px-4 font-mono text-[#F5F5F5] font-bold">
                      {trip.vehicle_reg || trip.vehicle_no || 'TN 33 AA 4019'}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase inline-flex items-center space-x-1.5 ${statusBadgeStyles[trip.status] || statusBadgeStyles.assigned}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          statusStr === 'ongoing' || trip.status === 'On Trip' ? 'bg-blue-400 animate-ping' :
                          statusStr === 'assigned' ? 'bg-amber-400' :
                          statusStr === 'completed' ? 'bg-emerald-400' : 'bg-zinc-400'
                        }`}></span>
                        <span>{trip.status}</span>
                      </span>
                    </td>

                    {/* Actions: Mark Complete & Cancel */}
                    <td className="py-3.5 px-4 text-right">
                      {isActive ? (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleMarkComplete(trip)}
                            disabled={isRowBusy}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1 shadow-sm ${
                              isRowBusy
                                ? 'bg-[#252528] text-[#9CA3AF] border border-[#2A2A2E] cursor-not-allowed opacity-60'
                                : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/50'
                            }`}
                            title="Mark trip as completed"
                          >
                            {isCompleting ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin"></div>
                                <span>Completing...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Mark Complete</span>
                              </>
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleCancelTrip(trip)}
                            disabled={isRowBusy}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isRowBusy
                                ? 'bg-[#252528] text-[#9CA3AF] border-[#2A2A2E] cursor-not-allowed opacity-60'
                                : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/40'
                            }`}
                            title="Cancel trip"
                          >
                            {isCancelling ? (
                              <div className="w-3.5 h-3.5 border-2 border-rose-300 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#9CA3AF] text-[11px] italic">No actions</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
