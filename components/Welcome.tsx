import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import CountdownTimer from "../components/CountdownTimer";
import { FinaleConfig, SeasonConfig, ShowConfig, UiVariant } from "../types";
import {
  cardRevealVariants,
  pageRevealVariants,
  sectionStaggerVariants,
} from "../src/ui/motion";
import { formatScore } from "../src/utils/scoring";
import {
  PremiumButton,
  PremiumCard,
  PremiumStatusBadge,
} from "../src/ui/premium";

export interface MvpHighlight {
  name: string;
  score: number;
  label: string;
  portraitUrl?: string;
}

export interface LeaguePulseOverview {
  entries: number;
  activeCastCount: number;
  latestArchiveLabel: string;
  pendingSubmissions: number | null;
}

export interface TopMoverEntry {
  name: string;
  delta: number;
  league: "main" | "jr";
}

export interface FinalStandingEntry {
  name: string;
  score: number;
  portraitUrl?: string;
  league?: "main" | "jr";
}

interface WelcomeProps {
  onStart: () => void;
  mvp?: MvpHighlight | null;
  weeklyMvp?: MvpHighlight | null;
  leaguePulse: LeaguePulseOverview;
  topMovers: TopMoverEntry[];
  actionQueue: string[];
  finaleConfig?: FinaleConfig;
  seasonFinalized?: boolean;
  finalStandings?: FinalStandingEntry[];
  showConfig?: ShowConfig;
  seasons?: SeasonConfig[];
  activeSeasonId?: string | null;
  onSeasonChange?: (seasonId: string) => void;
  uiVariant: UiVariant;
}

const FINALE_OVERVIEW_CONFETTI_COUNT = 20;
const buildDefaultLockAt = () =>
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const formatDelta = (value: number) => {
  const formatted = formatScore(value);
  return value > 0 ? `+${formatted}` : formatted;
};

const getMomentumDisplay = (value: number) => {
  if (value > 0) {
    return { icon: "⬆", className: "premium-value-positive !text-green-500" };
  }
  if (value < 0) {
    return { icon: "⬇", className: "premium-value-negative !text-red-500" };
  }
  return { icon: "", className: "text-[color:var(--text)]" };
};

const LeaderMiniCard: React.FC<{
  title: string;
  player?: MvpHighlight | null;
  tone?: "accent" | "neutral";
}> = ({ title, player, tone = "neutral" }) => {
  return (
    <article className="premium-mini-leader-card">
      <p className="premium-kicker">{title}</p>
      {player ? (
        <>
          <p className="premium-mini-leader-name">{player.name}</p>
          <p
            className={`premium-mini-leader-score ${
              tone === "accent" ? "premium-mini-leader-score-accent" : ""
            }`}
          >
            {tone === "accent" ? formatDelta(player.score) : formatScore(player.score)}
          </p>
          <p className="premium-meta-line">{player.label}</p>
        </>
      ) : (
        <p className="premium-meta-line">No certified score data yet.</p>
      )}
    </article>
  );
};

