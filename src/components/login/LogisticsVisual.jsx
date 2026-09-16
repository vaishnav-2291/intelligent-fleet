import React from 'react';
import { Truck, Route, Sparkles } from 'lucide-react';
import darkGrungeBg from '../../assets/dark-grunge-bg.svg';
import appLogo from '../../assets/app-logo.png';

export const LogisticsVisual = () => {
  return (
    <div 
      className="hidden lg:flex lg:w-3/5 relative overflow-hidden p-12 flex-col justify-between select-none border-r border-[#2A2A2E] bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(rgba(13, 13, 15, 0.55), rgba(13, 13, 15, 0.75)), url(${darkGrungeBg})`
      }}
    >
      {/* Background Dot-Grid Overlay */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#9CA3AF_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>

      {/* Top Header Label */}
      <div className="relative z-10 flex items-center space-x-3">
        <div className="w-11 h-11 rounded-xl bg-[#1A1A1D] border border-[#2A2A2E] flex items-center justify-center shadow-md p-1.5 flex-shrink-0">
          <img src={appLogo} alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-widest text-[#9CA3AF] font-bold">Enterprise Fleet Operations</span>
          <p className="text-[#F5F5F5] font-extrabold text-lg tracking-tight">INTELLIGENT FLEET</p>
        </div>
      </div>

      {/* Visual Network Centerpiece */}
      <div className="relative z-10 my-auto py-10">
        {/* Subtle Geometric Constellation Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-[#2A2A2E]" strokeDasharray="3 3">
          <line x1="22%" y1="28%" x2="50%" y2="48%" strokeWidth="1.2" opacity="0.6" />
          <line x1="50%" y1="48%" x2="78%" y2="24%" strokeWidth="1.2" opacity="0.6" />
          <line x1="50%" y1="48%" x2="68%" y2="76%" strokeWidth="1.2" opacity="0.6" />
        </svg>

        {/* Central Hub Icon */}
        <div className="relative mx-auto w-24 h-24 rounded-3xl bg-[#1A1A1D] border-2 border-[#2A2A2E] flex items-center justify-center shadow-2xl p-2 group transition-all">
          <div className="w-20 h-20 rounded-2xl bg-[#252528] border border-[#3F3F46] flex items-center justify-center text-[#F5F5F5] p-2 shadow-inner">
            <img src={appLogo} alt="Logo" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Main Heading Text Overlay */}
        <div className="text-center mt-8 max-w-xl mx-auto">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#1A1A1D] border border-[#2A2A2E] text-[#9CA3AF] text-[11px] font-bold uppercase tracking-widest mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Enterprise Fleet Operations</span>
          </span>
          <h1 className="text-4xl xl:text-5xl font-black text-[#F5F5F5] tracking-tight leading-tight">
            INTELLIGENT FLEET NETWORK
          </h1>
          <p className="mt-4 text-[#9CA3AF] text-sm leading-relaxed max-w-lg mx-auto font-normal">
            AI-assisted fleet operations, dispatch coordination, route optimization and operational analytics.
          </p>
        </div>

        {/* 3 Concise Feature Cards */}
        <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {/* Card 1: Fleet Operations */}
          <div className="bg-[#1A1A1D]/90 backdrop-blur-sm rounded-2xl p-4 border border-[#2A2A2E] shadow-lg transition-all hover:border-[#3F3F46]">
            <div className="w-8 h-8 rounded-xl bg-[#252528] text-emerald-400 border border-[#2A2A2E] flex items-center justify-center mb-2.5">
              <Truck className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-[#F5F5F5]">Fleet Operations</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-snug">Live asset & duty cycle monitoring</p>
          </div>

          {/* Card 2: Route Optimization */}
          <div className="bg-[#1A1A1D]/90 backdrop-blur-sm rounded-2xl p-4 border border-[#2A2A2E] shadow-lg transition-all hover:border-[#3F3F46]">
            <div className="w-8 h-8 rounded-xl bg-[#252528] text-sky-400 border border-[#2A2A2E] flex items-center justify-center mb-2.5">
              <Route className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-[#F5F5F5]">Route Optimization</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-snug">OSRM highway corridor telemetry</p>
          </div>

          {/* Card 3: AI Fleet Assistant */}
          <div className="bg-[#1A1A1D]/90 backdrop-blur-sm rounded-2xl p-4 border border-[#2A2A2E] shadow-lg transition-all hover:border-[#3F3F46]">
            <div className="w-8 h-8 rounded-xl bg-[#252528] text-amber-400 border border-[#2A2A2E] flex items-center justify-center mb-2.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-[#F5F5F5]">AI Fleet Assistant</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-snug">Natural language operational intel</p>
          </div>
        </div>
      </div>

      {/* Bottom Footer Label */}
      <div className="relative z-10 flex items-center justify-between text-xs text-[#9CA3AF] border-t border-[#2A2A2E] pt-6">
        <span>© 2026 Intelligent Fleet</span>
        <span className="uppercase tracking-wider text-[10px] font-bold">Enterprise Operations Platform</span>
      </div>
    </div>
  );
};
