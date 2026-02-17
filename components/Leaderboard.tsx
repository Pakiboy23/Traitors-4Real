import React, { useEffect, useMemo, useState } from "react";
import { CAST_NAMES, COUNCIL_LABELS, GameState, PlayerEntry, WeeklyScoreSnapshot } from "../types";
import { getCastPortraitSrc } from "../src/castPortraits";
import { calculatePlayerScore, formatScore } from "../src/utils/scoring";
import { LIMITS, TIMING } from "../src/utils/scoringConstants";

interface LeaderboardProps {
  gameState: GameState;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ gameState }) => {
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

  return (
    <div className="space-y-6 md:space-y-8">
      <section className={`soft-card rounded-3xl p-5 md:p-6 ${isSyncing ? "panel-sync" : ""}`}>
        <div className="flex flex-col items-center gap-4 text-center">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Standings</p>
            <h2 className="headline text-3xl md:text-4xl">Council leaderboard</h2>
          </div>
          {topPlayer ? (
            <div className="soft-card soft-card-subtle rounded-2xl px-4 py-3 w-full max-w-sm text-center">
              <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Current Leader</p>
              <p className="headline text-2xl mt-1">{topPlayer.name}</p>
              <p className="text-base font-bold text-[color:var(--accent)] mt-1">{formatScore(topScore)}</p>
            </div>
          ) : (
            <div className="status-pill">No entries yet</div>
          )}
        </div>
      </section>

      <section className="soft-card rounded-3xl p-4 md:p-5">
        <div className="grid grid-cols-[54px_1fr_100px] md:grid-cols-[70px_1fr_130px] gap-3 px-2 pb-2 text-sm md:text-base uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
          <span className="text-[color:var(--text)]">Rank</span>
          <span>Player</span>
          <span className="text-right">Total</span>
        </div>

        <div className="space-y-2">
          {scoredPlayers.map((player, index) => {
            const penalties = getPenaltyEntries(player);
            const isExpanded = expandedPlayerId === player.id;
            const total =
              !hasActiveWeeklyResults && typeof latestSnapshotTotals[player.id] === "number"
                ? latestSnapshotTotals[player.id]
                : player.scoring.total;

            return (
              <article
                key={player.id}
                className={`rounded-2xl border transition-all ${
                  isExpanded
                    ? "border-[color:var(--accent)]/50 bg-[color:var(--accent-subtle)]"
                    : "border-[color:var(--panel-border)] bg-black/20"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                  className="w-full grid grid-cols-[54px_1fr_100px] md:grid-cols-[70px_1fr_130px] gap-3 items-center px-3 py-3 text-left"
                  aria-expanded={isExpanded}
                >
                  <div className="rank-pill inline-flex min-w-[2.15rem] h-9 items-center justify-center rounded-xl px-2 text-base font-black">
                    {index === 0 ? "#1" : index === 1 ? "#2" : index === 2 ? "#3" : `#${index + 1}`}
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-[color:var(--panel-border)] bg-black/30 flex-shrink-0">
                      {player.portraitUrl ? (
                        <img src={player.portraitUrl} alt={player.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-sm font-bold text-[color:var(--text-muted)]">
                          {player.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-base md:text-lg truncate text-[color:var(--text)]">{player.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-[color:var(--text-muted)] uppercase tracking-[0.1em]">Tap for detail</p>
                        {player.league === "jr" && <span className="status-pill">{COUNCIL_LABELS.jr}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xl md:text-2xl font-black text-[color:var(--accent)]">{formatScore(total)}</p>
                    {weeklyDeltaById[player.id] !== undefined && (
                      <p
                        className={`text-sm uppercase tracking-[0.12em] font-semibold ${
                          weeklyDeltaById[player.id] >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"
                        }`}
                      >
                        {weeklyDeltaById[player.id] >= 0 ? "+" : ""}
                        {formatScore(weeklyDeltaById[player.id])}
                      </p>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-4 md:px-4 md:pb-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="soft-card soft-card-subtle rounded-2xl p-4">
                        <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)] mb-3">Achievements</p>
                        {player.scoring.achievements.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {player.scoring.achievements.map((achievement, idx) => {
                              const castPortrait = getCastPortraitSrc(
                                achievement.member,
                                gameState.castStatus[achievement.member]?.portraitUrl
                              );
                              return (
                                <div
                                  key={`${player.id}-ach-${idx}`}
                                  className="soft-card soft-card-subtle rounded-xl p-2.5 flex items-center gap-2"
                                >
                                  <div className="h-8 w-8 rounded-full overflow-hidden border border-[color:var(--panel-border)] bg-black/30">
                                    {castPortrait ? (
                                      <img src={castPortrait} alt={achievement.member} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="h-full w-full flex items-center justify-center text-sm text-[color:var(--text-muted)]">
                                        {achievement.member.charAt(0)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[color:var(--text)] truncate">{achievement.member}</p>
                                    <p className="text-sm uppercase tracking-[0.1em] text-[color:var(--text-muted)] truncate">
                                      {achievement.icon} {achievement.type}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-[color:var(--text-muted)]">No achievements recorded yet.</p>
                        )}
                      </div>

                      <div className="soft-card soft-card-subtle rounded-2xl p-4">
                        <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)] mb-3">Penalties</p>
                        {penalties.length > 0 ? (
                          <div className="space-y-2">
                            {penalties.map((penalty, idx) => (
                              <div key={`${player.id}-penalty-${idx}`} className="rounded-xl border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--text)]">{penalty.label}</p>
                                  <p className="text-sm font-black text-[color:var(--danger)]">{formatScore(penalty.points)}</p>
                                </div>
                                {penalty.pick && (
                                  <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                                    Pick: <span className="text-[color:var(--text)]">{penalty.pick}</span>
                                  </p>
                                )}
                                {penalty.actual && (
                                  <p className="text-sm text-[color:var(--text-muted)]">
                                    Result: <span className="text-[color:var(--text)]">{penalty.actual}</span>
                                  </p>
                                )}
                                {penalty.note && <p className="text-sm text-[color:var(--text-muted)]">{penalty.note}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-[color:var(--text-muted)]">No penalties recorded.</p>
                        )}
                      </div>
                    </div>

                    <div className="soft-card soft-card-subtle rounded-2xl p-4 mt-3">
                      <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)] mb-3">Weekly timeline</p>
                      {scoreHistory.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {getPlayerTimeline(player.id)
                            .slice(-LIMITS.PLAYER_TIMELINE_DISPLAY)
                            .map((entry, idx) => (
                              <div key={`${player.id}-timeline-${idx}`} className="soft-card soft-card-subtle rounded-xl p-2.5">
                                <p className="text-sm uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{entry.label}</p>
                                <p className="text-base font-bold text-[color:var(--text)] mt-1">{formatScore(entry.total as number)}</p>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[color:var(--text-muted)]">Timeline appears after first weekly archive.</p>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="soft-card rounded-3xl p-4 md:p-5">
        <div className="flex flex-col items-center gap-2 mb-4 text-center">
          <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Cast Status</p>
          <h3 className="headline text-2xl">Castle status board</h3>
          <p className="text-base text-[color:var(--text-muted)]">
            Live reveal board for Traitor, Eliminated, First Out, and Winner statuses.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-3.5">
          {CAST_NAMES.map((name) => {
            const status = gameState.castStatus[name];
            const portraitSrc = getCastPortraitSrc(name, status?.portraitUrl);

            const tag = status?.isWinner
              ? "Winner"
              : status?.isFirstOut
              ? "First Out"
              : status?.isEliminated
              ? "Eliminated"
              : status?.isTraitor
              ? "Traitor"
              : "Still In";

            const tagClass = status?.isWinner
              ? "text-[color:var(--success)] border-[color:var(--success)]/55 bg-[color:var(--success)]/16"
              : status?.isFirstOut
              ? "text-[color:var(--warning)] border-[color:var(--warning)]/55 bg-[color:var(--warning)]/16"
              : status?.isEliminated
              ? "text-[color:var(--danger)] border-[color:var(--danger)]/55 bg-[color:var(--danger)]/16"
              : status?.isTraitor
              ? "text-[color:var(--traitor-crimson-strong)] border-[color:var(--traitor-crimson)]/55 bg-[color:var(--traitor-crimson)]/16"
              : "text-[color:var(--text)] border-[color:var(--panel-border-strong)] bg-black/20";

            const cardClass = status?.isWinner
              ? "border-[color:var(--success)]/48 bg-[color:var(--success)]/8"
              : status?.isFirstOut
              ? "border-[color:var(--warning)]/48 bg-[color:var(--warning)]/8"
              : status?.isEliminated
              ? "border-[color:var(--danger)]/48 bg-[color:var(--danger)]/10"
              : status?.isTraitor
              ? "border-[color:var(--traitor-crimson)]/58 bg-[color:var(--traitor-crimson)]/11"
              : "border-[color:var(--panel-border)]";

            return (
              <article key={name} className={`soft-card soft-card-subtle rounded-2xl p-4 flex flex-col justify-between gap-4 min-h-[168px] ${cardClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm md:text-base leading-snug font-semibold text-[color:var(--text)]">{name}</p>
                  <div className="h-10 w-10 rounded-full overflow-hidden border border-[color:var(--panel-border)] bg-black/30 flex-shrink-0">
                    {portraitSrc ? (
                      <img src={portraitSrc} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-sm font-bold text-[color:var(--text-muted)]">
                        {name.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
                <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-sm md:text-base uppercase tracking-[0.1em] font-semibold ${tagClass}`}>
                  {tag}
                </span>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Leaderboard;
