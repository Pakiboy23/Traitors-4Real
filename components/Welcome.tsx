import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { UiVariant } from "../types";
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

interface WelcomeProps {
  onStart: () => void;
  mvp?: MvpHighlight | null;
  weeklyMvp?: MvpHighlight | null;
  leaguePulse: LeaguePulseOverview;
  topMovers: TopMoverEntry[];
  actionQueue: string[];
  uiVariant: UiVariant;
}

const formatDelta = (value: number) => {
  const formatted = formatScore(value);
  return value > 0 ? `+${formatted}` : formatted;
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
        <p className="premium-meta-line">No score data yet.</p>
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
  uiVariant,
}) => {
  const reduceMotion = useReducedMotion();
  const isPremiumUi = uiVariant === "premium";
  const cardHover = reduceMotion ? undefined : { y: -4, scale: 1.004 };

  const activityText =
    leaguePulse.pendingSubmissions === null
      ? "Private activity"
      : leaguePulse.pendingSubmissions > 0
      ? `${leaguePulse.pendingSubmissions} new weekly vote${
          leaguePulse.pendingSubmissions === 1 ? "" : "s"
        }`
      : "No new votes yet";

  const summaryCards = [
    {
      label: "Friends Playing",
      value: String(leaguePulse.entries),
      hint: "League entries",
    },
    {
      label: "Cast In Play",
      value: String(leaguePulse.activeCastCount),
      hint: "Still active",
    },
    {
      label: "Latest Snapshot",
      value: leaguePulse.latestArchiveLabel,
      hint: "Most recent archive",
    },
    {
      label: "Weekly Activity",
      value:
        leaguePulse.pendingSubmissions === null
          ? "Private"
          : String(leaguePulse.pendingSubmissions),
      hint: "Fresh submissions",
    },
  ];

  const overallLeaderScore = mvp ? formatScore(mvp.score) : "No score yet";
  const weeklyLeaderScore = weeklyMvp ? formatDelta(weeklyMvp.score) : "No score yet";

  const gameLoop = [
    {
      title: "Lock Picks",
      detail:
        leaguePulse.pendingSubmissions && leaguePulse.pendingSubmissions > 0
          ? "Friends are already submitting this week. Counter before lock."
          : "Set your banished + murdered calls before episode results hit.",
    },
    {
      title: "Watch Episode Night",
      detail: "After each episode airs, the board can swing hard in one reveal.",
    },
    {
      title: "Admin Logs Results",
      detail: "Weekly outcomes are entered and bonuses resolve across the league.",
    },
    {
      title: "Leaderboard Flips",
      detail: "One clean call can jump you past multiple friends in a single week.",
    },
  ];

  return (
    <motion.div
      className={`space-y-4 md:space-y-5 ${isPremiumUi ? "premium-page premium-welcome" : ""}`}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={pageRevealVariants}
    >
      <motion.section className="premium-overview-grid" variants={sectionStaggerVariants}>
        <motion.div className="space-y-3" variants={cardRevealVariants}>
          <motion.div variants={cardRevealVariants} whileHover={cardHover}>
            <PremiumCard className="premium-panel-pad premium-stack-md premium-overview-hero">
              <div className="premium-overview-hero-inner">
                <div className="premium-overview-hero-copy space-y-4">
                  <p className="premium-kicker">The Traitors: Friends Draft League</p>
                  <h2 className="premium-overview-title">
                    Outdraft your friends. Own the Round Table.
                  </h2>
                  <p className="premium-overview-copy">
                    Pick who survives, call each weekly vote, and chase the top spot before the
                    next betrayal flips the leaderboard.
                  </p>

                  <div className="premium-overview-hero-actions">
                    <PremiumButton
                      variant="primary"
                      onClick={onStart}
                      className="px-5 text-xs md:text-sm premium-overview-cta"
                    >
                      Lock Weekly Picks
                    </PremiumButton>
                    <div className="premium-overview-live-wrap">
                      <span className="premium-overview-live-dot" aria-hidden="true" />
                      <PremiumStatusBadge tone="accent">{activityText}</PremiumStatusBadge>
                    </div>
                  </div>
                </div>

                <article className="premium-overview-rival-card premium-overview-rival-card-inline">
                  <div className="premium-section-topline">
                    <p className="premium-kicker">Live Rivalry Pulse</p>
                    <PremiumStatusBadge tone="accent">Game Night</PremiumStatusBadge>
                  </div>
                  <div className="premium-overview-rival-grid">
                    <div className="premium-overview-rival-slot">
                      <p className="premium-overview-rival-label">Season Leader</p>
                      <p className="premium-overview-rival-name">{mvp?.name || "Open race"}</p>
                      <p className="premium-overview-rival-score">{overallLeaderScore}</p>
                    </div>
                    <div className="premium-overview-rival-slot premium-overview-rival-slot-accent">
                      <p className="premium-overview-rival-label">Weekly Surge</p>
                      <p className="premium-overview-rival-name">{weeklyMvp?.name || "No weekly jump yet"}</p>
                      <p className="premium-overview-rival-score">{weeklyLeaderScore}</p>
                    </div>
                  </div>
                </article>

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
                      <p className="premium-overview-chip-hint">{item.hint}</p>
                    </motion.article>
                  ))}
                </div>
              </div>
            </PremiumCard>
          </motion.div>

          <motion.div variants={cardRevealVariants} whileHover={cardHover}>
            <PremiumCard className="premium-panel-pad premium-stack-sm">
              <div className="premium-section-topline">
                <h3 className="premium-section-title">This Week&apos;s Game Loop</h3>
                <PremiumStatusBadge>How It Works</PremiumStatusBadge>
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
                  <h3 className="premium-section-title">Power Shifts</h3>
                  <PremiumStatusBadge tone="accent">Friend Rivalries</PremiumStatusBadge>
                </div>

                {topMovers.length === 0 ? (
                  <p className="premium-meta-line mt-4">
                    Rival movement appears after at least two weekly archives.
                  </p>
                ) : (
                  <div className="premium-divider-list mt-3">
                    {topMovers.map((mover, index) => (
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
                        <p
                          className={`premium-row-value ${
                            mover.delta >= 0 ? "premium-value-positive" : "premium-value-negative"
                          }`}
                        >
                          {formatDelta(mover.delta)}
                        </p>
                      </motion.article>
                    ))}
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
                <h3 className="premium-section-title">Your Next Moves</h3>
                <PremiumStatusBadge>Before Next Episode</PremiumStatusBadge>
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
                <h3 className="premium-section-title">Season Front-Runners</h3>
                <PremiumStatusBadge tone="positive">Live</PremiumStatusBadge>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <LeaderMiniCard title="Overall" player={mvp} />
                <LeaderMiniCard title="Latest Weekly" player={weeklyMvp} tone="accent" />
              </div>
            </PremiumCard>
          </motion.div>
        </motion.aside>
      </motion.section>
    </motion.div>
  );
};

export default Welcome;
