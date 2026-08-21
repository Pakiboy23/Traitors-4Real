import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { COUNCIL_LABELS, ShowConfig, UiVariant } from "../types";
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
import { shouldShowAdminTab } from "../src/utils/adminEntry";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  lastSync?: number;
  showConfig?: ShowConfig;
  uiVariant: UiVariant;
  isAdminAuthenticated?: boolean;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  lastSync,
  showConfig,
  uiVariant,
  isAdminAuthenticated = false,
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

  // Null until there is something to report. "No sync yet" told a player
  // nothing and was the first thing in frame on a cold load.
  const syncLabel = useMemo(
    () => (lastSync ? `Synced ${new Date(lastSync).toLocaleTimeString()}` : null),
    [lastSync]
  );
  const isDevBuild = process.env.NODE_ENV === "development";

  const [showAdminTab, setShowAdminTab] = useState(false);
  useEffect(() => {
    // Read on the client only: the URL is not known during prerender, and a
    // mismatch between server and client markup would hydrate wrong.
    setShowAdminTab(
      shouldShowAdminTab({
        isAuthenticated: isAdminAuthenticated,
        search: window.location.search,
        hash: window.location.hash,
      })
    );
  }, [isAdminAuthenticated]);

  const terminology = showConfig?.terminology;
  const weeklyLabel = terminology?.weeklyCouncilLabel || COUNCIL_LABELS.weekly;
  const navItems: Array<{ id: string; label: string }> = [
    { id: "home", label: "Overview" },
    ...(showConfig?.featureToggles?.draftEnabled === false
      ? []
      : [{ id: "draft", label: terminology?.draftLabel || "Draft" }]),
    { id: "weekly", label: weeklyLabel },
    { id: "leaderboard", label: terminology?.leaderboardLabel || "Leaderboard" },
    // Always available: a player needs the scoring rules most while a form is
    // closed to them, so this is never gated behind the draft being open.
    { id: "rules", label: "Rules" },
    // Hidden unless asked for by URL or already signed in — see
    // src/utils/adminEntry.ts for why, and for the two URLs that reveal it.
    ...(showAdminTab
      ? [{ id: "admin", label: terminology?.adminLabel || "Admin" }]
      : []),
  ];


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
              {isDevBuild && (
                <PremiumStatusBadge tone="accent">Development</PremiumStatusBadge>
              )}
              {syncLabel && <PremiumStatusBadge>{syncLabel}</PremiumStatusBadge>}
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
                Lock {weeklyLabel} Picks
              </button>
            </div>
          </motion.div>

          <motion.div className="premium-header-title-row" variants={cardRevealVariants}>
            <div>
              <p className="premium-kicker">
                {showConfig?.branding?.headerKicker || showConfig?.showName || "Round Table Draft"}
              </p>
              <h1 className="premium-app-title">
                {showConfig?.branding?.appTitle || "Round Table Command Desk"}
              </h1>
            </div>
            <p className="premium-subtitle premium-shell-summary">
              Track standings, lock weekly calls, and chase the season lead in one compact,
              consistent workspace.
            </p>
          </motion.div>

          <motion.div className="premium-nav-row" variants={cardRevealVariants}>
            <PremiumTabs items={navItems} activeId={activeTab} onChange={onTabChange} />
          </motion.div>
        </motion.header>

        <motion.main className="premium-main-shell animate-page-in" variants={sectionStaggerVariants}>
          <div className="page-shell">{children}</div>
        </motion.main>

        <footer className="premium-footer">
          {showConfig?.branding?.footerCopy || "Round Table Draft workspace."}
        </footer>
      </div>
    </motion.div>
  );
};

export default Layout;