const Welcome: React.FC<WelcomeProps> = ({
  onStart,
  mvp,
  weeklyMvp,
  leaguePulse,
  topMovers,
  actionQueue,
  finaleConfig,
  seasonFinalized,
  finalStandings,
  showConfig,
  seasons = [],
  activeSeasonId,
  onSeasonChange,
  uiVariant,
}) => {
  const reduceMotion = useReducedMotion();
  const isPremiumUi = uiVariant === "premium";
  const cardHover = reduceMotion ? undefined : { y: -4, scale: 1.004 };
  const isFinaleMode = Boolean(finaleConfig?.enabled);
  const countdownTarget = finaleConfig?.lockAt || buildDefaultLockAt();
  const lockLabel =
    typeof finaleConfig?.label === "string" && finaleConfig.label.trim()
      ? finaleConfig.label
      : showConfig?.terminology?.finaleLabelDefault || "Finale Gauntlet";
  const winner = finalStandings?.[0] ?? null;
  const runnerUp = finalStandings?.[1] ?? null;
  const thirdPlace = finalStandings?.[2] ?? null;
  const isSeasonFinalized = Boolean(isFinaleMode && seasonFinalized && winner);
  const winningMargin =
    winner && runnerUp ? winner.score - runnerUp.score : null;

  const summaryCards: Array<{
    label: string;
    value: string;
    hint: React.ReactNode;
  }> = [
    {
      label: "Private Members",
      value: String(leaguePulse.entries),
      hint: "Confirmed entries",
    },
    {
      label: "Suspects In Play",
      value: String(leaguePulse.activeCastCount),
      hint: "Still on the board",
    },
    {
      label: "Certified Snapshot",
      value: leaguePulse.latestArchiveLabel,
      hint: "Most recent archived board",
    },
    {
      label: "Ballots Pending",
      value:
        leaguePulse.pendingSubmissions === null
          ? "Private"
          : String(leaguePulse.pendingSubmissions),
      hint:
        leaguePulse.pendingSubmissions === null ? (
          "Submission intake is private"
        ) : (
          <>
            entries await operations review.{" "}
            <span className="text-white font-semibold">Window still open.</span>
          </>
        ),
    },
  ];

  const overallLeaderScore = mvp ? formatScore(mvp.score) : "No score yet";
  const weeklySurgeMomentum = weeklyMvp
    ? getMomentumDisplay(weeklyMvp.score)
    : null;

  const gameLoop = isSeasonFinalized
    ? [
        {
          title: "Final Board Certified",
          detail: "Official standings are now locked and published.",
        },
        {
          title: "Tie-Break Audited",
          detail:
            typeof winningMargin === "number"
              ? `Winning margin was ${formatScore(winningMargin)} points after tie-break checks.`
              : "Tie-break validation is complete.",
        },
        {
          title: "Scoring Window Closed",
          detail: "No further submissions or score changes are accepted for this season.",
        },
        {
          title: "Season Ledger Sealed",
          detail: "All outcomes, bonuses, and validations are archived for record.",
        },
      ]
    : isFinaleMode
    ? [
        {
          title: "Lock Finale Dossier",
          detail:
            leaguePulse.pendingSubmissions && leaguePulse.pendingSubmissions > 0
              ? "Finale entries are arriving now. Counter before lock."
              : "Submit banished + murdered calls with all finale outcome predictions before lock.",
        },
        {
          title: "Finale Broadcast Window",
          detail: "Each reveal can reprice the board under weighted finale scoring.",
        },
        {
          title: "Operations Certifies Finale",
          detail: "Finale outcomes and final pot value are entered into the official ledger.",
        },
        {
          title: "Crown Confirmed",
          detail: "Tie-break resolves by closest final pot estimate, then standings seal.",
        },
      ]
    : [
        {
          title: "Secure Weekly Picks",
          detail:
            leaguePulse.pendingSubmissions && leaguePulse.pendingSubmissions > 0
              ? "Entries are already coming in. Counter before lock."
              : "Set banished + murdered calls before episode outcomes land.",
        },
        {
          title: "Episode Night Volatility",
          detail: "One reveal can shift multiple positions across the board.",
        },
        {
          title: "Operations Certifies Outcomes",
          detail: "Weekly outcomes are entered and bonuses resolve under the scoring rules.",
        },
        {
          title: "Leaderboard Reprices",
          detail: "One precise call can move you past several rivals in one week.",
        },
      ];

  return (
    <motion.div
      className={`space-y-4 md:space-y-5 ${isPremiumUi ? "premium-page premium-welcome" : ""} ${
        isFinaleMode ? "premium-welcome-finale" : ""
      }`}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={pageRevealVariants}
    >
      {isFinaleMode && (
        <motion.section className="premium-overview-finale-alert" variants={cardRevealVariants}>
          <div className="premium-overview-finale-alert-inner">
            <p className="premium-overview-finale-alert-kicker">
              {isSeasonFinalized ? "Final Results" : "Finale Window"}
            </p>
            <h2 className="premium-overview-finale-alert-title">
              {isSeasonFinalized ? `Winner: ${winner?.name || "TBD"}` : `${lockLabel} Is Active`}
            </h2>
            <p className="premium-overview-finale-alert-sub">
              {isSeasonFinalized
                ? "Final standings are locked. Full podium is listed below."
                : "Weighted scoring is active. Tie-break protocol is armed. One episode closes the season."}
            </p>
          </div>
          <div className="premium-overview-finale-ticker" aria-hidden="true">
            <span>
              {isSeasonFinalized
                ? "Final Results Locked • Scoring Closed • Season Complete •"
                : "Finale Operations Live • Lock Picks • High Stakes •"}
            </span>
            <span>
              {isSeasonFinalized
                ? "Final Results Locked • Scoring Closed • Season Complete •"
                : "Finale Operations Live • Lock Picks • High Stakes •"}
            </span>
          </div>
        </motion.section>
      )}

      {seasons.length > 0 && (
        <motion.section variants={cardRevealVariants}>
          <PremiumCard className="premium-panel-pad-compact">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <p className="premium-meta-line">Active season</p>
              <select
                value={activeSeasonId || ""}
                onChange={(event) => onSeasonChange?.(event.target.value)}
                className="premium-field premium-input-compact max-w-sm"
              >
                {seasons.map((season) => (
                  <option key={season.seasonId} value={season.seasonId}>
                    {season.label} {season.status === "archived" ? "(Archived)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </PremiumCard>
        </motion.section>
      )}

      <motion.section className="premium-overview-grid" variants={sectionStaggerVariants}>
        <motion.div className="space-y-3" variants={cardRevealVariants}>
          <motion.div variants={cardRevealVariants} whileHover={cardHover}>
            <PremiumCard
              className={`premium-panel-pad premium-stack-md premium-overview-hero ${
                isFinaleMode ? "premium-overview-hero-finale" : ""
              }`}
            >
              <div className="premium-overview-hero-inner">
                <div className="premium-overview-hero-copy space-y-4">
                  <p className="premium-kicker">
                    {showConfig?.showName || "Traitors Fantasy Draft"} | Private Estate League
                  </p>
                  <h2
                    className={`premium-overview-title ${
                      isFinaleMode ? "premium-overview-title-finale" : ""
                    }`}
                  >
                    {isSeasonFinalized
                      ? "SEASON COMPLETE"
                      : isFinaleMode
                      ? "FINALE PROTOCOL IS ACTIVE"
                      : "CONTROL THE ESTATE. COMMAND THE BOARD."}
                  </h2>
                  <p
                    className={`premium-overview-copy ${
                      isFinaleMode ? "premium-overview-copy-finale" : ""
                    }`}
                  >
                    {isSeasonFinalized
                      ? "The board is finalized. Review the final standings and complete ledger below."
                      : isFinaleMode
                      ? "Finale dossier submissions are open. Lock every call before the estate seals."
                      : "Track betrayals, forecast outcomes, and outmaneuver the room with disciplined weekly calls."}
                  </p>

                  <div className="premium-overview-hero-actions flex-col gap-2">
                    {isSeasonFinalized ? (
                      <div
                        className={`premium-btn premium-overview-lockbar ${
                          isFinaleMode ? "premium-overview-lockbar-finale" : ""
                        }`}
                        role="status"
                        aria-live="polite"
                      >
                        <span className="premium-overview-lockbar-label">Results Certified</span>
                        <span className="premium-meta-line">
                          No further submissions or score updates this season.
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`premium-btn premium-overview-lockbar ${
                          isFinaleMode ? "premium-overview-lockbar-finale" : ""
                        }`}
                        role="status"
                        aria-live="polite"
                      >
                        <span className="premium-overview-lockbar-label">
                          {isFinaleMode ? lockLabel : "Picks Lock In"}
                        </span>
                        <CountdownTimer targetDate={countdownTarget} />
                      </div>
                    )}
                    <PremiumButton
                      variant="primary"
                      onClick={onStart}
                      className={`px-5 text-xs md:text-sm premium-overview-cta ${
                        isFinaleMode ? "premium-overview-cta-finale" : ""
                      }`}
                    >
                      {isSeasonFinalized ? "View Final Standings" : "Enter Weekly Picks"}
                    </PremiumButton>
                  </div>
                </div>

                {isFinaleMode && !isSeasonFinalized && !reduceMotion && (
                  <div className="premium-overview-finale-confetti" aria-hidden="true">
                    {Array.from({ length: FINALE_OVERVIEW_CONFETTI_COUNT }).map((_, idx) => (
                      <span
                        key={`overview-finale-confetti-${idx}`}
                        className="premium-overview-finale-confetti-piece"
                        style={
                          {
                            "--overview-piece-left": `${3 + ((idx * 83) % 92)}%`,
                            "--overview-piece-delay": `${(idx % 8) * 0.18}s`,
                            "--overview-piece-duration": `${3.3 + (idx % 6) * 0.26}s`,
                            "--overview-piece-hue": `${(idx * 41) % 360}`,
                          } as React.CSSProperties
                        }
                      />
                    ))}
                  </div>
                )}

                {!isSeasonFinalized && (
                  <article className="premium-overview-rival-card premium-overview-rival-card-inline relative pt-11">
                    <div className="premium-section-topline absolute -top-3 left-4 z-20 rounded-full bg-black/70 px-3 py-1 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                      <p className="premium-kicker">Live Rival Intel</p>
                      <PremiumStatusBadge tone="accent">Live Feed</PremiumStatusBadge>
                    </div>
                    <div className="premium-overview-rival-grid mt-1">
                      <div className="premium-overview-rival-slot">
                        <div className="mb-2 inline-flex rounded-full bg-black/55 px-2 py-0.5 backdrop-blur-sm">
                          <p className="premium-overview-rival-label">Table Leader</p>
                        </div>
                        <p className="premium-overview-rival-name mt-1">{mvp?.name || "Race open"}</p>
                        <p className="premium-overview-rival-score mt-1">{overallLeaderScore}</p>
                      </div>
                      <div className="premium-overview-rival-slot premium-overview-rival-slot-accent">
                        <div className="mb-2 inline-flex rounded-full bg-black/55 px-2 py-0.5 backdrop-blur-sm">
                          <p className="premium-overview-rival-label">Momentum Leader</p>
                        </div>
                        <p className="premium-overview-rival-name mt-1">
                          {weeklyMvp?.name || "No momentum spike yet"}
                        </p>
                        <p
                          className={`premium-overview-rival-score mt-1 ${
                            weeklySurgeMomentum ? weeklySurgeMomentum.className : ""
                          }`}
                        >
                          {weeklyMvp
                            ? `${weeklySurgeMomentum?.icon ? `${weeklySurgeMomentum.icon} ` : ""}${formatDelta(
                                weeklyMvp.score
                              )}`
                            : "No score yet"}
                        </p>
                      </div>
                    </div>
                  </article>
                )}

                <div className="premium-overview-chip-grid premium-overview-chip-grid-hero">
                  {summaryCards.map((item) => (
                    <motion.article
                      key={item.label}
                      className="premium-overview-chip"
                      variants={cardRevealVariants}
                      whileHover={cardHover}
                    >
                      <p className="premium-overview-chip-label">{item.label}</p>
                      <p className="premium-overview-chip-value">{item.value}</p>
                      <p
                        className={`premium-overview-chip-hint !text-gray-400 ${
                          item.label === "Ballots Pending" ? "italic" : ""
                        }`}
                      >
                        {item.hint}
                      </p>
                    </motion.article>
                  ))}
                </div>
              </div>
            </PremiumCard>
          </motion.div>

          <motion.div variants={cardRevealVariants} whileHover={cardHover}>
            <PremiumCard className="premium-panel-pad premium-stack-sm">
              <div className="premium-section-topline">
                <h3 className="premium-section-title">Operations Runbook</h3>
                <PremiumStatusBadge>How Scoring Resolves</PremiumStatusBadge>
              </div>
              <div className="premium-overview-stage-list mt-3">
                {gameLoop.map((step, index) => (
                  <motion.article
                    key={step.title}
                    className="premium-overview-stage-item"
                    variants={cardRevealVariants}
                    whileHover={cardHover}
                  >
                    <span className="premium-overview-stage-index">{index + 1}</span>
                    <div>
                      <p className="premium-row-title">{step.title}</p>
                      <p className="premium-meta-line">{step.detail}</p>
                    </div>
                  </motion.article>
                ))}
              </div>
            </PremiumCard>
          </motion.div>

          <motion.div variants={cardRevealVariants} whileHover={cardHover}>
            <PremiumCard className="premium-panel-pad premium-stack-sm">
              <section className="premium-subpanel">
                <div className="premium-section-topline">
                  <h3 className="premium-section-title">Rival Movements</h3>
                  <PremiumStatusBadge tone="accent">Table Dynamics</PremiumStatusBadge>
                </div>

                {topMovers.length === 0 ? (
                  <p className="premium-meta-line mt-4">
                    Movement appears after at least two certified weekly archives.
                  </p>
                ) : (
                  <div className="premium-divider-list mt-3">
                    {topMovers.map((mover, index) => {
                      const moverMomentum = getMomentumDisplay(mover.delta);
                      return (
                        <motion.article
                          key={`${mover.name}-${index}`}
                          className="premium-row-item premium-row-item-plain"
                          variants={cardRevealVariants}
                          whileHover={cardHover}
                        >
                          <div>
                            <p className="premium-row-title">{mover.name}</p>
                            <p className="premium-meta-line">
                              {mover.league === "jr" ? "Jr League" : "Main League"}
                            </p>
                          </div>
                          <p className={`premium-row-value ${moverMomentum.className}`}>
                            {moverMomentum.icon ? `${moverMomentum.icon} ` : ""}
                            {formatDelta(mover.delta)}
                          </p>
                        </motion.article>
                      );
                    })}
                  </div>
                )}
              </section>
            </PremiumCard>
          </motion.div>
        </motion.div>

        <motion.aside className="space-y-3 premium-overview-right" variants={cardRevealVariants}>
          <motion.div variants={cardRevealVariants} whileHover={cardHover}>
            <PremiumCard className="premium-panel-pad premium-stack-sm">
              <div className="premium-section-topline">
                <h3 className="premium-section-title">Next Strategic Moves</h3>
                <PremiumStatusBadge>
                  {isSeasonFinalized ? "Season Closed" : "Before Lock"}
                </PremiumStatusBadge>
              </div>

              <ol className="premium-action-list mt-3">
                {actionQueue.map((item, index) => (
                  <motion.li
                    key={`${item}-${index}`}
                    className="premium-action-item"
                    variants={cardRevealVariants}
                    whileHover={cardHover}
                  >
                    <span className="premium-action-index">{index + 1}</span>
                    <span>{item}</span>
                  </motion.li>
                ))}
              </ol>
            </PremiumCard>
          </motion.div>

          <motion.div variants={cardRevealVariants} whileHover={cardHover}>
            <PremiumCard className="premium-panel-pad premium-stack-sm">
              <div className="premium-section-topline mb-3">
                <h3 className="premium-section-title">
                  {isSeasonFinalized ? "Final Podium" : "Front-Runners"}
                </h3>
                <PremiumStatusBadge tone="positive">
                  {isSeasonFinalized ? "Certified" : "Live Board"}
                </PremiumStatusBadge>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {isSeasonFinalized ? (
                  <>
                    <LeaderMiniCard
                      title="Winner"
                      player={
                        winner
                          ? { name: winner.name, score: winner.score, label: "1st Place" }
                          : null
                      }
                    />
                    <LeaderMiniCard
                      title="Runner-Up"
                      player={
                        runnerUp
                          ? { name: runnerUp.name, score: runnerUp.score, label: "2nd Place" }
                          : null
                      }
                    />
                    <LeaderMiniCard
                      title="Third Place"
                      player={
                        thirdPlace
                          ? { name: thirdPlace.name, score: thirdPlace.score, label: "3rd Place" }
                          : null
                      }
                    />
                  </>
                ) : (
                  <>
                    <LeaderMiniCard title="Overall" player={mvp} />
                    <LeaderMiniCard title="Latest Weekly" player={weeklyMvp} tone="accent" />
                  </>
                )}
              </div>
            </PremiumCard>
          </motion.div>
        </motion.aside>
      </motion.section>
    </motion.div>
  );
};

export default Welcome;
