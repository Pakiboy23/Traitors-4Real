
import React, { useState, useEffect, useMemo } from 'react';
import { CAST_NAMES, GameState, WeeklyScoreSnapshot } from '../types';
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
              {scoredPlayers.map((p, idx) => (
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
                            <img src={p.portraitUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-zinc-600 font-bold uppercase">
                              {p.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-100 text-base md:text-lg">{p.name}</span>
                          <span className="text-xs text-zinc-500 uppercase tracking-tighter">View Scroll</span>
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
                    <tr className="bg-black/60 animate-in slide-in-from-top-2 duration-300">
                      <td colSpan={3} className="p-8 border-l-2 border-[#D4AF37]">
                        <div className="space-y-8">
                          <div>
                            <h4 className="text-xs font-bold text-[#D4AF37] uppercase tracking-[0.2em] mb-5 border-b border-[#D4AF37]/20 pb-3">The Hall of Victory</h4>
                            {p.scoring.achievements.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-[color:var(--accent)]/20">
        <div className="text-center mb-8">
          <h3 className="text-3xl md:text-4xl gothic-font text-[color:var(--accent)]">Cast Status</h3>
          <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mt-2">Live status of every player</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/40"
              : status?.isFirstOut
              ? "bg-amber-400/15 text-amber-300 border-amber-400/40"
              : status?.isEliminated
              ? "bg-red-500/15 text-red-300 border-red-500/40"
              : status?.isTraitor
              ? "bg-fuchsia-400/15 text-fuchsia-300 border-fuchsia-400/40"
              : "bg-zinc-800/60 text-zinc-300 border-zinc-700";
            return (
              <div
                key={name}
                className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-black/40 p-4"
              >
                <div className="w-14 h-14 rounded-full overflow-hidden border border-[color:var(--accent)]/30 bg-black flex-shrink-0">
                  {portraitSrc ? (
                    <img src={portraitSrc} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-zinc-500">
                      {name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-100">{name}</p>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] uppercase tracking-[0.2em] border ${tagClass}`}>
                    {tag}
                  </span>
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
