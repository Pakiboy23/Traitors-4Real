
import React, { useState, useEffect } from 'react';

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
    <div className={`min-h-screen p-4 md:p-8 flex flex-col items-center transition-colors duration-500`}>
      <div className="max-w-6xl w-full space-y-8">
        <header className={`text-center space-y-4 py-8 border-b-2 ${isLightMode ? 'border-red-900/50 bg-white/40' : 'border-yellow-700 bg-black/40'} relative overflow-hidden rounded-t-xl transition-all duration-500`}>
          {/* Live Sync Badge & Theme Toggle */}
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-full border transition-all ${isLightMode ? 'bg-red-900 border-red-700 text-white' : 'bg-zinc-800 border-zinc-700 text-[#D4AF37]'}`}
              title={isLightMode ? "Extinguish the Torches" : "Light the Torches"}
            >
              {isLightMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
                </svg>
              )}
            </button>

            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${isLightMode ? 'bg-white/80 border-red-200' : 'bg-black/60 border-zinc-800'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
              <span className={`text-[8px] uppercase tracking-tighter font-bold ${isLightMode ? 'text-red-900' : 'text-zinc-400'}`}>Live Round Table</span>
            </div>
          </div>

          <p className={`${isLightMode ? 'text-red-900' : 'text-red-600'} tracking-[0.3em] text-sm uppercase font-bold animate-pulse transition-colors`}>Titanic Swim Team Edition</p>
          <h1 className={`text-4xl md:text-6xl font-black tracking-wider uppercase drop-shadow-lg gothic-font transition-colors ${isLightMode ? 'text-red-900' : 'text-[#D4AF37]'}`}>The Traitors</h1>
          <h2 className={`text-xl md:text-2xl font-light gothic-font transition-colors ${isLightMode ? 'text-zinc-700' : 'text-gray-400'}`}>Season 4 Fantasy Draft</h2>

          <nav className="flex flex-wrap justify-center gap-2 md:gap-4 mt-6">
            <button 
              onClick={() => onTabChange('home')}
              className={`px-3 md:px-4 py-2 text-xs md:text-sm rounded-full border transition-all ${activeTab === 'home' ? (isLightMode ? 'bg-red-900 text-white border-red-900' : 'bg-zinc-800 text-white border-zinc-800') : (isLightMode ? 'border-red-200 text-zinc-600 hover:border-red-900' : 'border-gray-700 hover:border-white')}`}
            >
              The Castle
            </button>
            <button 
              onClick={() => onTabChange('draft')}
              className={`px-3 md:px-4 py-2 text-xs md:text-sm rounded-full border transition-all ${activeTab === 'draft' ? (isLightMode ? 'bg-red-900 text-white border-red-900' : 'bg-[#D4AF37] text-black border-[#D4AF37]') : (isLightMode ? 'border-red-200 text-zinc-600 hover:border-red-900' : 'border-gray-700 hover:border-[#D4AF37]')}`}
            >
              The Draft
            </button>
            <button
              onClick={() => onTabChange('leaderboard')}
              className={`px-3 md:px-4 py-2 text-xs md:text-sm rounded-full border transition-all ${activeTab === 'leaderboard' ? (isLightMode ? 'bg-red-900 text-white border-red-900' : 'bg-[#D4AF37] text-black border-[#D4AF37]') : (isLightMode ? 'border-red-200 text-zinc-600 hover:border-red-900' : 'border-gray-700 hover:border-[#D4AF37]')}`}
            >
              Leaderboard
            </button>
            <button
              onClick={() => onTabChange('admin')}
              className={`px-3 md:px-4 py-2 text-xs md:text-sm rounded-full border transition-all ${activeTab === 'admin' ? 'bg-red-900 text-white border-red-900' : (isLightMode ? 'border-red-200 text-zinc-600 hover:border-red-900' : 'border-gray-700 hover:border-red-900')}`}
            >
              Admin
            </button>
          </nav>
        </header>

        <main className={`bg-black/5 p-2 md:p-6 rounded-b-xl min-h-[60vh] transition-colors duration-500`}>
          {children}
        </main>

        <footer className={`text-center text-[10px] md:text-xs py-8 border-t transition-colors duration-500 ${isLightMode ? 'text-zinc-500 border-red-100' : 'text-gray-600 border-gray-900'}`}>
            <p className="mb-2">Designed for the Titanic Swim Team League. Trust No One.</p>
            {lastSync && <p className="opacity-30">Last synchronized with the Tome of Secrets: {new Date(lastSync).toLocaleTimeString()}</p>}
        </footer>
      </div>
    </div>
  );
};

export default Layout;
