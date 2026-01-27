
import React from 'react';

interface WelcomeProps {
  onStart: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onStart }) => {
  return (
    <div className="max-w-7xl mx-auto py-16 md:py-24 animate-in fade-in duration-1000 lg:grid lg:grid-cols-12 lg:gap-16 lg:items-start">
      {/* Hero Section */}
      <section className="text-center space-y-8 lg:col-span-7 lg:text-left">
        <div className="flex justify-center lg:justify-start mb-10">
          <div className="wax-seal scale-[2.5] shadow-[0_0_30px_rgba(138,28,28,0.35)]">
            <span className="gothic-font text-2xl text-[#b04a4a] font-black">T</span>
          </div>
        </div>
        
        <h2 className="text-6xl md:text-8xl gothic-font text-[color:var(--accent)] tracking-[0.18em] leading-[1.05]">
          WELCOME TO THE <br/>ROUND TABLE
        </h2>
        
        <p className="handwriting text-4xl md:text-5xl text-[color:var(--muted)] opacity-85">
          Trust No One. Suspect Everyone.
        </p>
      </section>

      <div className="space-y-12 mt-16 lg:mt-0 lg:col-span-5">
        {/* App Explanation */}
        <div className="grid grid-cols-1 gap-6">
          <div className="glass-panel p-9 rounded-3xl relative overflow-hidden group hover:accent-outline transition-all">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[color:var(--accent)] opacity-60"></div>
            <h3 className="gothic-font text-[color:var(--accent)] text-2xl mb-5 uppercase tracking-[0.2em]">The Game</h3>
            <p className="text-zinc-200 text-base leading-relaxed">
              This is the official <strong>Titanic Swim Team</strong> fantasy draft portal for <em>The Traitors Season 4</em>.
              Assemble your squad of 10 contestants, assign strategic ranks, and predict the twists of the game.
              Will your chosen Faithful prevail, or will the Traitors you draft leave you in the shadows?
            </p>
          </div>

          <div className="glass-panel p-9 rounded-3xl relative overflow-hidden group hover:accent-outline transition-all">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[color:var(--crimson)] opacity-75"></div>
            <h3 className="gothic-font text-[color:var(--crimson)] text-2xl mb-5 uppercase tracking-[0.2em]">The Architect</h3>
            <p className="text-zinc-200 text-base leading-relaxed">
              Crafted for the elite members of the Titanic Swim Team league. I built this application to bring the mystery
              and treachery of the castle into our own hands. From real-time scoring to AI-generated "Prophecies,"
              this tool is designed to track our collective descent into chaos.
            </p>
          </div>
        </div>

        {/* Feature List */}
        <section className="glass-panel border-y border-zinc-800/70 py-9 rounded-3xl">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div className="space-y-3">
              <span className="text-3xl">✍️</span>
              <p className="text-xs text-zinc-400 uppercase font-bold tracking-[0.2em]">Strategic Drafting</p>
            </div>
            <div className="space-y-3">
              <span className="text-3xl">📊</span>
              <p className="text-xs text-zinc-400 uppercase font-bold tracking-[0.2em]">Live Leaderboard</p>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <div className="flex flex-col items-center lg:items-start pt-4">
          <button
            onClick={onStart}
            className="group relative px-16 py-7 bg-[color:var(--accent)] text-black font-bold gothic-font uppercase tracking-[0.28em] text-lg md:text-xl hover:bg-[color:var(--accent-strong)] transition-all hover:scale-[1.04] active:scale-95 rounded-full shadow-[0_14px_46px_rgba(217,221,227,0.42)]"
          >
            <span className="relative z-10">Enter the Castle</span>
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
          </button>
          <p className="mt-5 text-sm md:text-base text-zinc-500 uppercase tracking-[0.28em] text-center lg:text-left">
            Your journey begins at the Round Table
          </p>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
