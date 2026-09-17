import React from 'react';
import { useFleet } from '../../context/FleetContext';
import { Fuel, Wrench } from 'lucide-react';

export const Phase2Placeholders = ({ onNavigateTab = null }) => {
  const { stats } = useFleet();

  const fuelAnomalyCount = stats?.fuel_anomalies !== undefined 
    ? String(stats.fuel_anomalies).padStart(2, '0') 
    : '00';

  const maintenanceDueCount = stats?.due_maintenance !== undefined 
    ? String(stats.due_maintenance).padStart(2, '0') 
    : '00';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6 select-none">
      {/* Card 1: Fuel Anomalies Flagged */}
      <div 
        onClick={() => onNavigateTab && onNavigateTab('fuel')}
        className={`bg-[#1A1A1D] rounded-2xl p-5 border border-[#2A2A2E] shadow-sm relative overflow-hidden transition-all ${
          onNavigateTab ? 'cursor-pointer hover:border-[#3F3F46] hover:scale-[1.005]' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E]">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F5F5F5]">Fuel Anomalies Flagged</h3>
              <p className="text-xs text-[#9CA3AF]">Siphon alerts & consumption variance</p>
            </div>
          </div>
          
          <span className="px-2.5 py-1 rounded-full bg-[#252528] text-[#9CA3AF] text-[10px] font-bold uppercase border border-[#2A2A2E]">
            Telemetry Sensor
          </span>
        </div>

        <div className="my-4 flex items-baseline space-x-3">
          <span className="text-3xl font-extrabold text-[#F5F5F5]">{fuelAnomalyCount}</span>
          <span className="text-xs text-[#9CA3AF]">flagged fuel events</span>
        </div>

        <div className="pt-3 border-t border-[#2A2A2E] flex items-center justify-between text-xs text-[#9CA3AF]">
          <span>Corridor Monitoring</span>
          <span className="font-semibold text-[#F5F5F5] flex items-center space-x-1">
            <span>{stats?.fuel_anomalies > 0 ? 'Anomaly Detected' : 'Normal Threshold'}</span>
            {onNavigateTab && <span className="text-emerald-400 ml-1">→</span>}
          </span>
        </div>
      </div>

      {/* Card 2: Upcoming Maintenance Due */}
      <div 
        onClick={() => onNavigateTab && onNavigateTab('maintenance')}
        className={`bg-[#1A1A1D] rounded-2xl p-5 border border-[#2A2A2E] shadow-sm relative overflow-hidden transition-all ${
          onNavigateTab ? 'cursor-pointer hover:border-[#3F3F46] hover:scale-[1.005]' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#252528] text-[#F5F5F5] border border-[#2A2A2E]">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F5F5F5]">Upcoming Maintenance Due (7 days)</h3>
              <p className="text-xs text-[#9CA3AF]">Predictive engine & oil health checks</p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-[#252528] text-[#9CA3AF] text-[10px] font-bold uppercase border border-[#2A2A2E]">
            Fleet Service
          </span>
        </div>

        <div className="my-4 flex items-baseline space-x-3">
          <span className="text-3xl font-extrabold text-[#F5F5F5]">{maintenanceDueCount}</span>
          <span className="text-xs text-[#9CA3AF]">vehicles scheduled</span>
        </div>

        <div className="pt-3 border-t border-[#2A2A2E] flex items-center justify-between text-xs text-[#9CA3AF]">
          <span>Preventive Maintenance</span>
          <span className="font-semibold text-[#F5F5F5] flex items-center space-x-1">
            <span>Queue Active</span>
            {onNavigateTab && <span className="text-amber-400 ml-1">→</span>}
          </span>
        </div>
      </div>
    </div>
  );
};
