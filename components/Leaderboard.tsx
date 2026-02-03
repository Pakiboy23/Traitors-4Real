
import React, { useState, useEffect, useMemo } from 'react';
import { CAST_NAMES, GameState, PlayerEntry, WeeklyScoreSnapshot } from '../types';
import { getCastPortraitSrc } from "../src/castPortraits";
import { calculatePlayerScore, formatScore } from "../src/utils/scoring";

interface LeaderboardProps {
  gameState: GameState;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ gameState }) => {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Visual pulse when gameState changes from an external sync
  useEffect(() => {
    setIsSyncing(true);
    const timer = setTimeout(() => setIsSyncing(false), 1000);
    return () => clearTimeout(timer);
  }, [gameState]);

  const scoreHistory: WeeklyScoreSnapshot[] = Array.isArray(
    gameState.weeklyScoreHistory
  )
    ? gameState.weeklyScoreHistory
    : [];

  const scoredPlayers = gameState.players
    .map((player) => ({
      ...player,
      scoring: calculatePlayerScore(gameState, player),
    }))
    .sort((a, b) => b.scoring.total - a.scoring.total);

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
    snapshot.label?.trim() ||
    new Date(snapshot.createdAt).toLocaleDateString();

  const getPlayerTimeline = (playerId: string) =>
    scoreHistory
      .map((snapshot) => ({
        label: getHistoryLabel(snapshot),
        total: snapshot.totals?.[playerId],
      }))
      .filter((entry) => typeof entry.total === "number");

  const toggleExpand = (id: string) => {
    setExpandedPlayerId(expandedPlayerId === id ? null : id);
  };

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
        label: "Weekly Council: Banished",
        points: -0.5,
        pick: weeklyPredictions.nextBanished,
        actual: weeklyResults.nextBanished,
      });
    }

    if (
      weeklyResults?.nextMurdered &&
      weeklyPredictions?.nextMurdered &&
      weeklyResults.nextMurdered !== weeklyPredictions.nextMurdered
    ) {
      penalties.push({
        label: "Weekly Council: Murdered",
        points: -0.5,
        pick: weeklyPredictions.nextMurdered,
        actual: weeklyResults.nextMurdered,
      });
    }

    return penalties;
  };

  return (
    <div className="space-y-10">
      <div className={`glass-panel p-6 md:p-8 rounded-3xl border transition-all duration-1000 overflow-hidden ${isSyncing ? 'border-green-500 shadow-[0_0_24px_rgba(34,197,94,0.22)]' : 'border-[color:var(--accent)]/30'}`}>
        <div className="flex justify-between items-center mb-10 relative">
          <div className="flex-1 text-center">
            <h3 className="text-3xl md:text-4xl gothic-font text-[color:var(--accent)]">🏆 Official Standings</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mt-2">Live updates as results land</p>
          </div>
          {isSyncing && (
             <div className="absolute right-0 top-0 flex items-center gap-2 px-3 py-1.5 bg-green-900/20 rounded-full border border-green-900/30 animate-in fade-in zoom-in duration-300">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
               <span className="text-xs font-black text-green-500 uppercase tracking-widest">Live Sync</span>
             </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <th className="p-5">Rank</th>
                <th className="p-5">Player</th>
                <th className="p-5 text-right text-[color:var(--accent)] text-xl">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {scoredPlayers.map((p, idx) => {
                const penalties = getPenaltyEntries(p);
                return (
                <React.Fragment key={p.id}>
                  <tr 
                    onClick={() => toggleExpand(p.id)}
                    className={`cursor-pointer transition-all duration-300 ${expandedPlayerId === p.id ? 'bg-[#D4AF37]/10' : 'hover:bg-black/40'}`}
                  >
                    <td className="p-5">
                      <span className="flex items-center gap-2 text-sm">
                        {idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full border border-[#D4AF37]/30 overflow-hidden bg-black flex-shrink-0">
                          {p.portraitUrl ? (
                            <img src={p.portraitUrl} alt={`${p.name}'s profile`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-zinc-600 font-bold uppercase" aria-hidden="true">
                              {p.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-100 text-base md:text-lg">{p.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 uppercase tracking-tighter">View Scroll</span>
                            {p.league === "jr" && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] bg-purple-500/20 text-purple-200 border border-purple-500/30">
                                JR League
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 text-right font-black text-2xl md:text-3xl text-[#D4AF37]">
                      <div className="flex flex-col items-end">
                        <span>{formatScore(p.scoring.total)}</span>
                        {weeklyDeltaById[p.id] !== undefined && (
                          <span
                            className={`text-xs font-bold uppercase tracking-[0.2em] ${
                              weeklyDeltaById[p.id] >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {weeklyDeltaById[p.id] >= 0 ? "+" : ""}
                            {formatScore(weeklyDeltaById[p.id])} wk
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {expandedPlayerId === p.id && (
                    <tr className="bg-black/30 animate-in slide-in-from-top-2 duration-300">
                      <td colSpan={3} className="p-6 md:p-8">
                        <div className="rounded-3xl border border-[color:var(--accent)]/35 bg-black/70 shadow-[0_24px_60px_rgba(0,0,0,0.55)] p-6 md:p-8 space-y-8 relative overflow-hidden">
                          <div className="absolute inset-y-0 left-0 w-1 bg-[color:var(--accent)]/60" />
                          <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(214,179,106,0.2),_transparent_70%)] blur-2xl" />
                          <div className="grid gap-8 lg:grid-cols-2">
                            <div>
                              <h4 className="text-xs font-bold text-[#D4AF37] uppercase tracking-[0.2em] mb-5 border-b border-[#D4AF37]/20 pb-3">
                                The Hall of Victory
                              </h4>
                              {p.scoring.achievements.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                                  {p.scoring.achievements.map((ach, i) => {
                                    const castPortrait = getCastPortraitSrc(
                                      ach.member,
                                      gameState.castStatus[ach.member]?.portraitUrl
                                    );
                                    return (
                                      <div key={i} className="bg-zinc-900 border border-[#D4AF37]/30 p-3 rounded-2xl relative group hover:border-[#D4AF37] transition-all">
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-black mb-3">
                                          {castPortrait ? (
                                            <img src={castPortrait} alt={ach.member} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-700 font-bold text-xs">{ach.member.charAt(0)}</div>
                                          )}
                                        </div>
                                        <div className="text-center">
                                          <p className="text-xs font-bold text-white truncate">{ach.member}</p>
                                          <p className={`text-xs uppercase font-black tracking-tight ${ach.type.includes('Traitor') ? 'text-red-500' : 'text-green-500'}`}>
                                            {ach.icon} {ach.type}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-zinc-600 italic text-sm">No triumphs yet revealed.</p>
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-red-300 uppercase tracking-[0.2em] mb-5 border-b border-red-500/20 pb-3">Costly Misses</h4>
                              {penalties.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {penalties.map((penalty, i) => (
                                    <div
                                      key={`${p.id}-penalty-${i}`}
                                      className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4"
                                    >
                                      <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">{penalty.label}</p>
                                        <span className="text-sm font-black text-red-300">{formatScore(penalty.points)}</span>
                                      </div>
                                      <div className="mt-3 space-y-1">
                                        {penalty.pick && (
                                          <p className="text-sm text-zinc-200">
                                            Your pick: <span className="font-semibold text-white">{penalty.pick}</span>
                                          </p>
                                        )}
                                        {penalty.actual && (
                                          <p className="text-xs text-zinc-400">
                                            Result: <span className="text-zinc-200">{penalty.actual}</span>
                                          </p>
                                        )}
                                        {penalty.note && (
                                          <p className="text-xs text-zinc-400">{penalty.note}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-zinc-600 italic text-sm">No penalties yet. Clean sheet.</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#D4AF37] uppercase tracking-[0.2em] mb-5 border-b border-[#D4AF37]/20 pb-3">
                              Weekly Progress
                            </h4>
                            {scoreHistory.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                {getPlayerTimeline(p.id).slice(-6).map((entry, i) => (
                                  <div
                                    key={`${p.id}-history-${i}`}
                                    className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-3"
                                  >
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">
                                      {entry.label}
                                    </p>
                                    <p className="text-lg font-black text-zinc-100">
                                      {formatScore(entry.total as number)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-zinc-600 italic text-sm">
                                Weekly totals will appear once the Admin archives each week.
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-[color:var(--accent)]/20">
        <div className="text-center mb-8">
          <h3 className="text-3xl md:text-4xl gothic-font text-[color:var(--accent)]">Cast Status</h3>
          <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mt-2">Live status of every player</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
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
              ? "bg-emerald-500/25 text-emerald-200 border-emerald-400/60"
              : status?.isFirstOut
              ? "bg-amber-400/25 text-amber-200 border-amber-400/60"
              : status?.isEliminated
              ? "bg-red-500/30 text-red-100 border-red-400/70"
              : status?.isTraitor
              ? "bg-fuchsia-400/25 text-fuchsia-200 border-fuchsia-400/60"
              : "bg-zinc-800/70 text-zinc-200 border-zinc-600";
            const cardClass = status?.isWinner
              ? "border-emerald-400/70 bg-emerald-500/10"
              : status?.isFirstOut
              ? "border-amber-400/70 bg-amber-500/10"
              : status?.isEliminated
              ? "border-red-500/80 bg-red-950/40"
              : status?.isTraitor
              ? "border-fuchsia-400/70 bg-fuchsia-500/10"
              : "border-zinc-700 bg-black/40";
            return (
              <div
                key={name}
                className={`aspect-square grid grid-rows-[auto_1fr_auto] items-center justify-items-center gap-3 rounded-2xl border-2 p-4 text-center relative overflow-hidden ${cardClass}`}
              >
                {status?.isEliminated && (
                  <div className="absolute inset-0 pointer-events-none z-0">
                    <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(127,29,29,0.45),_transparent_70%)]" />
                    <div className="absolute left-1/2 top-1/2 h-[140%] w-1.5 bg-red-600/85 rotate-45 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_18px_rgba(239,68,68,0.7)]" />
                    <div className="absolute left-1/2 top-1/2 h-[140%] w-1.5 bg-red-600/85 -rotate-45 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_18px_rgba(239,68,68,0.7)]" />
                  </div>
                )}
                <div className="w-full px-3 z-10">
                  <span className={`flex items-center justify-center px-3 py-2 rounded-full text-sm md:text-base uppercase tracking-[0.26em] font-semibold border ${tagClass}`}>
                    {tag}
                  </span>
                </div>
                <div className="flex items-center justify-center z-10 w-full px-4">
                  <p className="text-sm md:text-base font-semibold text-zinc-100 leading-snug">
                    {name}
                  </p>
                </div>
                <div className="z-10">
                  <div className="w-4 h-4 rounded-full overflow-hidden border border-[color:var(--accent)]/15 bg-black opacity-50">
                    {portraitSrc ? (
                      <img src={portraitSrc} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-500">
                        {name.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
