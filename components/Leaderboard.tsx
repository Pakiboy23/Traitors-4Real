
import React, { useState, useEffect } from 'react';
import { GameState, PlayerEntry } from '../types';
import { getCastPortraitSrc } from "../src/castPortraits";

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

  const calculateScore = (player: PlayerEntry) => {
    let score = 0;
    const achievements = [] as { member: string; type: string; points: number; icon: string }[];
    const breakdown = { 
      draftWinners: [] as string[], 
      predWinner: false, 
      predFirstOut: false, 
      traitorBonus: [] as string[], 
      penalty: false,
      weeklyCouncil: [] as { label: string; result: 'correct' | 'incorrect' }[],
    };

    player.picks.forEach(pick => {
      const status = gameState.castStatus[pick.member];
      if (status?.isWinner) {
        score += 10;
        breakdown.draftWinners.push(pick.member);
        achievements.push({ member: pick.member, type: 'Winner', points: 10, icon: '🏆' });
      }
    });

    if (gameState.castStatus[player.predWinner]?.isWinner) {
      score += 10;
      breakdown.predWinner = true;
      achievements.push({ member: player.predWinner, type: 'Prophecy: Winner', points: 10, icon: '✨' });
    }

    if (gameState.castStatus[player.predFirstOut]?.isFirstOut) {
      score += 5;
      breakdown.predFirstOut = true;
      achievements.push({ member: player.predFirstOut, type: 'Prophecy: 1st Out', points: 5, icon: '💀' });
    }

    player.predTraitors.forEach(guess => {
      if (gameState.castStatus[guess]?.isTraitor) {
        score += 3;
        breakdown.traitorBonus.push(guess);
        achievements.push({ member: guess, type: 'Unmasked Traitor', points: 3, icon: '🎭' });
      }
    });

    if (gameState.castStatus[player.predWinner]?.isFirstOut) {
      score -= 2;
      breakdown.penalty = true;
    }

    const weeklyResults = gameState.weeklyResults;
    const weeklyPredictions = player.weeklyPredictions;

    if (weeklyResults?.nextBanished && weeklyPredictions?.nextBanished) {
      if (weeklyResults.nextBanished === weeklyPredictions.nextBanished) {
        score += 1;
        breakdown.weeklyCouncil.push({ label: 'Next Banished', result: 'correct' });
        achievements.push({
          member: weeklyPredictions.nextBanished,
          type: 'Weekly: Banished',
          points: 1,
          icon: '⚖️',
        });
      } else {
        score -= 0.5;
        breakdown.weeklyCouncil.push({ label: 'Next Banished', result: 'incorrect' });
      }
    }

    if (weeklyResults?.nextMurdered && weeklyPredictions?.nextMurdered) {
      if (weeklyResults.nextMurdered === weeklyPredictions.nextMurdered) {
        score += 1;
        breakdown.weeklyCouncil.push({ label: 'Next Murdered', result: 'correct' });
        achievements.push({
          member: weeklyPredictions.nextMurdered,
          type: 'Weekly: Murdered',
          points: 1,
          icon: '🗡️',
        });
      } else {
        score -= 0.5;
        breakdown.weeklyCouncil.push({ label: 'Next Murdered', result: 'incorrect' });
      }
    }

    return { total: score, breakdown, achievements };
  };

  const scoredPlayers = gameState.players.map(p => ({
    ...p,
    scoring: calculateScore(p)
  })).sort((a, b) => b.scoring.total - a.scoring.total);

  const toggleExpand = (id: string) => {
    setExpandedPlayerId(expandedPlayerId === id ? null : id);
  };

  return (
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
                      <div className="w-2.5 h-2.5 rounded-full border border-[#D4AF37]/30 overflow-hidden bg-black flex-shrink-0">
                        {p.portraitUrl ? (
                          <img src={p.portraitUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[7px] text-zinc-600 font-bold uppercase">
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
                  <td className="p-5 text-right font-black text-2xl md:text-3xl text-[#D4AF37]">{p.scoring.total}</td>
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
                                    <div className="w-4 h-4 rounded-full overflow-hidden bg-black mb-3">
                                      {castPortrait ? (
                                        <img src={castPortrait} alt={ach.member} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-700 font-bold text-[8px]">{ach.member.charAt(0)}</div>
                                      )}
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs font-bold text-white truncate">{ach.member}</p>
                                      <p className={`text-[10px] uppercase font-black tracking-tighter ${ach.type.includes('Traitor') ? 'text-red-500' : 'text-green-500'}`}>
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
  );
};

export default Leaderboard;
