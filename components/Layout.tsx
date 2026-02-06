
import React, { useState, useEffect } from 'react';
import { COUNCIL_LABELS } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin?: boolean;
  lastSync?: number;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, isAdmin = false, lastSync }) => {
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('traitors_theme') === 'light';
  });

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light-mode');
      localStorage.setItem('traitors_theme', 'light');
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem('traitors_theme', 'dark');
    }
  }, [isLightMode]);

  const toggleTheme = () => setIsLightMode(!isLightMode);

  return (
    <div className={`min-h-screen p-4 sm:p-6 md:p-10 lg:p-14 flex flex-col items-center transition-colors duration-500`}>
      <div className="max-w-7xl xl:max-w-[1400px] w-full space-y-12">
        <header className={`text-center space-y-5 py-10 md:py-12 relative overflow-hidden rounded-2xl transition-all duration-500 glass-panel`}>
          {/* Live Sync Badge & Theme Toggle */}
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-full border transition-all active:scale-95 ${isLightMode ? 'bg-red-900 border-red-700 text-white' : 'bg-black/50 border-zinc-700 text-zinc-200'}`}
              title={isLightMode ? "Extinguish the Torches" : "Light the Torches"}
              aria-label={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
              aria-pressed={isLightMode}
            >
              {isLightMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
                </svg>
              )}
            </button>

            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${isLightMode ? 'bg-white/80 border-red-200' : 'bg-black/50 border-zinc-800'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
              <span className={`text-[9px] uppercase tracking-[0.2em] font-semibold ${isLightMode ? 'text-red-900' : 'text-zinc-400'}`}>Round Table Live</span>
            </div>
          </div>

          <p className={`${isLightMode ? 'text-red-900' : 'text-[color:var(--accent)]/80'} tracking-[0.32em] text-xs uppercase font-semibold transition-colors`}>Titanic Swim Team Edition</p>
          <h1 className={`text-4xl md:text-6xl font-black uppercase drop-shadow-lg gothic-font transition-colors ${isLightMode ? 'text-red-900' : 'text-[color:var(--accent)]'}`}>The Traitors</h1>
          <h2 className={`text-base md:text-xl font-medium transition-colors ${isLightMode ? 'text-zinc-700' : 'text-[color:var(--muted)]'}`}>Season 4 Fantasy Draft</h2>

          <nav className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-3.5 mt-6 md:mt-8 px-4">
            <button 
              onClick={() => onTabChange('home')}
              className={`px-5 py-2.5 text-xs md:text-sm rounded-full border transition-all ${
                activeTab === 'home'
                  ? (isLightMode ? 'bg-red-900 text-white border-red-900' : 'bg-[color:var(--accent)] text-black border-[color:var(--accent)]')
                  : (isLightMode ? 'border-red-200 text-zinc-600 hover:border-red-900' : 'border-zinc-700 text-zinc-400 hover:border-[color:var(--accent)]')
              }`}
            >
              The Castle
            </button>
            <button 
              onClick={() => onTabChange('draft')}
              className={`px-5 py-2.5 text-xs md:text-sm rounded-full border transition-all ${
                activeTab === 'draft'
                  ? (isLightMode ? 'bg-red-900 text-white border-red-900' : 'bg-[color:var(--accent)] text-black border-[color:var(--accent)]')
                  : (isLightMode ? 'border-red-200 text-zinc-600 hover:border-red-900' : 'border-zinc-700 text-zinc-400 hover:border-[color:var(--accent)]')
              }`}
            >
              The Draft
            </button>
            <button 
              onClick={() => onTabChange('weekly')}
              className={`px-5 py-2.5 text-xs md:text-sm rounded-full border transition-all ${
                activeTab === 'weekly'
                  ? (isLightMode ? 'bg-red-900 text-white border-red-900' : 'bg-[color:var(--accent)] text-black border-[color:var(--accent)]')
                  : (isLightMode ? 'border-red-200 text-zinc-600 hover:border-red-900' : 'border-zinc-700 text-zinc-400 hover:border-[color:var(--accent)]')
              }`}
            >
              {COUNCIL_LABELS.weekly}
            </button>
            <button 
              onClick={() => onTabChange('leaderboard')}
              className={`px-5 py-2.5 text-xs md:text-sm rounded-full border transition-all ${
                activeTab === 'leaderboard'
                  ? (isLightMode ? 'bg-red-900 text-white border-red-900' : 'bg-[color:var(--accent)] text-black border-[color:var(--accent)]')
                  : (isLightMode ? 'border-red-200 text-zinc-600 hover:border-red-900' : 'border-zinc-700 text-zinc-400 hover:border-[color:var(--accent)]')
              }`}
            >
              Leaderboard
            </button>
            <button 
              onClick={() => onTabChange('admin')}
              className={`px-5 py-2.5 text-xs md:text-sm rounded-full border transition-all ${
                activeTab === 'admin'
                  ? 'bg-[color:var(--crimson)] text-white border-[color:var(--crimson)]'
                  : (isLightMode ? 'border-red-200 text-zinc-600 hover:border-red-900' : 'border-zinc-700 text-zinc-400 hover:border-[color:var(--crimson)]')
              }`}
            >
              Admin
            </button>
          </nav>
        </header>

        <main className={`glass-panel p-6 md:p-10 rounded-2xl min-h-[60vh] transition-colors duration-500`}>
          <div className="page-shell">
            {children}
          </div>
        </main>

        <footer className={`text-center text-xs md:text-sm py-10 border-t transition-colors duration-500 ${isLightMode ? 'text-zinc-500 border-red-100' : 'text-gray-600 border-gray-900'}`}>
            <p className="mb-2">Designed for the Titanic Swim Team League. Trust No One.</p>
            {lastSync && <p className="opacity-30">Last synchronized with the Tome of Secrets: {new Date(lastSync).toLocaleTimeString()}</p>}
        </footer>
      </div>
    </div>
  );
};

export default Layout;
