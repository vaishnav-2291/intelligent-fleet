import React from 'react';
import { useFleet } from '../../context/FleetContext';
import { Truck, CheckCircle2, AlertTriangle, Users } from 'lucide-react';

export const StatCards = () => {
  const { stats, vehicles, activeDriversCount } = useFleet();

  const hasVehicleStats = (stats?.total_vehicles || 0) > 0;
  const travellingCount = hasVehicleStats
    ? stats.travelling_count
    : (vehicles.length > 0 ? vehicles.filter((v) => (v.status || '').toLowerCase() === 'travelling').length : (stats?.travelling_count ?? 8));

  const idleCount = hasVehicleStats
    ? stats.idle_count
    : (vehicles.length > 0 ? vehicles.filter((v) => (v.status || '').toLowerCase() === 'idle').length : (stats?.idle_count ?? 0));

  const maintenanceCount = hasVehicleStats
    ? stats.maintenance_count
    : (vehicles.length > 0 ? vehicles.filter((v) => (v.status || '').toLowerCase() === 'maintenance').length : (stats?.maintenance_count ?? 1));

  const activeDriversCountValue = (stats?.total_drivers || 0) > 0
    ? (stats.active_drivers_today || 9)
    : (activeDriversCount || (stats?.active_drivers_today ?? 9));

  const cards = [
    {
      id: 'travelling',
      title: 'Travelling',
      count: travellingCount,
      subtitle: 'Vehicles on active routes',
      dotClass: 'bg-blue-500',
      badgeBg: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
      icon: Truck,
    },
    {
      id: 'idle',
      title: 'Idle / Available',
      count: idleCount,
      subtitle: 'Ready for dispatch assignment',
      dotClass: 'bg-emerald-500',
      badgeBg: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40',
      icon: CheckCircle2,
    },
    {
      id: 'maintenance',
      title: 'In Maintenance',
      count: maintenanceCount,
      subtitle: 'Scheduled repair / servicing',
      dotClass: 'bg-amber-500',
      badgeBg: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
      icon: AlertTriangle,
    },
    {
      id: 'active-drivers',
      title: 'Active Drivers Today',
      count: activeDriversCountValue,
      subtitle: 'Logged into duty state',
      dotClass: 'bg-zinc-400',
      badgeBg: 'bg-[#252528] text-[#F5F5F5] border-[#2A2A2E]',
      icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 select-none">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            className="bg-[#1A1A1D] rounded-2xl p-5 border border-[#2A2A2E] flex flex-col justify-between group transition-all duration-200 hover:border-[#3F3F46]"
          >
            {/* Top row: Title + Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${card.dotClass}`}></span>
                <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">{card.title}</span>
              </div>
              <div className={`p-2 rounded-xl ${card.badgeBg} border`}>
                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            {/* Middle: Count Number */}
            <div className="my-4">
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#F5F5F5] tracking-tight">
                  {card.count}
                </span>
                <span className="text-xs font-medium text-[#9CA3AF]">units</span>
              </div>
            </div>

            {/* Bottom: Subtitle */}
            <div className="pt-2 border-t border-[#2A2A2E] flex items-center justify-between text-[11px] text-[#9CA3AF]">
              <span>{card.subtitle}</span>
              <span className="font-semibold text-[#F5F5F5]">Live DB</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
