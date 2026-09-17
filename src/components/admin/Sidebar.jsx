import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Navigation, 
  Users, 
  UserPlus, 
  Truck, 
  PlusCircle, 
  Wrench,
  Fuel,
  ShieldCheck,
  Activity,
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  X
} from 'lucide-react';
import appLogo from '../../assets/app-logo.png';

export const Sidebar = ({ activeTab, setActiveTab, mobileOpen, setMobileOpen }) => {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'dispatch', label: 'Dispatch & Routing', icon: Navigation },
    { id: 'drivers', label: 'Driver Roster', icon: Users },
    { id: 'add-driver', label: 'Add Driver', icon: UserPlus },
    { id: 'fleet', label: 'Fleet Roster', icon: Truck },
    { id: 'add-vehicle', label: 'Add Vehicle', icon: PlusCircle },
    { id: 'maintenance', label: 'Maintenance Queue', icon: Wrench },
    { id: 'fuel', label: 'Fuel Telemetry', icon: Fuel },
    { id: 'safety', label: 'Safety Alerts', icon: ShieldCheck },
    { id: 'analytics', label: 'Fleet Analytics', icon: Activity },
    { id: 'help', label: 'Help & Documentation', icon: HelpCircle },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-[#0D0D0F]/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container - Fully Opaque #1A1A1D Surface */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-[#1A1A1D] border-r border-[#2A2A2E] flex flex-col justify-between transition-all duration-300 select-none ${
          collapsed ? 'lg:w-20' : 'lg:w-64'
        } ${mobileOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Top Header Logo */}
        <div>
          <div className="h-16 px-4 flex items-center justify-between border-b border-[#2A2A2E]">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-[#252528] border border-[#2A2A2E] flex-shrink-0 flex items-center justify-center text-white shadow-md p-1">
                <img src={appLogo} alt="Logo" className="w-full h-full object-contain" />
              </div>
              {(!collapsed || mobileOpen) && (
                <div className="animate-fadeIn">
                  <h1 className="font-extrabold text-sm text-[#F5F5F5] tracking-tight leading-none">INTELLIGENT FLEET</h1>
                  <span className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wider">Enterprise OS</span>
                </div>
              )}
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#252528]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl font-medium text-xs transition-all ${
                    isActive
                      ? 'bg-white text-[#0D0D0F] font-bold shadow-md'
                      : 'text-[#9CA3AF] hover:bg-[#252528] hover:text-[#F5F5F5]'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#0D0D0F]' : 'text-[#9CA3AF]'}`} />
                  {(!collapsed || mobileOpen) && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section - Collapse Toggle */}
        <div className="p-3 border-t border-[#2A2A2E]">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:bg-[#252528] hover:text-[#F5F5F5] transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 mx-auto text-[#F5F5F5]" />
            ) : (
              <>
                <span>Collapse Sidebar</span>
                <ChevronLeft className="w-4 h-4 text-[#F5F5F5]" />
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
