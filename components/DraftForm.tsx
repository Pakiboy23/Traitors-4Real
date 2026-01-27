import React, { useState, useCallback } from 'react';
import { CAST_NAMES, PlayerEntry, DraftPick, GameState } from '../types';
import ConfirmationCard from './ConfirmationCard';
import Toast, { ToastMessage } from './Toast';

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
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Validation: Check for duplicates in the squad
  const getDuplicatePicks = () => {
    const selected = picks.map(p => p.member).filter(m => m !== '');
    const duplicates = selected.filter((item, index) => selected.indexOf(item) !== index);
    return [...new Set(duplicates)];
  };

  // Check if email already exists in the system
  const isEmailDuplicate = (email: string) => {
    return gameState.players.some(p => p.email.toLowerCase() === email.toLowerCase());
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
      showToast('warning', 'A name must be spoken before the pick is sealed.');
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

    showToast('success', 'Random picks generated. Review and seal each one.');
  };

  const getFormData = () => {
    let draftText = picks.map((p, i) => `Pick #${i + 1}: ${p.member || 'None'} | Rank: ${p.rank} | Pred: ${p.role}`).join('\n');
    return `TRAITORS SEASON 4 FANTASY DRAFT\nPlayer: ${playerName}\nEmail: ${playerEmail}\n\n=== THE DRAFT SQUAD ===\n${draftText}\n\n=== BONUS PREDICTIONS ===\nFirst Eliminated: ${predFirstOut || 'None'}\nWinner Pick: ${predWinner || 'None'}\n\n=== TRAITOR GUESSES ===\n1. ${traitors[0] || '-'}\n2. ${traitors[1] || '-'}\n3. ${traitors[2] || '-'}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName || !playerEmail) {
      showToast('error', 'Please enter your name and email to proceed.');
      return;
    }

    if (hasDuplicates) {
      showToast('error', 'The Conclave forbids duplicates. Each pick must be unique.');
      return;
    }

    if (!allPicksSealed) {
      showToast('error', 'All members of your squad must be sealed before the final submission.');
      return;
    }

    // Check for duplicate email and warn (but still allow - it will update their entry)
    if (isEmailDuplicate(playerEmail)) {
      showToast('warning', 'This email already has an entry. Submitting will update your previous picks.');
    }

    const newEntry: PlayerEntry = {
      id: Date.now().toString(),
      name: playerName,
      email: playerEmail,
      picks: picks.filter(p => p.member !== ''),
      predFirstOut,
      predWinner,
      predTraitors: traitors.filter(t => t !== ''),
    };

    onAddEntry(newEntry);
    setIsSubmitted(true);

    // Open email in new window so user doesn't lose confirmation
    const body = encodeURIComponent(getFormData());
    const subject = encodeURIComponent(`Traitors Draft Picks - ${playerName}`);
    window.open(`mailto:s.haarisshariff@gmail.com,haaris.shariff@universalorlando.com?subject=${subject}&body=${body}`, '_blank');
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
        }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 px-2">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="p-2 bg-white/5 rounded border-l-2 border-l-[#D4AF37] text-center">
          <span className="block text-[#D4AF37] font-bold">+10 PTS</span> Winner
        </div>
        <div className="p-2 bg-white/5 rounded border-l-2 border-l-[#D4AF37] text-center">
          <span className="block text-[#D4AF37] font-bold">+5 PTS</span> 1st Out
        </div>
        <div className="p-2 bg-white/5 rounded border-l-2 border-l-[#D4AF37] text-center">
          <span className="block text-[#D4AF37] font-bold">+3 PTS</span> Traitor ID
        </div>
        <div className="p-2 bg-red-900/10 rounded border-l-2 border-l-red-600 text-center">
          <span className="block text-red-500 font-bold">-2 PTS</span> Penalty
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-zinc-900/80 p-5 rounded border border-[#D4AF37]/30">
          <h3 className="text-lg text-[#D4AF37] mb-4 gothic-font uppercase text-center tracking-widest">Identify Yourself</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="playerName" className="block text-xs text-zinc-400 mb-1">Name</label>
              <input
                id="playerName"
                required
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                className="w-full p-3 rounded bg-black border border-zinc-800 text-white focus:border-[#D4AF37] outline-none"
              />
            </div>
            <div>
              <label htmlFor="playerEmail" className="block text-xs text-zinc-400 mb-1">Email</label>
              <input
                id="playerEmail"
                required
                type="email"
                placeholder="Enter your email"
                value={playerEmail}
                onChange={e => setPlayerEmail(e.target.value)}
                className="w-full p-3 rounded bg-black border border-zinc-800 text-white focus:border-[#D4AF37] outline-none"
              />
              {playerEmail && isEmailDuplicate(playerEmail) && (
                <p className="text-xs text-yellow-500 mt-1">This email has an existing entry (will be updated)</p>
              )}
            </div>
          </div>
        </div>

        <section className="bg-zinc-900/80 rounded border border-[#D4AF37]/30 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 bg-black/50 flex flex-wrap justify-between items-center gap-4">
            <div className="flex flex-col">
              <h3 className="text-xl text-[#D4AF37] gothic-font">I. THE SQUAD</h3>
              {hasDuplicates ? (
                <span className="text-xs text-red-500 font-bold uppercase tracking-tighter animate-pulse">
                  Warning: Duplicate picks detected in squad
                </span>
              ) : (
                <span className="text-xs text-zinc-500 uppercase tracking-widest">Seal each pick to finalize the Conclave</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={autoGeneratePicks}
                className="text-xs font-bold text-[#D4AF37] border border-[#D4AF37]/30 px-3 py-1.5 rounded hover:bg-[#D4AF37] hover:text-black transition-all uppercase tracking-widest"
              >
                Strategize for Me
              </button>
              <div className="flex flex-col items-end">
                <span className="text-xs bg-red-900 px-2 py-1 rounded text-white font-bold">SELECT 10</span>
                <span className="text-xs text-zinc-600 mt-1 uppercase font-bold">{sealedPicks.filter(Boolean).length}/10 SEALED</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-px bg-zinc-800">
            {picks.map((pick, i) => {
              const isDuplicate = pick.member !== '' && duplicateNames.includes(pick.member);
              const isSealed = sealedPicks[i];
              return (
                <div
                  key={i}
                  className={`flex flex-col md:flex-row md:items-center gap-3 p-4 transition-all duration-500 ${isSealed
                      ? 'bg-black/80 border-l-4 border-l-zinc-700 opacity-90'
                      : isDuplicate
                        ? 'bg-red-950/40 border-l-4 border-l-red-500'
                        : pick.role === 'Traitor'
                          ? 'bg-red-900/10 shadow-[inset_0_0_15px_rgba(138,28,28,0.2)] border-l-4 border-l-red-600'
                          : 'bg-black/60 border-l-4 border-l-[#D4AF37]/30'
                    }`}
                >
                  <div className={`text-sm font-bold ${isSealed ? 'text-zinc-600' : isDuplicate ? 'text-red-500' : pick.role === 'Traitor' ? 'text-red-500' : 'text-[#D4AF37]'} w-6`}>#{i + 1}</div>

                  <div className="flex-1">
                    <label htmlFor={`pick-${i}`} className="sr-only">Pick {i + 1} cast member</label>
                    <select
                      id={`pick-${i}`}
                      disabled={isSealed}
                      value={pick.member}
                      onChange={e => updatePick(i, 'member', e.target.value)}
                      className={`w-full p-2 text-sm rounded bg-zinc-950 border text-white outline-none transition-colors ${isSealed ? 'border-zinc-800 text-zinc-500' : isDuplicate ? 'border-red-600 shadow-[0_0_8px_rgba(220,38,38,0.3)]' : 'border-zinc-800 focus:border-[#D4AF37]'
                        }`}
                    >
                      <option value="">Choose Player...</option>
                      {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-16">
                      <label htmlFor={`rank-${i}`} className="sr-only">Rank for pick {i + 1}</label>
                      <input
                        id={`rank-${i}`}
                        disabled={isSealed}
                        type="number" min="1" max="10"
                        value={pick.rank}
                        onChange={e => updatePick(i, 'rank', parseInt(e.target.value))}
                        className={`w-full p-2 rounded text-center text-sm bg-zinc-950 border border-zinc-800 outline-none ${isSealed ? 'text-zinc-600' : 'text-white'}`}
                      />
                    </div>
                    <div className="flex bg-black p-1 rounded border border-zinc-800" role="group" aria-label="Role selection">
                      <button
                        disabled={isSealed}
                        type="button"
                        onClick={() => updatePick(i, 'role', 'Faithful')}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${pick.role === 'Faithful' ? 'bg-green-900/40 text-green-400' : 'text-zinc-600'}`}
                        aria-pressed={pick.role === 'Faithful'}
                      >F</button>
                      <button
                        disabled={isSealed}
                        type="button"
                        onClick={() => updatePick(i, 'role', 'Traitor')}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${pick.role === 'Traitor' ? 'bg-red-900/40 text-red-400' : 'text-zinc-600'}`}
                        aria-pressed={pick.role === 'Traitor'}
                      >T</button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSeal(i)}
                      className={`ml-2 px-4 py-2 rounded text-xs font-black uppercase tracking-widest transition-all border ${isSealed
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-red-400'
                          : 'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black'
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
          <div className="bg-zinc-900/80 p-5 rounded border border-[#D4AF37]/30">
            <h3 className="text-lg text-[#D4AF37] gothic-font mb-4 border-b border-zinc-800 pb-2">II. PROPHECIES</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="predFirstOut" className="block text-xs text-red-500 font-bold mb-1 uppercase tracking-widest">First Out</label>
                <select id="predFirstOut" value={predFirstOut} onChange={e => setPredFirstOut(e.target.value)} className="w-full p-3 rounded bg-black border border-zinc-800 text-sm text-white">
                  <option value="">Select...</option>
                  {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="predWinner" className="block text-xs text-yellow-500 font-bold mb-1 uppercase tracking-widest">Sole Winner</label>
                <select id="predWinner" value={predWinner} onChange={e => setPredWinner(e.target.value)} className="w-full p-3 rounded bg-black border border-zinc-800 text-sm text-white">
                  <option value="">Select...</option>
                  {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/80 p-5 rounded border border-[#D4AF37]/30">
            <h3 className="text-lg text-[#D4AF37] gothic-font mb-4 border-b border-zinc-800 pb-2">III. THE TRAITORS</h3>
            <div className="space-y-2">
              {traitors.map((t, i) => (
                <div key={i}>
                  <label htmlFor={`traitor-${i}`} className="sr-only">Traitor guess {i + 1}</label>
                  <select
                    id={`traitor-${i}`}
                    value={t}
                    onChange={e => {
                      const newT = [...traitors];
                      newT[i] = e.target.value;
                      setTraitors(newT);
                    }}
                    className="w-full p-3 rounded bg-red-900/5 border border-red-900/20 text-sm text-white"
                  >
                    <option value="">Traitor Guess #{i + 1}</option>
                    {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="pt-4 pb-12">
          {!allPicksSealed && picks.some(p => p.member !== '') && (
            <p className="text-center text-xs text-red-500 font-bold uppercase mb-2 tracking-wide animate-pulse">
              You must seal all 10 scrolls to submit your fate.
            </p>
          )}
          <button
            type="submit"
            disabled={hasDuplicates || !allPicksSealed}
            className={`w-full py-5 font-black rounded border-2 uppercase tracking-wide transition-all gothic-font ${hasDuplicates || !allPicksSealed
                ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-b from-red-800 to-red-950 text-[#D4AF37] border-[#D4AF37] shadow-[0_0_20px_rgba(138,28,28,0.3)] hover:scale-[1.02] active:scale-95 cursor-pointer'
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
