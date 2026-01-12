
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
        
        <h2 className="text-4xl md:text-6xl gothic-font text-[color:var(--accent)] tracking-[0.2em] leading-tight">
          WELCOME TO THE <br/>ROUND TABLE
        </h2>
        
        <p className="handwriting text-2xl md:text-3xl text-[color:var(--muted)] opacity-80">
          Trust no one. Question everything.
        </p>
      </section>

      {/* App Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        <div className="glass-panel p-8 rounded-2xl relative overflow-hidden group hover:accent-outline transition-all">
          <div className="absolute top-0 left-0 w-1 h-full bg-[color:var(--accent)] opacity-60"></div>
          <h3 className="gothic-font text-[color:var(--accent)] text-lg mb-4 uppercase tracking-[0.25em]">The Game</h3>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Draft your squad, lock predictions, and track the season in real time. This is the official
            <strong> Titanic Swim Team</strong> fantasy draft for <em>The Traitors Season 4</em>.
          </p>
        </div>

        <div className="glass-panel p-8 rounded-2xl relative overflow-hidden group hover:accent-outline transition-all">
          <div className="absolute top-0 left-0 w-1 h-full bg-[color:var(--crimson)] opacity-70"></div>
          <h3 className="gothic-font text-[color:var(--crimson)] text-lg mb-4 uppercase tracking-[0.25em]">The Architect</h3>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Built for the league. From live scoring to AI‑generated insights, everything is designed to keep the draft fast,
            focused, and easy to read.
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
          className="group relative px-10 py-4 bg-[color:var(--accent)] text-black font-bold gothic-font uppercase tracking-[0.3em] hover:bg-[color:var(--accent-strong)] transition-all hover:scale-[1.02] active:scale-95 rounded-full shadow-[0_8px_30px_rgba(214,178,74,0.3)]"
        >
          <span className="relative z-10">Enter the Castle</span>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
        </button>
        <p className="mt-4 text-[9px] text-zinc-600 uppercase tracking-[0.3em]">
          Start the draft
        </p>
      </div>
    </div>
  );
};

export default Welcome;
