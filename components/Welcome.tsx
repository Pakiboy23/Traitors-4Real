
import React from 'react';

interface WelcomeProps {
  onStart: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onStart }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 py-10 animate-in fade-in duration-1000">
      {/* Hero Section */}
      <section className="text-center space-y-6">
        <div className="flex justify-center mb-8">
          <div className="wax-seal scale-[2.5] shadow-[0_0_30px_rgba(138,28,28,0.35)]">
            <span className="gothic-font text-2xl text-[#b04a4a] font-black">T</span>
          </div>
        </div>
        
        <h2 className="text-5xl md:text-7xl gothic-font text-[color:var(--accent)] tracking-[0.2em] leading-tight">
          WELCOME TO THE <br/>ROUND TABLE
        </h2>
        
        <p className="handwriting text-3xl md:text-4xl text-[color:var(--muted)] opacity-80">
          Trust No One. Suspect Everyone.
        </p>
      </section>

      {/* App Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        <div className="glass-panel p-8 rounded-2xl relative overflow-hidden group hover:accent-outline transition-all">
          <div className="absolute top-0 left-0 w-1 h-full bg-[color:var(--accent)] opacity-60"></div>
          <h3 className="gothic-font text-[color:var(--accent)] text-xl mb-4 uppercase tracking-[0.25em]">The Game</h3>
          <p className="text-zinc-300 text-sm leading-relaxed">
            This is the official <strong>Titanic Swim Team</strong> fantasy draft portal for <em>The Traitors Season 4</em>. 
            Assemble your squad of 10 contestants, assign strategic ranks, and predict the twists of the game. 
            Will your chosen Faithful prevail, or will the Traitors you draft leave you in the shadows?
          </p>
        </div>

        <div className="glass-panel p-8 rounded-2xl relative overflow-hidden group hover:accent-outline transition-all">
          <div className="absolute top-0 left-0 w-1 h-full bg-[color:var(--crimson)] opacity-70"></div>
          <h3 className="gothic-font text-[color:var(--crimson)] text-xl mb-4 uppercase tracking-[0.25em]">The Architect</h3>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Crafted for the elite members of the Titanic Swim Team league. I built this application to bring the mystery 
            and treachery of the castle into our own hands. From real-time scoring to AI-generated "Prophecies," 
            this tool is designed to track our collective descent into chaos.
          </p>
        </div>
      </div>

      {/* Feature List */}
      <section className="glass-panel border-y border-zinc-800 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="space-y-2">
            <span className="text-2xl">✍️</span>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-[0.2em]">Strategic Drafting</p>
          </div>
          <div className="space-y-2">
            <span className="text-2xl">📊</span>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-[0.2em]">Live Leaderboard</p>
          </div>
          <div className="space-y-2">
            <span className="text-2xl">🧙‍♂️</span>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-[0.2em]">AI Chat Advisor</p>
          </div>
          <div className="space-y-2">
            <span className="text-2xl">🎨</span>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-[0.2em]">Portrait Generation</p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <div className="flex flex-col items-center pt-8">
        <button 
          onClick={onStart}
          className="group relative px-14 py-6 bg-[color:var(--accent)] text-black font-bold gothic-font uppercase tracking-[0.3em] text-base md:text-lg hover:bg-[color:var(--accent-strong)] transition-all hover:scale-[1.06] active:scale-95 rounded-full shadow-[0_12px_40px_rgba(214,178,74,0.4)]"
        >
          <span className="relative z-10">Enter the Castle</span>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
        </button>
        <p className="mt-4 text-xs md:text-sm text-zinc-600 uppercase tracking-[0.3em]">
          Your journey begins at the Round Table
        </p>
      </div>
    </div>
  );
};

export default Welcome;
