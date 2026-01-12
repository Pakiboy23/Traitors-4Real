
import React from 'react';

interface ConfirmationCardProps {
  playerName: string;
  onReset: () => void;
}

const ConfirmationCard: React.FC<ConfirmationCardProps> = ({ playerName, onReset }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-700">
      <div id="card-display" className="w-[320px] sm:w-[600px] h-[400px] glass-panel relative shadow-[0_0_40px_rgba(138,28,28,0.2)] flex flex-col items-center justify-center text-center p-8 overflow-hidden rounded-2xl">
        {/* Gold Inner Border */}
        <div className="absolute inset-[10px] border border-[color:var(--accent)]/60 pointer-events-none rounded-xl" />
        
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
        <h3 className="gothic-font text-[color:var(--accent)] tracking-[0.25em] text-xs sm:text-sm uppercase mb-6">Titanic Swim Team</h3>
        
        <h1 className="gothic-font text-2xl sm:text-4xl font-bold text-white mb-2 uppercase tracking-wide">Entry Confirmed</h1>
        
        <div className="w-16 h-0.5 bg-[color:var(--crimson)] my-4" />

        <p className="text-gray-400 text-sm italic mb-4">Your entry is locked,</p>
        
        <h2 className="handwriting text-4xl sm:text-6xl text-[color:var(--accent)] mb-6 drop-shadow-md">
          {playerName || "Faithful..."}
        </h2>

        <p className="gothic-font text-[10px] sm:text-xs text-red-500 font-semibold tracking-[0.3em] uppercase opacity-80">
          Trust no one • Season 4
        </p>
      </div>

      <button 
        onClick={onReset}
        className="text-[color:var(--accent)] hover:text-white transition-colors gothic-font uppercase text-xs tracking-[0.25em] border-b border-[color:var(--accent)] pb-1"
      >
        Submit Another Entry
      </button>
    </div>
  );
};

export default ConfirmationCard;
