import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { COUNCIL_LABELS, UiVariant } from "../types";
import {
  cardRevealVariants,
  pageRevealVariants,
  sectionStaggerVariants,
} from "../src/ui/motion";
import {
  PremiumButton,
  PremiumStatusBadge,
  PremiumTabs,
} from "../src/ui/premium";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  lastSync?: number;
  uiVariant: UiVariant;
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
  uiVariant,
}) => {
  const reduceMotion = useReducedMotion();
  const isPremiumUi = uiVariant === "premium";
  const [isLightMode, setIsLightMode] = useState(
    () => localStorage.getItem("traitors_theme") === "light"
  );

  useEffect(() => {
    document.body.classList.toggle("premium-ui", isPremiumUi);

    if (isPremiumUi) {
      document.body.classList.remove("light-mode");
      localStorage.setItem("traitors_theme", "dark");
      return;
    }

    if (isLightMode) {
      document.body.classList.add("light-mode");
      localStorage.setItem("traitors_theme", "light");
      return;
    }

    document.body.classList.remove("light-mode");
    localStorage.setItem("traitors_theme", "dark");
  }, [isLightMode, isPremiumUi]);

  const syncLabel = useMemo(() => {
    if (!lastSync) return "No sync yet";
    return `Synced ${new Date(lastSync).toLocaleTimeString()}`;
  }, [lastSync]);

  const envLabel = import.meta.env.DEV ? "Development" : "Production";

  return (
    <motion.div
      className={`min-h-screen ${isPremiumUi ? "premium-shell" : ""}`}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={pageRevealVariants}
    >
      <div className="app-shell space-y-4 md:space-y-5">
        <motion.header className="premium-shell-header" variants={sectionStaggerVariants}>
          <motion.div className="premium-utility-bar" variants={cardRevealVariants}>
            <div className="premium-utility-left">
              <PremiumStatusBadge tone="accent">{envLabel}</PremiumStatusBadge>
              <PremiumStatusBadge>{syncLabel}</PremiumStatusBadge>
            </div>

            <div className="premium-utility-right">
              {!isPremiumUi && (
                <PremiumButton
                  onClick={() => setIsLightMode((prev) => !prev)}
                  variant="ghost"
                  className="px-4 text-xs md:text-sm"
                  aria-label={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
                  aria-pressed={isLightMode}
                  title={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
                >
                  {isLightMode ? "Dark" : "Light"}
                </PremiumButton>
              )}
              <button
                type="button"
                onClick={() => onTabChange("weekly")}
                className="premium-btn premium-btn-primary px-5 text-xs md:text-sm"
              >
                Submit Weekly Picks
              </button>
            </div>
          </motion.div>

          <motion.div className="premium-header-title-row" variants={cardRevealVariants}>
            <div>
              <p className="premium-kicker">Traitors Fantasy Draft</p>
              <h1 className="premium-app-title">Round Table Command Desk</h1>
            </div>
            <p className="premium-subtitle premium-shell-summary">
              Track standings, lock weekly calls, and chase the season lead in one compact,
              consistent workspace.
            </p>
          </motion.div>

          <motion.div className="premium-nav-row" variants={cardRevealVariants}>
            <PremiumTabs items={NAV_ITEMS} activeId={activeTab} onChange={onTabChange} />
          </motion.div>
        </motion.header>

        <motion.main className="premium-main-shell animate-page-in" variants={sectionStaggerVariants}>
          <div className="page-shell">{children}</div>
        </motion.main>

        <footer className="premium-footer">Traitors Fantasy Draft: Titanic Swim Team Edition workspace.</footer>
      </div>
    </motion.div>
  );
};

export default Layout;
