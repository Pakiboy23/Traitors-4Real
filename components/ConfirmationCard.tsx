
import React from 'react';

interface ConfirmationCardProps {
  playerName: string;
  onReset: () => void;
}

const ConfirmationCard: React.FC<ConfirmationCardProps> = ({ playerName, onReset }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-700">
      <div id="card-display" className="w-[320px] sm:w-[600px] h-[400px] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-2 border-[#8a1c1c] relative shadow-[0_0_40px_rgba(138,28,28,0.2)] flex flex-col items-center justify-center text-center p-8 overflow-hidden rounded-sm">
        {/* Gold Inner Border */}
        <div className="absolute inset-[10px] border border-[#d4af37] pointer-events-none" />
        
        {/* Corners */}
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />

        {/* Seal */}
        <div className="wax-seal mb-5">
            <span className="gothic-font text-2xl text-[#b04a4a] font-black">T</span>
        </div>

        {/* Content */}
        <h3 className="gothic-font text-[#d4af37] tracking-[0.2em] text-xs sm:text-sm uppercase mb-6">Titanic Swim Team</h3>
        
        <h1 className="gothic-font text-2xl sm:text-4xl font-bold text-white mb-2 uppercase tracking-wide">Entry Accepted</h1>
        
        <div className="w-16 h-0.5 bg-[#8a1c1c] my-4" />

        <p className="text-gray-400 text-sm italic mb-4">Your fate is sealed,</p>
        
        <h2 className="handwriting text-4xl sm:text-6xl text-[#d4af37] mb-6 drop-shadow-md">
          {playerName || "Faithful..."}
        </h2>

        <p className="gothic-font text-[10px] sm:text-xs text-red-700 font-bold tracking-[0.3em] uppercase opacity-80">
          Trust No One • Season 4
        </p>
      </div>

      <button 
        onClick={onReset}
        className="text-[#d4af37] hover:text-white transition-colors gothic-font uppercase text-sm tracking-widest border-b border-[#d4af37] pb-1"
      >
        Submit Another Entry
      </button>
    </div>
  );
};

export default ConfirmationCard;
