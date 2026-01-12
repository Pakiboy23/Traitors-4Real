
import React, { useState, useEffect } from 'react';
import { GameState, PlayerEntry } from '../types';

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
      penalty: false 
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
    <div className={`glass-panel p-4 md:p-6 rounded-2xl border transition-all duration-1000 overflow-hidden ${isSyncing ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : 'border-[color:var(--accent)]/40'}`}>
      <div className="flex justify-between items-center mb-8 relative">
        <div className="flex-1 text-center">
          <h3 className="text-2xl md:text-3xl gothic-font text-[color:var(--accent)]">🏆 Official Standings</h3>
          <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] mt-1">Live updates as results land</p>
        </div>
        {isSyncing && (
           <div className="absolute right-0 top-0 flex items-center gap-2 px-2 py-1 bg-green-900/20 rounded border border-green-900/30 animate-in fade-in zoom-in duration-300">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
             <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Live Sync</span>
           </div>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-[10px] uppercase tracking-wider">
              <th className="p-4">Rank</th>
              <th className="p-4">Player</th>
              <th className="p-4 text-right text-[color:var(--accent)] text-lg">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {scoredPlayers.map((p, idx) => (
              <React.Fragment key={p.id}>
                <tr 
                  onClick={() => toggleExpand(p.id)}
                  className={`cursor-pointer transition-all duration-300 ${expandedPlayerId === p.id ? 'bg-[#D4AF37]/10' : 'hover:bg-black/40'}`}
                >
                  <td className="p-4">
                    <span className="flex items-center gap-2 text-xs">
                      {idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full border border-[#D4AF37]/30 overflow-hidden bg-black flex-shrink-0">
                        {p.portraitUrl ? (
                          <img src={p.portraitUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-600 font-bold uppercase">
                            {p.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-100 text-sm">{p.name}</span>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">View Scroll</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right font-black text-xl text-[#D4AF37]">{p.scoring.total}</td>
                </tr>
                
                {expandedPlayerId === p.id && (
                  <tr className="bg-black/60 animate-in slide-in-from-top-2 duration-300">
                    <td colSpan={3} className="p-6 border-l-2 border-[#D4AF37]">
                      <div className="space-y-8">
                        <div>
                          <h4 className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.2em] mb-4 border-b border-[#D4AF37]/20 pb-2">The Hall of Victory</h4>
                          {p.scoring.achievements.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                              {p.scoring.achievements.map((ach, i) => {
                                const castPortrait = gameState.castStatus[ach.member]?.portraitUrl;
                                return (
                                  <div key={i} className="bg-zinc-900 border border-[#D4AF37]/30 p-2 rounded relative group hover:border-[#D4AF37] transition-all">
                                    <div className="aspect-square rounded overflow-hidden bg-black mb-2">
                                      {castPortrait ? (
                                        <img src={castPortrait} alt={ach.member} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-700 font-bold text-xl">{ach.member.charAt(0)}</div>
                                      )}
                                    </div>
                                    <div className="text-center">
                                      <p className="text-[10px] font-bold text-white truncate">{ach.member}</p>
                                      <p className={`text-[8px] uppercase font-black tracking-tighter ${ach.type.includes('Traitor') ? 'text-red-500' : 'text-green-500'}`}>
                                        {ach.icon} {ach.type}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-zinc-600 italic text-xs">No triumphs yet revealed.</p>
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
