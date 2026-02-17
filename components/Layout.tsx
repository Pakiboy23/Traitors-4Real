import React, { useEffect, useMemo, useState } from "react";
import { COUNCIL_LABELS } from "../types";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  lastSync?: number;
}

const NAV_ITEMS: Array<{ id: string; label: string }> = [
  { id: "home", label: "Overview" },
  { id: "draft", label: "Draft" },
  { id: "weekly", label: COUNCIL_LABELS.weekly },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "admin", label: "Admin" },
];

const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  lastSync,
}) => {
  const [isLightMode, setIsLightMode] = useState(
    () => localStorage.getItem("traitors_theme") === "light"
  );

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add("light-mode");
      localStorage.setItem("traitors_theme", "light");
      return;
    }
    document.body.classList.remove("light-mode");
    localStorage.setItem("traitors_theme", "dark");
  }, [isLightMode]);

  const syncLabel = useMemo(() => {
    if (!lastSync) return "Not synchronized yet";
    return `Synced ${new Date(lastSync).toLocaleTimeString()}`;
  }, [lastSync]);

  return (
    <div className="min-h-screen">
      <div className="app-shell space-y-5 md:space-y-6">
        <header className="glass-panel p-4 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-[10px] md:text-xs font-semibold tracking-[0.24em] uppercase text-[color:var(--text-muted)]">
                Fantasy Operations Console
              </p>
              <h1 className="headline text-2xl sm:text-3xl md:text-4xl font-semibold">
                The Traitors Draft League
              </h1>
              <p className="text-xs md:text-sm text-[color:var(--text-muted)]">
                Season 4 strategy hub for picks, weekly calls, and standings.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <div className="status-pill inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[color:var(--success)] animate-pulse" />
                Live Sync
              </div>
              <div className="status-pill">{syncLabel}</div>
              <button
                type="button"
                onClick={() => setIsLightMode((prev) => !prev)}
                className="btn-secondary px-4 text-[11px]"
                aria-label={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
                aria-pressed={isLightMode}
                title={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
              >
                {isLightMode ? "Dark" : "Light"}
              </button>
            </div>
          </div>

          <nav className="mt-5 flex items-center gap-2 overflow-x-auto pb-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`pill-nav whitespace-nowrap ${
                  activeTab === item.id ? "pill-nav-active" : ""
                }`}
                aria-current={activeTab === item.id ? "page" : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="glass-panel p-4 sm:p-6 md:p-8 lg:p-10 min-h-[62vh] animate-page-in">
          <div className="page-shell">{children}</div>
        </main>

        <footer className="px-2 pb-4 text-center text-xs text-[color:var(--text-muted)] tracking-[0.12em] uppercase">
          Premium fantasy tracking experience for the league
        </footer>
      </div>
    </div>
  );
};

export default Layout;
