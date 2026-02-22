import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CAST_NAMES, COUNCIL_LABELS, GameState, PlayerEntry, UiVariant, WeeklyScoreSnapshot } from "../types";
import { getCastPortraitSrc } from "../src/castPortraits";
import { calculatePlayerScore, formatScore } from "../src/utils/scoring";
import { LIMITS, TIMING } from "../src/utils/scoringConstants";
import {
  pageRevealVariants,
  sectionStaggerVariants,
} from "../src/ui/motion";
import {
  PremiumCard,
  type PremiumKpiItem,
  PremiumKpiRow,
  PremiumPanelHeader,
  PremiumRankRow,
  PremiumRankTable,
  PremiumStatusBadge,
} from "../src/ui/premium";

interface LeaderboardProps {
  gameState: GameState;
  uiVariant: UiVariant;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ gameState, uiVariant }) => {
  const reduceMotion = useReducedMotion();
  const isPremiumUi = uiVariant === "premium";
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setIsSyncing(true);
    const timer = setTimeout(() => setIsSyncing(false), TIMING.SYNC_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [gameState]);

  const scoreHistory: WeeklyScoreSnapshot[] = Array.isArray(gameState.weeklyScoreHistory)
    ? gameState.weeklyScoreHistory
    : [];

  const hasActiveWeeklyResults = useMemo(() => {
    const weekly = gameState.weeklyResults;
    return Boolean(
      weekly?.nextBanished ||
        weekly?.nextMurdered ||
        weekly?.bonusGames?.redemptionRoulette ||
        weekly?.bonusGames?.shieldGambit ||
        weekly?.bonusGames?.traitorTrio?.length
    );
  }, [gameState.weeklyResults]);

  const latestSnapshotTotals = scoreHistory[scoreHistory.length - 1]?.totals ?? {};

  const scoredPlayers = gameState.players
    .map((player) => ({
      ...player,
      scoring: calculatePlayerScore(gameState, player),
    }))
    .sort((a, b) => {
      const aArchived = latestSnapshotTotals[a.id];
      const bArchived = latestSnapshotTotals[b.id];
      const aTotal = !hasActiveWeeklyResults && typeof aArchived === "number" ? aArchived : a.scoring.total;
      const bTotal = !hasActiveWeeklyResults && typeof bArchived === "number" ? bArchived : b.scoring.total;
      return bTotal - aTotal;
    });

  const weeklyDeltaById = useMemo(() => {
    if (scoreHistory.length < 2) return {};
    const last = scoreHistory[scoreHistory.length - 1]?.totals ?? {};
    const prev = scoreHistory[scoreHistory.length - 2]?.totals ?? {};
    const delta: Record<string, number> = {};

    Object.keys(last).forEach((id) => {
      if (typeof last[id] !== "number" || typeof prev[id] !== "number") return;
      delta[id] = Number(last[id]) - Number(prev[id]);
    });

    return delta;
  }, [scoreHistory]);

  const getHistoryLabel = (snapshot: WeeklyScoreSnapshot) =>
    snapshot.label?.trim() || new Date(snapshot.createdAt).toLocaleDateString();

  const getPlayerTimeline = (playerId: string) =>
    scoreHistory
      .map((snapshot) => ({
        label: getHistoryLabel(snapshot),
        total: snapshot.totals?.[playerId],
      }))
      .filter((entry) => typeof entry.total === "number");

  const getPenaltyEntries = (player: PlayerEntry) => {
    const penalties: Array<{
      label: string;
      points: number;
      pick?: string;
      actual?: string;
      note?: string;
    }> = [];

    const weeklyResults = gameState.weeklyResults;
    const weeklyPredictions = player.weeklyPredictions;
    const weeklyMultiplier = weeklyPredictions?.bonusGames?.doubleOrNothing ? 2 : 1;
    const weeklyIncorrectPoints = 0.5 * weeklyMultiplier;

    if (player.predWinner && gameState.castStatus[player.predWinner]?.isFirstOut) {
      penalties.push({
        label: "Prophecy Reversed",
        points: -2,
        pick: player.predWinner,
        note: "Winner pick was first out",
      });
    }

    if (
      weeklyResults?.nextBanished &&
      weeklyPredictions?.nextBanished &&
      weeklyResults.nextBanished !== weeklyPredictions.nextBanished
    ) {
      penalties.push({
        label: `${COUNCIL_LABELS.weekly}: Banished`,
        points: -weeklyIncorrectPoints,
        pick: weeklyPredictions.nextBanished,
        actual: weeklyResults.nextBanished,
      });
    }

    if (
      weeklyResults?.nextMurdered &&
      weeklyPredictions?.nextMurdered &&
      weeklyResults.nextMurdered !== "No Murder" &&
      weeklyResults.nextMurdered !== weeklyPredictions.nextMurdered
    ) {
      penalties.push({
        label: `${COUNCIL_LABELS.weekly}: Murdered`,
        points: -weeklyIncorrectPoints,
        pick: weeklyPredictions.nextMurdered,
        actual: weeklyResults.nextMurdered,
      });
    }

    if (
      weeklyResults?.bonusGames?.redemptionRoulette &&
      weeklyPredictions?.bonusGames?.redemptionRoulette &&
      weeklyResults.bonusGames.redemptionRoulette !== weeklyPredictions.bonusGames.redemptionRoulette
    ) {
      penalties.push({
        label: "Bonus: Redemption Roulette",
        points: -1,
        pick: weeklyPredictions.bonusGames.redemptionRoulette,
        actual: weeklyResults.bonusGames.redemptionRoulette,
      });
    }

    return penalties;
  };

  const topPlayer = scoredPlayers[0];
  const topScore =
    topPlayer && !hasActiveWeeklyResults && typeof latestSnapshotTotals[topPlayer.id] === "number"
      ? latestSnapshotTotals[topPlayer.id]
      : topPlayer?.scoring.total;

  const averageScore = scoredPlayers.length
    ? scoredPlayers.reduce((sum, player) => sum + player.scoring.total, 0) / scoredPlayers.length
    : 0;

  const latestArchive = scoreHistory.length > 0 ? getHistoryLabel(scoreHistory[scoreHistory.length - 1]) : "None";

  const kpiItems: PremiumKpiItem[] = [
    { label: "Players", value: String(scoredPlayers.length), hint: "Across all leagues" },
    { label: "Avg Score", value: formatScore(averageScore), hint: "Current total" },
    { label: "Latest Archive", value: latestArchive, hint: "Most recent snapshot" },
    {
      label: "Active Cast",
      value: String(CAST_NAMES.filter((name) => !gameState.castStatus[name]?.isEliminated).length),
      hint: "Available status board",
    },
  ];

  return (
    <motion.div
      className={`space-y-4 md:space-y-5 ${isPremiumUi ? "premium-page premium-leaderboard" : ""}`}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={pageRevealVariants}
    >
      <motion.section variants={sectionStaggerVariants}>
        <PremiumCard className={`premium-panel-pad premium-stack-md premium-leader-summary ${isSyncing ? "panel-sync" : ""}`}>
          <PremiumPanelHeader
            kicker="Leaderboard"
            title="Rank Table"
            description="Transparent totals, penalties, and movement across archived rounds."
            rightSlot={<PremiumStatusBadge tone="accent">Live Sync</PremiumStatusBadge>}
          />
          <PremiumKpiRow items={kpiItems} />
          {topPlayer ? (
            <div className="premium-top-leader-strip">
              <div>
                <p className="premium-kicker">Current Leader</p>
                <p className="premium-top-leader-name">{topPlayer.name}</p>
              </div>
              <p className="premium-top-leader-score">{formatScore(topScore as number)}</p>
            </div>
          ) : (
            <PremiumStatusBadge>No entries yet</PremiumStatusBadge>
          )}
        </PremiumCard>
      </motion.section>

      <motion.section variants={sectionStaggerVariants}>
        <PremiumCard className="premium-panel-pad-compact premium-rank-surface">
          <PremiumRankTable
            headers={[
              { id: "rank", label: "Rank" },
              { id: "player", label: "Player" },
              { id: "score", label: "Total", align: "right" },
            ]}
          >
            {scoredPlayers.map((player, index) => {
              const penalties = getPenaltyEntries(player);
              const isExpanded = expandedPlayerId === player.id;
              const total =
                !hasActiveWeeklyResults && typeof latestSnapshotTotals[player.id] === "number"
                  ? latestSnapshotTotals[player.id]
                  : player.scoring.total;

              return (
                <PremiumRankRow key={player.id} expanded={isExpanded} className="premium-rank-row-shell">
                  <button
                    type="button"
                    onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                    className="premium-rank-row-button"
                    aria-expanded={isExpanded}
                  >
                    <div className="premium-rank-cell premium-rank-cell-rank">#{index + 1}</div>
                    <div className="premium-rank-cell premium-rank-cell-player">
                      <div className="avatar-ring premium-avatar-xs rounded-full overflow-hidden bg-black/30 flex-shrink-0">
                        {player.portraitUrl ? (
                          <img src={player.portraitUrl} alt={player.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs font-bold text-[color:var(--text-muted)]">
                            {player.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="premium-row-title truncate">{player.name}</p>
                        <p className="premium-meta-line uppercase">{player.league === "jr" ? COUNCIL_LABELS.jr : "Main League"}</p>
                      </div>
                    </div>
                    <div className="premium-rank-cell premium-rank-cell-score">
                      <p className="premium-rank-total">{formatScore(total)}</p>
                      {weeklyDeltaById[player.id] !== undefined && (
                        <p className={weeklyDeltaById[player.id] >= 0 ? "premium-value-positive" : "premium-value-negative"}>
                          {weeklyDeltaById[player.id] >= 0 ? "+" : ""}
                          {formatScore(weeklyDeltaById[player.id])}
                        </p>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="premium-rank-expanded">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="premium-subpanel">
                          <p className="premium-kicker mb-2">Achievements</p>
                          {player.scoring.achievements.length > 0 ? (
                            <div className="space-y-2">
                              {player.scoring.achievements.map((achievement, idx) => {
                                const castPortrait = getCastPortraitSrc(
                                  achievement.member,
                                  gameState.castStatus[achievement.member]?.portraitUrl
                                );
                                return (
                                  <div key={`${player.id}-ach-${idx}`} className="premium-row-item premium-row-item-plain">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="avatar-ring h-7 w-7 rounded-full overflow-hidden bg-black/30 flex-shrink-0">
                                        {castPortrait ? (
                                          <img src={castPortrait} alt={achievement.member} className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="h-full w-full flex items-center justify-center text-xs text-[color:var(--text-muted)]">
                                            {achievement.member.charAt(0)}
                                          </div>
                                        )}
                                      </div>
                                      <p className="premium-row-title truncate">
                                        {achievement.icon} {achievement.member}
                                      </p>
                                    </div>
                                    <p className="premium-meta-line">{achievement.type}</p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="premium-meta-line">No achievements recorded yet.</p>
                          )}
                        </div>

                        <div className="premium-subpanel">
                          <p className="premium-kicker mb-2">Penalties</p>
                          {penalties.length > 0 ? (
                            <div className="space-y-2">
                              {penalties.map((penalty, idx) => (
                              <div key={`${player.id}-penalty-${idx}`} className="premium-row-item premium-row-item-danger premium-row-item-plain">
                                  <div>
                                    <p className="premium-row-title">{penalty.label}</p>
                                    {penalty.pick && <p className="premium-meta-line">Pick: {penalty.pick}</p>}
                                    {penalty.actual && <p className="premium-meta-line">Result: {penalty.actual}</p>}
                                    {penalty.note && <p className="premium-meta-line">{penalty.note}</p>}
                                  </div>
                                  <p className="premium-value-negative">{formatScore(penalty.points)}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="premium-meta-line">No penalties recorded.</p>
                          )}
                        </div>
                      </div>

                      <div className="premium-subpanel mt-3">
                        <p className="premium-kicker mb-2">Weekly Timeline</p>
                        {scoreHistory.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {getPlayerTimeline(player.id)
                              .slice(-LIMITS.PLAYER_TIMELINE_DISPLAY)
                              .map((entry, idx) => (
                                <div key={`${player.id}-timeline-${idx}`} className="premium-row-item premium-row-item-plain">
                                  <div>
                                    <p className="premium-meta-line uppercase">{entry.label}</p>
                                    <p className="premium-row-title">{formatScore(entry.total as number)}</p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="premium-meta-line">Timeline appears after first weekly archive.</p>
                        )}
                      </div>
                    </div>
                  )}
                </PremiumRankRow>
              );
            })}
          </PremiumRankTable>
        </PremiumCard>
      </motion.section>

      <motion.section variants={sectionStaggerVariants}>
        <PremiumCard className="premium-panel-pad-compact premium-stack-sm">
          <div className="premium-section-topline mb-3">
            <h3 className="premium-section-title">Cast Status Board</h3>
            <PremiumStatusBadge>{CAST_NAMES.length} cast members</PremiumStatusBadge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
            {CAST_NAMES.map((name) => {
              const status = gameState.castStatus[name];
              const portraitSrc = getCastPortraitSrc(name, status?.portraitUrl);

              const tag = status?.isWinner
                ? "Winner"
                : status?.isFirstOut
                ? "1st Out"
                : status?.isEliminated
                ? "Out"
                : status?.isTraitor
                ? "Traitor"
                : "In";

              const tone = status?.isWinner
                ? "premium-status premium-status-positive"
                : status?.isFirstOut
                ? "premium-status premium-status-warning"
                : status?.isEliminated
                ? "premium-status premium-status-negative"
                : status?.isTraitor
                ? "premium-status premium-status-accent"
                : "premium-status";

              return (
                <article key={name} className="premium-cast-card premium-cast-card-compact">
                  <div className="premium-cast-row">
                    <div className="premium-cast-main">
                      <div className="h-6 w-6 rounded-full overflow-hidden bg-black/35 flex-shrink-0">
                        {portraitSrc ? (
                          <img src={portraitSrc} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[9px] font-bold text-[color:var(--text-muted)]">
                            {name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <p className="premium-cast-name">{name}</p>
                    </div>
                    <span className={`${tone} premium-cast-status`}>{tag}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </PremiumCard>
      </motion.section>
    </motion.div>
  );
};

export default Leaderboard;
