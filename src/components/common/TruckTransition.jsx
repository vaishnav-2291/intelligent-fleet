import React, { useEffect, useState } from 'react';
import truckDriveImg from '../../assets/truck-drive.png';

export const TruckTransition = ({ isActive, onComplete }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setIsFadingOut(false);
      return;
    }

    // Fade out overlay after truck exits right screen (1.25s)
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 1250);

    // Trigger onComplete callback to open modal (1.45s)
    const finishTimer = setTimeout(() => {
      setIsFadingOut(false);
      if (onComplete) onComplete();
    }, 1450);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [isActive, onComplete]);

  if (!isActive) return null;

  const handleSkip = () => {
    setIsFadingOut(false);
    if (onComplete) onComplete();
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] bg-[#000000] flex items-center justify-center overflow-hidden cursor-pointer select-none transition-opacity duration-200 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Highway Road Line */}
      <div className="absolute w-full h-[2px] bg-white/20 bottom-1/2 translate-y-14"></div>

      {/* Truck Drive Motion Track */}
      <div className="relative w-full max-w-7xl flex items-center justify-center h-48">
        {/* Motion Trail 2 (Farthest) */}
        <img
          src={truckDriveImg}
          alt=""
          aria-hidden="true"
          className="absolute h-28 w-auto object-contain opacity-15 filter blur-[1px] animate-truckDriveTrail2 pointer-events-none"
        />

        {/* Motion Trail 1 */}
        <img
          src={truckDriveImg}
          alt=""
          aria-hidden="true"
          className="absolute h-28 w-auto object-contain opacity-30 animate-truckDriveTrail1 pointer-events-none"
        />

        {/* Lead Truck Silhouette */}
        <img
          src={truckDriveImg}
          alt="Truck Dispatch Transition"
          className="absolute h-28 w-auto object-contain animate-truckDriveLead pointer-events-none"
        />
      </div>

      {/* Snappy Dispatch Badge */}
      <div className="absolute bottom-16 text-center animate-fadeIn">
        <span className="text-[11px] font-mono tracking-widest text-[#9CA3AF] uppercase bg-[#1A1A1D] px-3.5 py-1.5 rounded-full border border-[#2A2A2E] shadow-xl">
          DISPATCHING CORRIDOR ROUTE...
        </span>
      </div>
    </div>
  );
};
