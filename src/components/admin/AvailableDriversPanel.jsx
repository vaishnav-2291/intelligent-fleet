import React, { useState } from 'react';
import { useFleet } from '../../context/FleetContext';
import { AssignRouteModal } from './AssignRouteModal';
import { Users, MapPin, Clock, Navigation, CheckCircle } from 'lucide-react';

export const AvailableDriversPanel = () => {
  const { drivers } = useFleet();
  const [selectedDriverForModal, setSelectedDriverForModal] = useState(null);

  const availableDrivers = drivers.filter(
    (d) => d.status.toLowerCase() === 'ready'
  );

  return (
    <div className="bg-[#1A1A1D] rounded-2xl p-6 border border-[#2A2A2E] shadow-sm select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#F5F5F5] tracking-tight">Available Drivers for Dispatch</h2>
            <p className="text-xs text-[#9CA3AF]">Drivers in ready state awaiting corridor assignment.</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-950/50 text-emerald-400 text-xs font-bold border border-emerald-800/40">
          {availableDrivers.length} Available
        </span>
      </div>

      {/* Table / List View */}
      {availableDrivers.length === 0 ? (
        <div className="text-center py-10 bg-[#0D0D0F] rounded-xl border border-dashed border-[#2A2A2E]">
          <CheckCircle className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
          <p className="text-sm font-semibold text-[#F5F5F5]">No Drivers Currently Waiting in Ready State</p>
          <p className="text-xs text-[#9CA3AF] mt-1 max-w-sm mx-auto">
            All registered drivers are currently offline or actively fulfilling corridor dispatch assignments.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#2A2A2E] text-[#9CA3AF] font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Driver Name</th>
                <th className="py-3 px-4">Time Went Ready</th>
                <th className="py-3 px-4">Self-Reported Location</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2E] font-medium text-[#F5F5F5]">
              {availableDrivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-[#252528] transition-colors">
                  {/* Driver Name */}
                  <td className="py-3.5 px-4">
                    <div>
                      <p className="font-bold text-[#F5F5F5]">{driver.name}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{driver.phone}</p>
                    </div>
                  </td>

                  {/* Ready Time */}
                  <td className="py-3.5 px-4 text-[#F5F5F5]">
                    <div className="flex items-center space-x-1.5 font-mono">
                      <Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      <span>{driver.duty_start_time_str || (typeof driver.duty_start_time === 'string' ? driver.duty_start_time : (driver.duty_start_time ? new Date(driver.duty_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'))}</span>
                    </div>
                  </td>

                  {/* Self-Reported Location */}
                  <td className="py-3.5 px-4">
                    {driver.self_reported_location ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E] font-semibold text-xs">
                        <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                        <span>{driver.self_reported_location} Hub</span>
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF] italic">Not shared</span>
                    )}
                  </td>

                  {/* Solid White Action Button */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedDriverForModal(driver)}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-[#0D0D0F] text-xs font-extrabold shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all inline-flex items-center space-x-1.5"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Assign Route</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Route Modal */}
      <AssignRouteModal
        driver={selectedDriverForModal}
        isOpen={Boolean(selectedDriverForModal)}
        onClose={() => setSelectedDriverForModal(null)}
      />
    </div>
  );
};
