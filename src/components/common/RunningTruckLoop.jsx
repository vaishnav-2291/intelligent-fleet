import React from 'react';

const TruckSVG = () => (
  <svg
    viewBox="0 0 280 170"
    className="h-44 sm:h-52 w-auto fill-[#FFFFFF] stroke-none"
  >
    {/* Cargo Container Box */}
    <rect x="20" y="20" width="160" height="100" rx="4" />
    
    {/* Vertical Grooves on Cargo Box */}
    <line x1="45" y1="20" x2="45" y2="120" stroke="#0D0D0F" strokeWidth="2.5" />
    <line x1="70" y1="20" x2="70" y2="120" stroke="#0D0D0F" strokeWidth="2.5" />
    <line x1="95" y1="20" x2="95" y2="120" stroke="#0D0D0F" strokeWidth="2.5" />
    <line x1="120" y1="20" x2="120" y2="120" stroke="#0D0D0F" strokeWidth="2.5" />
    <line x1="145" y1="20" x2="145" y2="120" stroke="#0D0D0F" strokeWidth="2.5" />

    {/* Truck Driver Cab */}
    <path d="M180,45 L215,45 L255,85 L255,120 L180,120 Z" />
    
    {/* Windshield Cutout */}
    <path d="M210,53 L245,88 L210,88 Z" fill="#0D0D0F" />
    
    {/* Cab Door Line */}
    <line x1="205" y1="50" x2="205" y2="120" stroke="#0D0D0F" strokeWidth="2" />

    {/* Underchassis Frame */}
    <rect x="20" y="115" width="235" height="12" rx="2" fill="#FFFFFF" />

    {/* Wheel 1 - Rear Left */}
    <g className="animate-wheelSpin origin-[75px_138px]">
      <circle cx="75" cy="138" r="20" fill="#FFFFFF" />
      <circle cx="75" cy="138" r="14" fill="#0D0D0F" />
      <circle cx="75" cy="138" r="6" fill="#FFFFFF" />
      <line x1="75" y1="124" x2="75" y2="152" stroke="#FFFFFF" strokeWidth="2" />
      <line x1="61" y1="138" x2="89" y2="138" stroke="#FFFFFF" strokeWidth="2" />
    </g>

    {/* Wheel 2 - Rear Right */}
    <g className="animate-wheelSpin origin-[125px_138px]">
      <circle cx="125" cy="138" r="20" fill="#FFFFFF" />
      <circle cx="125" cy="138" r="14" fill="#0D0D0F" />
      <circle cx="125" cy="138" r="6" fill="#FFFFFF" />
      <line x1="125" y1="124" x2="125" y2="152" stroke="#FFFFFF" strokeWidth="2" />
      <line x1="111" y1="138" x2="139" y2="138" stroke="#FFFFFF" strokeWidth="2" />
    </g>

    {/* Wheel 3 - Front Right */}
    <g className="animate-wheelSpin origin-[225px_138px]">
      <circle cx="225" cy="138" r="20" fill="#FFFFFF" />
      <circle cx="225" cy="138" r="14" fill="#0D0D0F" />
      <circle cx="225" cy="138" r="6" fill="#FFFFFF" />
      <line x1="225" y1="124" x2="225" y2="152" stroke="#FFFFFF" strokeWidth="2" />
      <line x1="211" y1="138" x2="239" y2="138" stroke="#FFFFFF" strokeWidth="2" />
    </g>
  </svg>
);

export const RunningTruckLoop = React.memo(() => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none flex items-center justify-center">
      {/* Infinite Seamless Looping Truck 1 */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 animate-runningTruckLoop1 flex items-center opacity-30">
        <TruckSVG />
      </div>

      {/* Infinite Seamless Looping Truck 2 (Staggered -10s for continuous stream) */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 animate-runningTruckLoop2 flex items-center opacity-30">
        <TruckSVG />
      </div>
    </div>
  );
});
