import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  COUNCIL_LABELS,
  GameState,
  normalizeWeekId,
  PlayerEntry,
  SeasonConfig,
  UiVariant,
  WeeklyScoreSnapshot,
} from "../types";
import { getCastPortraitSrc } from "../src/castPortraits";
import {
  calculatePlayerScore,
  formatScore,
  getFinaleTieBreakDistance,
  resolveEffectiveWeeklyPredictionWeekId,
} from "../src/utils/scoring";
import { TIMING } from "../src/utils/scoringConstants";
import {
  pageRevealVariants,
  sectionStaggerVariants,
} from "../src/ui/motion";
import {
  PremiumCard,
  type PremiumKpiItem,
  PremiumKpiRow,
  PremiumPanelHeader,
  PremiumStatusBadge,
} from "../src/ui/premium";

interface LeaderboardProps {
  gameState: GameState;
  uiVariant: UiVariant;
  seasons?: SeasonConfig[];
  activeSeasonId?: string | null;
  onSeasonChange?: (seasonId: string) => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
  gameState,
  uiVariant,
  seasons = [],
  activeSeasonId,
  onSeasonChange,
}) => {
  const reduceMotion = useReducedMotion();
  const isPremiumUi = uiVariant === "premium";
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setIsSyncing(true);
    const timer = setTimeout(() => setIsSyncing(false), TIMING.SYNC_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [gameState]);

  const scoreHistory: WeeklyScoreSnapshot[] = Array.isArray(gameState.weeklyScoreHistory)
    ? gameState.weeklyScoreHistory
    : [];
  const castNames = useMemo(
    () => Object.keys(gameState.castStatus || {}).sort((a, b) => a.localeCompare(b)),
    [gameState.castStatus]
  );
  const latestSnapshot = scoreHistory[scoreHistory.length - 1];
  const latestSnapshotTotals = latestSnapshot?.totals ?? {};

  const hasActiveWeeklyResults = useMemo(() => {
    const weekly = gameState.weeklyResults;
    return Boolean(
      weekly?.nextBanished ||
        weekly?.nextMurdered ||
        weekly?.bonusGames?.redemptionRoulette ||
        weekly?.bonusGames?.shieldGambit ||
        weekly?.bonusGames?.traitorTrio?.length ||
        weekly?.finaleResults?.finalWinner ||
        weekly?.finaleResults?.lastFaithfulStanding ||
        weekly?.finaleResults?.lastTraitorStanding ||
        typeof weekly?.finaleResults?.finalPotValue === "number"
    );
  }, [gameState.weeklyResults]);

  const detailWeeklyResults =
    !hasActiveWeeklyResults && latestSnapshot?.weeklyResults
      ? latestSnapshot.weeklyResults
      : gameState.weeklyResults;
  const detailActiveWeekId =
    normalizeWeekId(detailWeeklyResults?.weekId) ??
    normalizeWeekId(gameState.activeWeekId) ??
    gameState.activeWeekId;
  const detailGameState = useMemo(
    () => ({
      ...gameState,
      activeWeekId: detailActiveWeekId,
      weeklyResults: detailWeeklyResults,
    }),
    [detailActiveWeekId, detailWeeklyResults, gameState]
  );
  const effectiveFinalePotValue =
    typeof detailWeeklyResults?.finaleResults?.finalPotValue === "number" &&
    Number.isFinite(detailWeeklyResults.finaleResults.finalPotValue)
      ? detailWeeklyResults.finaleResults.finalPotValue
      : null;
  const isSeasonFinalized = Boolean(
    gameState.finaleConfig?.enabled &&
      detailWeeklyResults?.finaleResults?.finalWinner &&
      detailWeeklyResults?.finaleResults?.lastFaithfulStanding &&
      detailWeeklyResults?.finaleResults?.lastTraitorStanding
  );
  const isFinaleTieBreakActive =
    Boolean(gameState.finaleConfig?.enabled) &&
    typeof effectiveFinalePotValue === "number";

  const scoredPlayers = gameState.players
    .map((player) => {
      const scoring = calculatePlayerScore(gameState, player);
      const detailScoring = calculatePlayerScore(detailGameState, player);
      const archivedTotal = latestSnapshotTotals[player.id];
      const displayTotal =
        !hasActiveWeeklyResults && typeof archivedTotal === "number"
          ? archivedTotal
          : scoring.total;
      return {
        ...player,
        scoring,
        detailScoring,
        displayTotal,
      };
    })
    .sort((a, b) => {
      const aTotal = a.displayTotal;
      const bTotal = b.displayTotal;
      if (bTotal !== aTotal) return bTotal - aTotal;

      if (isFinaleTieBreakActive && typeof effectiveFinalePotValue === "number") {
        const aDistance = getFinaleTieBreakDistance(a, effectiveFinalePotValue);
        const bDistance = getFinaleTieBreakDistance(b, effectiveFinalePotValue);
        if (aDistance === null && bDistance !== null) return 1;
        if (aDistance !== null && bDistance === null) return -1;
        if (typeof aDistance === "number" && typeof bDistance === "number" && aDistance !== bDistance) {
          return aDistance - bDistance;
        }
      }

      return a.name.localeCompare(b.name);
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

  const getPenaltyEntries = (
    contextState: GameState,
    player: PlayerEntry,
    detailScoring: ReturnType<typeof calculatePlayerScore>
  ) => {
    const penalties: Array<{
      label: string;
      points: number;
      pick?: string;
      actual?: string;
      note?: string;
    }> = [];

    const weeklyResults = contextState.weeklyResults;
    const weeklyPredictions = player.weeklyPredictions;
    const currentWeekId =
      normalizeWeekId(contextState.activeWeekId) ??
      normalizeWeekId(weeklyResults?.weekId);
    const weeklyResultWeekId =
      normalizeWeekId(weeklyResults?.weekId) ?? currentWeekId;
    const weeklyPredictionWeekId = resolveEffectiveWeeklyPredictionWeekId(
      contextState,
      player,
      weeklyResultWeekId
    );
    const hasMatchingWeeklyWeek = Boolean(
      weeklyPredictionWeekId &&
        weeklyResultWeekId &&
        weeklyPredictionWeekId === weeklyResultWeekId
    );
    const isFinaleWeek = Boolean(contextState.finaleConfig?.enabled);
    const weeklyMultiplier = isFinaleWeek
      ? 1
      : weeklyPredictions?.bonusGames?.doubleOrNothing
      ? 2
      : 1;
    const weeklyIncorrectPoints = isFinaleWeek ? 1 : 0.5 * weeklyMultiplier;

    if (detailScoring.breakdown.penalty && player.predWinner) {
      penalties.push({
        label: "Forecast Reversal Penalty",
        points: -2,
        pick: player.predWinner,
        note: "Winner forecast was first out",
      });
    }

    const hasBanishedMiss = detailScoring.breakdown.weeklyCouncil.some(
      (entry) => entry.label === "Next Banished" && entry.result === "incorrect"
    );
    if (
      hasMatchingWeeklyWeek &&
      hasBanishedMiss &&
      weeklyResults?.nextBanished &&
      weeklyPredictions?.nextBanished
    ) {
      penalties.push({
        label: `${COUNCIL_LABELS.weekly}: Banished`,
        points: -weeklyIncorrectPoints,
        pick: weeklyPredictions.nextBanished,
        actual: weeklyResults.nextBanished,
      });
    }

    const hasMurderedMiss = detailScoring.breakdown.weeklyCouncil.some(
      (entry) => entry.label === "Next Murdered" && entry.result === "incorrect"
    );
    if (
      hasMatchingWeeklyWeek &&
      hasMurderedMiss &&
      weeklyResults?.nextMurdered &&
      weeklyPredictions?.nextMurdered &&
      weeklyResults.nextMurdered !== "No Murder"
    ) {
      penalties.push({
        label: `${COUNCIL_LABELS.weekly}: Murdered`,
        points: -weeklyIncorrectPoints,
        pick: weeklyPredictions.nextMurdered,
        actual: weeklyResults.nextMurdered,
      });
    }

    const redemptionPenalty = detailScoring.breakdown.bonusGames.find(
      (entry) =>
        entry.label === "Redemption Roulette" &&
        entry.result === "incorrect" &&
        entry.points < 0
    );
    if (
      hasMatchingWeeklyWeek &&
      redemptionPenalty &&
      weeklyResults?.bonusGames?.redemptionRoulette &&
      weeklyPredictions?.bonusGames?.redemptionRoulette
    ) {
      penalties.push({
        label: "Bonus: Redemption Roulette",
        points: redemptionPenalty.points,
        pick: weeklyPredictions.bonusGames.redemptionRoulette,
        actual: weeklyResults.bonusGames.redemptionRoulette,
      });
    }

    return penalties;
  };

  const getGuessLedgerEntries = (
    contextState: GameState,
    player: PlayerEntry,
    detailScoring: ReturnType<typeof calculatePlayerScore>
  ) => {
    const entries: Array<{
      label: string;
      result: "correct" | "partial" | "incorrect";
      points: number;
      pick?: string;
      actual?: string;
    }> = [];

    const weeklyResults = contextState.weeklyResults;
    const weeklyPredictions = player.weeklyPredictions;
    const isFinaleWeek = Boolean(contextState.finaleConfig?.enabled);
    const weeklyMultiplier = isFinaleWeek
      ? 1
      : weeklyPredictions?.bonusGames?.doubleOrNothing
      ? 2
      : 1;
    const weeklyCorrectPoints = isFinaleWeek ? 4 : 1 * weeklyMultiplier;
    const weeklyIncorrectPoints = isFinaleWeek ? 1 : 0.5 * weeklyMultiplier;

    if (player.predWinner) {
      const isCorrect = Boolean(contextState.castStatus[player.predWinner]?.isWinner);
      const isFirstOut = Boolean(contextState.castStatus[player.predWinner]?.isFirstOut);
      entries.push({
        label: "Forecast: Winner",
        result: isCorrect ? "correct" : "incorrect",
        points: isCorrect ? 10 : isFirstOut ? -2 : 0,
        pick: player.predWinner,
      });
    }

    if (player.predFirstOut) {
      const isCorrect = Boolean(contextState.castStatus[player.predFirstOut]?.isFirstOut);
      entries.push({
        label: "Forecast: First Out",
        result: isCorrect ? "correct" : "incorrect",
        points: isCorrect ? 5 : 0,
        pick: player.predFirstOut,
      });
    }

    player.predTraitors.forEach((guess) => {
      const isCorrect = Boolean(contextState.castStatus[guess]?.isTraitor);
      entries.push({
        label: "Forecast: Traitor",
        result: isCorrect ? "correct" : "incorrect",
        points: isCorrect ? 3 : 0,
        pick: guess,
      });
    });

    detailScoring.breakdown.weeklyCouncil.forEach((entry) => {
      const isBanished = entry.label === "Next Banished";
      entries.push({
        label: `${COUNCIL_LABELS.weekly}: ${entry.label}`,
        result: entry.result,
        points: entry.result === "correct" ? weeklyCorrectPoints : -weeklyIncorrectPoints,
        pick: isBanished
          ? weeklyPredictions?.nextBanished
          : weeklyPredictions?.nextMurdered,
        actual: isBanished ? weeklyResults?.nextBanished : weeklyResults?.nextMurdered,
      });
    });

    const weeklyFinalePredictions = weeklyPredictions?.finalePredictions;
    const weeklyFinaleResults = weeklyResults?.finaleResults;
    const finaleBreakdownByLabel = new Map(
      detailScoring.breakdown.finaleGauntlet.map((entry) => [entry.label, entry] as const)
    );
    const finaleLedgerRows = [
      {
        label: "Final Winner",
        pick: weeklyFinalePredictions?.finalWinner,
        actual: weeklyFinaleResults?.finalWinner,
      },
      {
        label: "Last Faithful Standing",
        pick: weeklyFinalePredictions?.lastFaithfulStanding,
        actual: weeklyFinaleResults?.lastFaithfulStanding,
      },
      {
        label: "Last Traitor Standing",
        pick: weeklyFinalePredictions?.lastTraitorStanding,
        actual: weeklyFinaleResults?.lastTraitorStanding,
      },
    ];

    finaleLedgerRows.forEach((row) => {
      if (!row.pick) return;
      const scored = finaleBreakdownByLabel.get(row.label);
      const inferredResult: "correct" | "partial" | "incorrect" =
        scored?.result ??
        (row.actual ? (row.actual === row.pick ? "correct" : "incorrect") : "partial");
      entries.push({
        label: `Finale: ${row.label}`,
        result: inferredResult,
        points: typeof scored?.points === "number" ? scored.points : 0,
        pick: row.pick,
        actual: row.actual,
      });
    });

    detailScoring.breakdown.bonusGames.forEach((entry) => {
      const bonusPredictions = weeklyPredictions?.bonusGames;
      const bonusResults = weeklyResults?.bonusGames;
      const pick =
        entry.label === "Redemption Roulette"
          ? bonusPredictions?.redemptionRoulette
          : entry.label === "Shield Gambit"
          ? bonusPredictions?.shieldGambit
          : Array.isArray(bonusPredictions?.traitorTrio)
          ? bonusPredictions.traitorTrio.filter(Boolean).join(", ")
          : undefined;
      const actual =
        entry.label === "Redemption Roulette"
          ? bonusResults?.redemptionRoulette
          : entry.label === "Shield Gambit"
          ? bonusResults?.shieldGambit
          : Array.isArray(bonusResults?.traitorTrio)
          ? bonusResults.traitorTrio.filter(Boolean).join(", ")
          : undefined;
      entries.push({
        label: `Bonus: ${entry.label}`,
        result: entry.result,
        points: entry.points,
        pick,
        actual,
      });
    });

    return entries;
  };

  const getRiskEntries = (
    contextState: GameState,
    player: PlayerEntry,
    detailScoring: ReturnType<typeof calculatePlayerScore>,
    finalePotValue: number | null
  ) => {
    const risks: Array<{
      label: string;
      detail: string;
      outcome?: string;
      points?: number;
    }> = [];

    const weeklyPredictions = player.weeklyPredictions;
    const bonusPredictions = weeklyPredictions?.bonusGames;
    const finalePredictions = weeklyPredictions?.finalePredictions;

    if (bonusPredictions?.doubleOrNothing) {
      risks.push({
        label: "Double or Nothing",
        detail: "Activated 2x weekly council stakes for this slate",
      });
    }

    if (Array.isArray(bonusPredictions?.traitorTrio) && bonusPredictions.traitorTrio.length > 0) {
      const trioBreakdown = detailScoring.breakdown.bonusGames.find(
        (entry) => entry.label === "Traitor Trio Challenge"
      );
      risks.push({
        label: "Traitor Trio Challenge",
        detail: `Submitted trio: ${bonusPredictions.traitorTrio.filter(Boolean).join(", ")}`,
        outcome: trioBreakdown
          ? `${trioBreakdown.result.toUpperCase()} (${formatScore(trioBreakdown.points)})`
          : undefined,
        points: trioBreakdown?.points,
      });
    }

    if (typeof finalePredictions?.finalPotEstimate === "number") {
      const distance =
        typeof finalePotValue === "number"
          ? getFinaleTieBreakDistance(player, finalePotValue)
          : null;
      risks.push({
        label: "Finale Pot Estimate",
        detail: `Submitted estimate: ${formatScore(finalePredictions.finalPotEstimate)}`,
        outcome:
          typeof distance === "number"
            ? `Tie-break distance: ${formatScore(distance)}`
            : "Awaiting final pot resolution",
      });
    }

    if (contextState.finaleConfig?.enabled && finalePredictions) {
      const hasFinaleLocks = Boolean(
        finalePredictions.finalWinner ||
          finalePredictions.lastFaithfulStanding ||
          finalePredictions.lastTraitorStanding
      );
      if (hasFinaleLocks) {
        const finals = detailScoring.breakdown.finaleGauntlet;
        const hitCount = finals.filter((entry) => entry.result === "correct").length;
        risks.push({
          label: "Finale Gauntlet Locks",
          detail: "Locked final winner plus endgame role calls",
          outcome: finals.length > 0 ? `${hitCount}/${finals.length} correct` : undefined,
        });
      }
    }

    return risks;
  };

  const topPlayer = scoredPlayers[0];
  const topScore = topPlayer?.displayTotal;

  const averageScore = scoredPlayers.length
    ? scoredPlayers.reduce((sum, player) => sum + player.displayTotal, 0) / scoredPlayers.length
    : 0;

  const latestArchive = scoreHistory.length > 0 ? getHistoryLabel(scoreHistory[scoreHistory.length - 1]) : "None";

  const kpiItems: PremiumKpiItem[] = [
    { label: "Members", value: String(scoredPlayers.length), hint: "Across both leagues" },
    { label: "Mean Score", value: formatScore(averageScore), hint: "Current weighted total" },
    { label: "Last Certified Archive", value: latestArchive, hint: "Audit timestamp" },
    {
      label: "Cast Remaining",
      value: String(castNames.filter((name) => !gameState.castStatus[name]?.isEliminated).length),
      hint: "Still in contention",
    },
  ];
  const podiumPlayers = scoredPlayers.slice(0, 3);
  const podiumTitles = isSeasonFinalized
    ? ["Champion", "Runner-Up", "Third Place"]
    : ["Command Seat", "Second Chair", "Third Chair"];
  const secondPlayer = scoredPlayers[1];
  const leadMargin =
    topPlayer && secondPlayer
      ? topPlayer.displayTotal - secondPlayer.displayTotal
      : null;
  const topThreeLabels = ["Champion", "Runner-Up", "Third Place"];

  return (
    <motion.div
      className={`space-y-4 md:space-y-5 ${isPremiumUi ? "premium-page premium-leaderboard" : ""} ${
        isSeasonFinalized ? "premium-leaderboard-final" : ""
      }`}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={pageRevealVariants}
    >
      <motion.section variants={sectionStaggerVariants}>
        <PremiumCard className={`premium-panel-pad premium-stack-md premium-leader-summary ${isSyncing ? "panel-sync" : ""}`}>
          <PremiumPanelHeader
            kicker={isSeasonFinalized ? "Season Final Leaderboard" : "Leaderboard Ledger"}
            title={isSeasonFinalized ? "The Championship Board" : "The Estate Command Ledger"}
            description={
              isSeasonFinalized
                ? "Final placements are locked. Every point, bonus, and tie-break is now settled."
                : "Certified standings, transparent scoring, and full player dossiers with every hit, miss, and risk."
            }
            rightSlot={
              <PremiumStatusBadge tone={isSeasonFinalized ? "positive" : "accent"}>
                {isSeasonFinalized ? "Final Board" : "Ops Verified"}
              </PremiumStatusBadge>
            }
          />
          <PremiumKpiRow items={kpiItems} />
          {seasons.length > 0 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <p className="premium-meta-line">Season view</p>
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
          )}
          {isSeasonFinalized && topPlayer && (
            <div className="premium-final-crown-banner">
              <div>
                <p className="premium-kicker">Season Champion</p>
                <p className="premium-final-crown-name">{topPlayer.name}</p>
              </div>
              <div className="premium-final-crown-meta">
                <p className="premium-row-title">{formatScore(topPlayer.displayTotal)}</p>
                {typeof leadMargin === "number" && (
                  <p className="premium-meta-line">
                    Final margin: {leadMargin > 0 ? "+" : ""}
                    {formatScore(leadMargin)}
                  </p>
                )}
              </div>
            </div>
          )}
          {topPlayer ? (
            <div
              className={`premium-top-leader-strip ${
                isSeasonFinalized ? "premium-top-leader-strip-final" : ""
              }`}
            >
              <div>
                <p className="premium-kicker">
                  {isSeasonFinalized ? "Champion Scoreline" : "Table Leader"}
                </p>
                <p className="premium-top-leader-name">{topPlayer.name}</p>
                {typeof leadMargin === "number" && (
                  <p className="premium-meta-line">
                    {isSeasonFinalized ? "Final lead over #2: " : "Lead over #2: "}
                    {leadMargin > 0 ? "+" : ""}
                    {formatScore(leadMargin)}
                  </p>
                )}
              </div>
              <p className="premium-top-leader-score">{formatScore(topScore as number)}</p>
            </div>
          ) : (
            <PremiumStatusBadge>No entries locked yet</PremiumStatusBadge>
          )}

          {podiumPlayers.length > 0 && (
            <div className="premium-podium-grid">
              {podiumPlayers.map((player, podiumIndex) => (
                <article
                  key={`${player.id}-podium`}
                  className={`premium-podium-card ${
                    podiumIndex === 0 ? "premium-podium-card-lead" : ""
                  } ${isSeasonFinalized ? "premium-podium-card-final" : ""} premium-podium-card-rank-${
                    podiumIndex + 1
                  }`}
                >
                  <div className="premium-podium-label-row">
                    <p className="premium-kicker">{podiumTitles[podiumIndex]}</p>
                    <span className="premium-status">#{podiumIndex + 1}</span>
                  </div>
                  <div className="premium-podium-player-row">
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
                      <p className="premium-meta-line uppercase">
                        {player.league === "jr" ? COUNCIL_LABELS.jr : "Main League"}
                      </p>
                    </div>
                  </div>
                  <div className="premium-podium-score-row">
                    <p className="premium-row-title">{formatScore(player.displayTotal)}</p>
                    {typeof weeklyDeltaById[player.id] === "number" && (
                      <p
                        className={
                          weeklyDeltaById[player.id] >= 0
                            ? "premium-value-positive"
                            : "premium-value-negative"
                        }
                      >
                        {weeklyDeltaById[player.id] >= 0 ? "+" : ""}
                        {formatScore(weeklyDeltaById[player.id])}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </PremiumCard>
      </motion.section>

      <motion.section variants={sectionStaggerVariants}>
        <div className="premium-dossier-list">
          {scoredPlayers.map((player, index) => {
            const penalties = getPenaltyEntries(
              detailGameState,
              player,
              player.detailScoring
            );
            const guessLedger = getGuessLedgerEntries(
              detailGameState,
              player,
              player.detailScoring
            );
            const correctGuesses = guessLedger.filter(
              (entry) => entry.result === "correct" || entry.result === "partial"
            );
            const losses = guessLedger.filter((entry) => entry.result === "incorrect");
            const risksTaken = getRiskEntries(
              detailGameState,
              player,
              player.detailScoring,
              effectiveFinalePotValue
            );
            const total = player.displayTotal;
            const weeklyDelta = weeklyDeltaById[player.id];
            const timeline = getPlayerTimeline(player.id).slice(-6);
            const impactFeed = [
              ...player.detailScoring.achievements.map((achievement, idx) => ({
                id: `ach-${idx}`,
                label: `${achievement.icon} ${achievement.type}`,
                detail: achievement.member,
                points: achievement.points,
              })),
              ...penalties.map((penalty, idx) => ({
                id: `pen-${idx}`,
                label: penalty.label,
                detail:
                  penalty.pick && penalty.actual
                    ? `Pick ${penalty.pick} | Result ${penalty.actual}`
                    : penalty.note || penalty.pick || "Penalty applied",
                points: penalty.points,
              })),
            ].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

            return (
              <PremiumCard
                key={player.id}
                className={`premium-panel-pad-compact premium-dossier-card ${
                  index === 0 ? "premium-dossier-card-leader" : ""
                } ${
                  isSeasonFinalized && index < 3
                    ? `premium-dossier-card-final premium-dossier-card-final-${index + 1}`
                    : ""
                }`}
              >
                <div className="premium-dossier-head">
                  {isSeasonFinalized && index < 3 && (
                    <span className="premium-dossier-finish-badge">
                      {topThreeLabels[index]}
                    </span>
                  )}
                  <div className="premium-dossier-player">
                    <span className="premium-dossier-rank">#{index + 1}</span>
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
                      <p className="premium-meta-line uppercase">
                        {player.league === "jr" ? COUNCIL_LABELS.jr : "Main League"}
                      </p>
                    </div>
                  </div>
                  <div className="premium-dossier-score">
                    <p className="premium-rank-total">{formatScore(total)}</p>
                    {typeof weeklyDelta === "number" && (
                      <p className={weeklyDelta >= 0 ? "premium-value-positive" : "premium-value-negative"}>
                        {weeklyDelta >= 0 ? "+" : ""}
                        {formatScore(weeklyDelta)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="premium-dossier-chip-row">
                  <span className="premium-dossier-chip">Achievements {player.detailScoring.achievements.length}</span>
                  <span className="premium-dossier-chip">Penalties {penalties.length}</span>
                  <span className="premium-dossier-chip">Correct Calls {correctGuesses.length}</span>
                  <span className="premium-dossier-chip">Misses {losses.length}</span>
                  <span className="premium-dossier-chip">Risks {risksTaken.length}</span>
                </div>

                <div className="premium-dossier-grid">
                  <div className="premium-subpanel">
                    <p className="premium-kicker mb-2">Impact Ledger</p>
                    {impactFeed.length > 0 ? (
                      <div className="premium-ledger-list">
                        {impactFeed.map((entry) => (
                          <div key={`${player.id}-${entry.id}`} className="premium-ledger-item">
                            <div className="min-w-0">
                              <p className="premium-row-title truncate">{entry.label}</p>
                              <p className="premium-meta-line truncate">{entry.detail}</p>
                            </div>
                            <p className={entry.points >= 0 ? "premium-value-positive" : "premium-value-negative"}>
                              {entry.points > 0 ? "+" : ""}
                              {formatScore(entry.points)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="premium-meta-line">No scored impact events on record.</p>
                    )}
                  </div>

                  <div className="premium-subpanel">
                    <p className="premium-kicker mb-2">Decision Ledger</p>
                    {guessLedger.length > 0 ? (
                      <div className="premium-ledger-list">
                        {guessLedger.map((entry, idx) => (
                          <div key={`${player.id}-ledger-${idx}`} className="premium-ledger-item">
                            <div className="min-w-0">
                              <p className="premium-row-title truncate">{entry.label}</p>
                              {entry.pick && <p className="premium-meta-line truncate">Pick: {entry.pick}</p>}
                              {entry.actual && <p className="premium-meta-line truncate">Result: {entry.actual}</p>}
                            </div>
                            <p
                              className={
                                entry.points > 0
                                  ? "premium-value-positive"
                                  : entry.points < 0
                                  ? "premium-value-negative"
                                  : "premium-meta-line"
                              }
                            >
                              {entry.points > 0 ? "+" : ""}
                              {formatScore(entry.points)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="premium-meta-line">No scored guess events on record.</p>
                    )}
                  </div>

                  <div className="premium-subpanel">
                    <p className="premium-kicker mb-2">Risk Book + Tie-Break</p>
                    {risksTaken.length > 0 ? (
                      <div className="premium-ledger-list">
                        {risksTaken.map((risk, idx) => (
                          <div key={`${player.id}-risk-${idx}`} className="premium-ledger-item">
                            <div className="min-w-0">
                              <p className="premium-row-title truncate">{risk.label}</p>
                              <p className="premium-meta-line truncate">{risk.detail}</p>
                              {risk.outcome && <p className="premium-meta-line truncate">{risk.outcome}</p>}
                            </div>
                            {typeof risk.points === "number" && (
                              <p
                                className={
                                  risk.points > 0
                                    ? "premium-value-positive"
                                    : risk.points < 0
                                    ? "premium-value-negative"
                                    : "premium-meta-line"
                                }
                              >
                                {risk.points > 0 ? "+" : ""}
                                {formatScore(risk.points)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="premium-meta-line">No high-risk positions recorded.</p>
                    )}

                    {isFinaleTieBreakActive && (
                      <div className="premium-ledger-divider">
                        <p className="premium-meta-line">
                          Final pot benchmark:{" "}
                          {typeof effectiveFinalePotValue === "number"
                            ? formatScore(effectiveFinalePotValue)
                            : "—"}
                        </p>
                        <p className="premium-row-title">
                          Submitted estimate:{" "}
                          {typeof player.weeklyPredictions?.finalePredictions?.finalPotEstimate === "number"
                            ? formatScore(player.weeklyPredictions.finalePredictions.finalPotEstimate)
                            : "No estimate submitted"}
                        </p>
                        <p className="premium-meta-line">
                          Tie-break distance:{" "}
                          {(() => {
                            const distance = getFinaleTieBreakDistance(
                              player,
                              effectiveFinalePotValue
                            );
                            return typeof distance === "number" ? formatScore(distance) : "N/A";
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="premium-subpanel mt-3">
                  <p className="premium-kicker mb-2">Season Timeline</p>
                  {timeline.length > 0 ? (
                    <div className="premium-timeline-strip">
                      {timeline.map((entry, idx) => (
                        <div key={`${player.id}-timeline-${idx}`} className="premium-timeline-chip">
                          <p className="premium-meta-line uppercase">{entry.label}</p>
                          <p className="premium-row-title">{formatScore(entry.total as number)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="premium-meta-line">Timeline appears after the first certified archive.</p>
                  )}
                </div>
              </PremiumCard>
            );
          })}
        </div>
      </motion.section>

      <motion.section variants={sectionStaggerVariants}>
        <PremiumCard className="premium-panel-pad-compact premium-stack-sm">
          <div className="premium-section-topline mb-3">
            <h3 className="premium-section-title">Cast Intelligence Board</h3>
            <PremiumStatusBadge>{castNames.length} dossiers tracked</PremiumStatusBadge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
            {castNames.map((name) => {
              const status = gameState.castStatus[name];
              const portraitSrc = getCastPortraitSrc(name, status?.portraitUrl);

              const tag = status?.isWinner
                ? "Winner"
                : status?.isFirstOut
                ? "First Out"
                : status?.isEliminated
                ? "Out"
                : status?.isTraitor
                ? "Traitor"
                : "Active";

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
                      <div className="premium-avatar-cast-icon rounded-full overflow-hidden bg-black/35 flex-shrink-0">
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
