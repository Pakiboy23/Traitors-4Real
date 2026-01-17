
import React, { useState } from 'react';
import { CAST_NAMES, DraftPick, GameState, PlayerEntry } from '../types';
import ConfirmationCard from './ConfirmationCard';
import { getCastPortraitSrc } from "../src/castPortraits";

interface DraftFormProps {
  gameState: GameState;
  onAddEntry: (entry: PlayerEntry) => void;
}

const DraftForm: React.FC<DraftFormProps> = ({ gameState, onAddEntry }) => {
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [picks, setPicks] = useState<DraftPick[]>(Array(10).fill({ member: '', rank: 1, role: 'Faithful' }));
  const [sealedPicks, setSealedPicks] = useState<boolean[]>(Array(10).fill(false));
  const [predFirstOut, setPredFirstOut] = useState('');
  const [predWinner, setPredWinner] = useState('');
  const [traitors, setTraitors] = useState(['', '', '']);
  const [weeklyBanished, setWeeklyBanished] = useState('');
  const [weeklyMurdered, setWeeklyMurdered] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Validation: Check for duplicates in the squad
  const getDuplicatePicks = () => {
    const selected = picks.map(p => p.member).filter(m => m !== '');
    const duplicates = selected.filter((item, index) => selected.indexOf(item) !== index);
    return [...new Set(duplicates)];
  };

  const duplicateNames = getDuplicatePicks();
  const hasDuplicates = duplicateNames.length > 0;
  const allPicksSealed = sealedPicks.every(s => s === true) && picks.every(p => p.member !== '');

  const updatePick = (idx: number, field: string, value: any) => {
    if (sealedPicks[idx]) return; // Cannot edit sealed picks
    const newPicks = [...picks];
    newPicks[idx] = { ...newPicks[idx], [field]: value };
    setPicks(newPicks);
  };

  const toggleSeal = (idx: number) => {
    if (!picks[idx].member) {
      alert("A name must be spoken before the pick is sealed.");
      return;
    }
    const newSeals = [...sealedPicks];
    newSeals[idx] = !newSeals[idx];
    setSealedPicks(newSeals);
  };

  const autoGeneratePicks = () => {
    const shuffled = [...CAST_NAMES].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);
    const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].sort(() => 0.5 - Math.random());
    
    const newPicks: DraftPick[] = selected.map((member, i) => ({
      member,
      rank: ranks[i],
      role: Math.random() > 0.75 ? 'Traitor' : 'Faithful'
    }));

    setPicks(newPicks);
    setSealedPicks(Array(10).fill(false)); // Allow user to review auto-picks before sealing
    
    if (!predFirstOut) setPredFirstOut(shuffled[11]);
    if (!predWinner) setPredWinner(shuffled[12]);
    if (traitors.every(t => t === '')) {
       setTraitors([shuffled[13], shuffled[14], shuffled[15]]);
    }
  };

  const getFormData = () => {
    let draftText = picks.map((p, i) => `Pick #${i+1}: ${p.member || 'None'} | Rank: ${p.rank} | Pred: ${p.role}`).join('\n');
    return `TRAITORS SEASON 4 FANTASY DRAFT\nPlayer: ${playerName}\nEmail: ${playerEmail}\n\n=== WEEKLY COUNCIL ===\nNext Banished: ${weeklyBanished || 'None'}\nNext Murdered: ${weeklyMurdered || 'None'}\n\n=== THE DRAFT SQUAD ===\n${draftText}\n\n=== BONUS PREDICTIONS ===\nFirst Eliminated: ${predFirstOut || 'None'}\nWinner Pick: ${predWinner || 'None'}\n\n=== TRAITOR GUESSES ===\n1. ${traitors[0] || '-'}\n2. ${traitors[1] || '-'}\n3. ${traitors[2] || '-'}`;
  };

  const getWeeklyCouncilData = () => {
    return `TRAITORS WEEKLY COUNCIL\nPlayer: ${playerName}\nEmail: ${playerEmail}\n\n=== WEEKLY COUNCIL ===\nNext Banished: ${weeklyBanished || 'None'}\nNext Murdered: ${weeklyMurdered || 'None'}`;
  };

  const findExistingPlayer = () => {
    if (!playerName && !playerEmail) return undefined;
    const normalizedEmail = playerEmail.trim().toLowerCase();
    const normalizedName = playerName.trim().toLowerCase();
    return gameState.players.find(player => {
      if (normalizedEmail) {
        return player.email.trim().toLowerCase() === normalizedEmail;
      }
      return player.name.trim().toLowerCase() === normalizedName;
    });
  };

  const handleWeeklySubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!playerName || !playerEmail) {
      alert("Please enter your name and email before submitting weekly votes.");
      return;
    }

    if (!weeklyBanished && !weeklyMurdered) {
      alert("Please select at least one weekly council prediction.");
      return;
    }

    const existingPlayer = findExistingPlayer();
    if (!existingPlayer) {
      alert("We couldn't find your draft entry yet. Please submit your draft once first.");
      return;
    }

    const updatedEntry: PlayerEntry = {
      ...existingPlayer,
      name: playerName,
      email: playerEmail,
      weeklyPredictions: {
        nextBanished: weeklyBanished,
        nextMurdered: weeklyMurdered,
      },
    };

    onAddEntry(updatedEntry);
    setIsSubmitted(true);

    const body = encodeURIComponent(getWeeklyCouncilData());
    const subject = encodeURIComponent(`Traitors Weekly Council - ${playerName}`);
    window.location.href = `mailto:s.haarisshariff@gmail.com,haaris.shariff@universalorlando.com?subject=${subject}&body=${body}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName || !playerEmail) {
      alert("Please enter your name and email to proceed.");
      return;
    }

    if (hasDuplicates) {
      alert("The Conclave forbids duplicates. Each pick must be unique.");
      return;
    }

    if (!allPicksSealed) {
      alert("All members of your squad must be sealed before the final submission.");
      return;
    }

    const newEntry: PlayerEntry = {
      id: Date.now().toString(),
      name: playerName,
      email: playerEmail,
      picks: picks.filter(p => p.member !== ''),
      predFirstOut,
      predWinner,
      predTraitors: traitors.filter(t => t !== ''),
      weeklyPredictions: {
        nextBanished: weeklyBanished,
        nextMurdered: weeklyMurdered,
      },
    };

    onAddEntry(newEntry);
    setIsSubmitted(true);

    const body = encodeURIComponent(getFormData());
    const subject = encodeURIComponent(`Traitors Draft Picks - ${playerName}`);
    window.location.href = `mailto:s.haarisshariff@gmail.com,haaris.shariff@universalorlando.com?subject=${subject}&body=${body}`;
  };

  if (isSubmitted) {
    return (
      <ConfirmationCard 
        playerName={playerName} 
        onReset={() => {
          setIsSubmitted(false);
          setPlayerName('');
          setPlayerEmail('');
          setPicks(Array(10).fill({ member: '', rank: 1, role: 'Faithful' }));
          setSealedPicks(Array(10).fill(false));
          setPredFirstOut('');
          setPredWinner('');
          setTraitors(['', '', '']);
          setWeeklyBanished('');
          setWeeklyMurdered('');
        }} 
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 px-2">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-panel p-5 rounded-2xl">
          <h3 className="text-lg text-[color:var(--accent)] mb-4 gothic-font uppercase text-center tracking-[0.25em]">Identify Yourself</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input required type="text" placeholder="Name" value={playerName} onChange={e => setPlayerName(e.target.value)} className="p-3 rounded bg-black border border-zinc-800 text-white focus:border-[color:var(--accent)] outline-none" />
            <input required type="email" placeholder="Email" value={playerEmail} onChange={e => setPlayerEmail(e.target.value)} className="p-3 rounded bg-black border border-zinc-800 text-white focus:border-[color:var(--accent)] outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-[color:var(--accent)]/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg text-[color:var(--accent)] gothic-font uppercase tracking-[0.2em]">Weekly Council</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] mt-1">Separate from the season draft</p>
              </div>
              <span className="text-[9px] text-zinc-400 uppercase tracking-[0.3em]">+1 / -0.5</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-red-400 font-semibold mb-1 uppercase tracking-[0.2em]">⚖️ Next Banished</label>
                <select
                  value={weeklyBanished}
                  onChange={e => setWeeklyBanished(e.target.value)}
                  className="w-full p-3 rounded bg-black border border-zinc-800 text-xs text-white"
                >
                  <option value="">Select...</option>
                  {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-fuchsia-400 font-semibold mb-1 uppercase tracking-[0.2em]">🗡️ Next Murdered</label>
                <select
                  value={weeklyMurdered}
                  onChange={e => setWeeklyMurdered(e.target.value)}
                  className="w-full p-3 rounded bg-black border border-zinc-800 text-xs text-white"
                >
                  <option value="">Select...</option>
                  {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em]">Weekly votes submit independently</p>
              <button
                type="button"
                onClick={handleWeeklySubmit}
                className="px-4 py-2 rounded-full text-[10px] font-semibold uppercase tracking-[0.25em] border border-[color:var(--accent)]/40 text-[color:var(--accent)] hover:bg-[color:var(--accent)] hover:text-black transition-all"
              >
                Submit Weekly Council
              </button>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] mb-3 text-center">Season-long scoring</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs md:text-sm">
              <div className="p-3 bg-black/70 rounded border border-[color:var(--accent)]/30 text-center">
                <span className="block text-[color:var(--accent)] font-semibold text-sm md:text-base">+10 PTS</span> Winner
              </div>
              <div className="p-3 bg-black/70 rounded border border-[color:var(--accent)]/30 text-center">
                <span className="block text-[color:var(--accent)] font-semibold text-sm md:text-base">+5 PTS</span> 1st Out
              </div>
              <div className="p-3 bg-black/70 rounded border border-[color:var(--accent)]/30 text-center">
                <span className="block text-[color:var(--accent)] font-semibold text-sm md:text-base">+3 PTS</span> Traitor ID
              </div>
              <div className="p-3 bg-red-950/40 rounded border border-red-600/40 text-center">
                <span className="block text-red-500 font-bold text-sm md:text-base">-2 PTS</span> Penalty
              </div>
            </div>
          </div>
        </div>

        <section className="glass-panel rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800/80 bg-black/40 flex flex-wrap justify-between items-center gap-4">
            <div className="flex flex-col">
              <h3 className="text-xl text-[color:var(--accent)] gothic-font">I. The Squad</h3>
              {hasDuplicates ? (
                <span className="text-[10px] text-red-500 font-semibold uppercase tracking-[0.2em] animate-pulse">
                  ⚠ Duplicate picks detected
                </span>
              ) : (
                <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">Seal each pick to finalize</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button 
                type="button" 
                onClick={autoGeneratePicks}
                className="text-xs md:text-sm font-semibold text-zinc-200 border border-[color:var(--accent)]/40 px-4 py-2 rounded-full hover:bg-[color:var(--accent)] hover:text-black transition-all uppercase tracking-[0.2em]"
              >
                Auto-pick
              </button>
              <div className="flex flex-col items-end">
                <span className="text-xs bg-red-900/60 px-3 py-1.5 rounded text-white font-semibold">Select 10</span>
                <span className="text-[10px] text-zinc-600 mt-1 uppercase font-semibold">{sealedPicks.filter(Boolean).length}/10 sealed</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 bg-transparent p-3">
            {picks.map((pick, i) => {
              const isDuplicate = pick.member !== '' && duplicateNames.includes(pick.member);
              const isSealed = sealedPicks[i];
              const castPortrait = pick.member
                ? getCastPortraitSrc(pick.member, gameState.castStatus[pick.member]?.portraitUrl)
                : undefined;
              return (
                <div 
                  key={i} 
                  className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-500 ${
                    isSealed 
                      ? 'bg-black/80 border-zinc-700 opacity-90' 
                      : isDuplicate 
                        ? 'bg-red-950/40 border-red-500' 
                        : pick.role === 'Traitor' 
                          ? 'bg-red-900/10 shadow-[inset_0_0_15px_rgba(138,28,28,0.2)] border-red-600' 
                          : 'bg-black/60 border-[color:var(--accent)]/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`text-xs font-semibold ${isSealed ? 'text-zinc-600' : isDuplicate ? 'text-red-500' : pick.role === 'Traitor' ? 'text-red-500' : 'text-[color:var(--accent)]'} w-6`}>#{i+1}</div>
                    <div className="w-4 h-4 rounded-full overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center text-[6px] text-zinc-600 font-bold uppercase">
                      {castPortrait ? (
                        <img src={castPortrait} alt="" className="w-full h-full object-cover" />
                      ) : (
                        pick.member ? pick.member.charAt(0) : '?'
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <select 
                      disabled={isSealed}
                      value={pick.member} 
                      onChange={e => updatePick(i, 'member', e.target.value)}
                      className={`w-full p-2 text-xs rounded bg-zinc-950 border text-white outline-none transition-colors ${
                        isSealed ? 'border-zinc-800 text-zinc-500' : isDuplicate ? 'border-red-600 shadow-[0_0_8px_rgba(220,38,38,0.3)]' : 'border-zinc-800 focus:border-[color:var(--accent)]'
                      }`}
                    >
                      <option value="">Choose Player...</option>
                      {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                     <div className="relative w-16">
                      <input 
                        disabled={isSealed}
                        type="number" min="1" max="10" 
                        value={pick.rank}
                        onChange={e => updatePick(i, 'rank', parseInt(e.target.value))}
                        className={`w-full p-2 rounded text-center text-xs bg-zinc-950 border border-zinc-800 outline-none ${isSealed ? 'text-zinc-600' : 'text-white'}`} 
                      />
                    </div>
                    <div className="flex bg-black/70 p-1 rounded-full border border-zinc-800">
                      <button 
                        disabled={isSealed}
                        type="button"
                        onClick={() => updatePick(i, 'role', 'Faithful')}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all ${pick.role === 'Faithful' ? 'bg-cyan-500 text-black ring-4 ring-cyan-300/80 shadow-[0_0_24px_rgba(34,211,238,0.9)] scale-[1.06]' : 'text-zinc-600'}`}
                      >F</button>
                      <button 
                        disabled={isSealed}
                        type="button"
                        onClick={() => updatePick(i, 'role', 'Traitor')}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all ${pick.role === 'Traitor' ? 'bg-fuchsia-500 text-black ring-4 ring-fuchsia-300/80 shadow-[0_0_24px_rgba(232,121,249,0.9)] scale-[1.06]' : 'text-zinc-600'}`}
                      >T</button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSeal(i)}
                      className={`ml-2 px-4 py-2 rounded-full text-[9px] font-semibold uppercase tracking-[0.2em] transition-all border ${
                        isSealed 
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-red-400' 
                        : 'bg-[color:var(--accent)]/10 border-[color:var(--accent)]/40 text-zinc-200 hover:bg-[color:var(--accent)] hover:text-black'
                    }`}
                  >
                    {isSealed ? 'Unseal' : 'Seal Pick'}
                  </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel p-5 rounded-2xl">
            <h3 className="text-lg text-[color:var(--accent)] gothic-font mb-4 border-b border-zinc-800 pb-2">II. Prophecies</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-red-500 font-semibold mb-1 uppercase tracking-[0.2em]">💀 First Out</label>
                <select value={predFirstOut} onChange={e => setPredFirstOut(e.target.value)} className="w-full p-3 rounded bg-black border border-zinc-800 text-xs text-white">
                  <option value="">Select...</option>
                  {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-yellow-500 font-semibold mb-1 uppercase tracking-[0.2em]">🏆 Sole Winner</label>
                <select value={predWinner} onChange={e => setPredWinner(e.target.value)} className="w-full p-3 rounded bg-black border border-zinc-800 text-xs text-white">
                  <option value="">Select...</option>
                  {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl">
            <h3 className="text-lg text-[color:var(--accent)] gothic-font mb-4 border-b border-zinc-800 pb-2">III. The Traitors</h3>
            <div className="space-y-2">
              {traitors.map((t, i) => (
                <select key={i} value={t} onChange={e => {
                  const newT = [...traitors];
                  newT[i] = e.target.value;
                  setTraitors(newT);
                }} className="w-full p-3 rounded bg-red-900/5 border border-red-900/30 text-xs text-white">
                  <option value="">Traitor Guess #{i+1}</option>
                  {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ))}
            </div>
          </div>
        </section>

        <div className="pt-4 pb-12">
          {!allPicksSealed && picks.some(p => p.member !== '') && (
            <p className="text-center text-[10px] text-red-500 font-semibold uppercase mb-2 tracking-[0.2em] animate-pulse">
              Seal all 10 picks to submit.
            </p>
          )}
          <button 
            type="submit"
            disabled={hasDuplicates || !allPicksSealed}
            className={`w-full py-5 font-semibold rounded-full border-2 uppercase tracking-[0.3em] transition-all gothic-font ${
              hasDuplicates || !allPicksSealed
                ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed opacity-50' 
                : 'bg-gradient-to-b from-red-700 to-red-950 text-[color:var(--accent)] border-[color:var(--accent)] shadow-[0_0_20px_rgba(138,28,28,0.3)] hover:scale-[1.01] active:scale-95 cursor-pointer'
            }`}
          >
            {hasDuplicates ? "Resolve Duplicates" : !allPicksSealed ? "Seal All Picks to Submit" : "Seal Final Fate"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DraftForm;
