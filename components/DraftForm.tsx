
import React, { useState } from 'react';
import { CAST_NAMES, DraftPick, GameState, PlayerEntry } from '../types';
import { submitDraftEntry } from '../services/pocketbase';
import ConfirmationCard from './ConfirmationCard';
import { getCastPortraitSrc } from "../src/castPortraits";
import { useToast } from './Toast';

interface DraftFormProps {
  gameState: GameState;
  onAddEntry: (entry: PlayerEntry) => void;
}

/**
 * Fisher-Yates shuffle algorithm for unbiased random shuffling.
 * Returns a new shuffled array without modifying the original.
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const DRAFT_CLOSED = true;

const DraftForm: React.FC<DraftFormProps> = ({ gameState, onAddEntry }) => {
  const { showToast } = useToast();
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [picks, setPicks] = useState<DraftPick[]>(Array(10).fill({ member: '', rank: 1, role: 'Faithful' }));
  const [sealedPicks, setSealedPicks] = useState<boolean[]>(Array(10).fill(false));
  const [predFirstOut, setPredFirstOut] = useState('');
  const [predWinner, setPredWinner] = useState('');
  const [traitors, setTraitors] = useState(['', '', '']);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      showToast("A name must be spoken before the pick is sealed.", "warning");
      return;
    }
    const newSeals = [...sealedPicks];
    newSeals[idx] = !newSeals[idx];
    setSealedPicks(newSeals);
  };

  const autoGeneratePicks = () => {
    const shuffled = shuffleArray(CAST_NAMES);
    const selected = shuffled.slice(0, 10);
    const ranks = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    
    const newPicks: DraftPick[] = selected.map((member, i) => ({
      member,
      rank: ranks[i],
      role: Math.random() > 0.75 ? 'Traitor' : 'Faithful'
    }));

    setPicks(newPicks);
    setSealedPicks(Array(10).fill(true));
    
    if (!predFirstOut) setPredFirstOut(shuffled[11]);
    if (!predWinner) setPredWinner(shuffled[12]);
    if (traitors.every(t => t === '')) {
       setTraitors([shuffled[13], shuffled[14], shuffled[15]]);
    }
  };

  const getFormData = () => {
    let draftText = picks.map((p, i) => `Pick #${i+1}: ${p.member || 'None'} | Rank: ${p.rank} | Pred: ${p.role}`).join('\n');
    return `TRAITORS SEASON 4 FANTASY DRAFT\nPlayer: ${playerName}\nEmail: ${playerEmail}\n\n=== THE DRAFT SQUAD ===\n${draftText}\n\n=== BONUS PREDICTIONS ===\nFirst Eliminated: ${predFirstOut || 'None'}\nWinner Pick: ${predWinner || 'None'}\n\n=== TRAITOR GUESSES ===\n1. ${traitors[0] || '-'}\n2. ${traitors[1] || '-'}\n3. ${traitors[2] || '-'}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (DRAFT_CLOSED) {
      showToast("Draft submissions are closed. Please use the Weekly Council tab.", "warning");
      return;
    }
    if (!playerName || !playerEmail) {
      showToast("Please enter your name and email to proceed.", "warning");
      return;
    }

    if (hasDuplicates) {
      showToast("The Conclave forbids duplicates. Each pick must be unique.", "error");
      return;
    }

    if (!allPicksSealed) {
      showToast("All members of your squad must be sealed before the final submission.", "warning");
      return;
    }

    setIsSubmitting(true);

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

    try {
      await submitDraftEntry(newEntry);
      showToast("Your draft has been submitted successfully!", "success");
    } catch (err) {
      console.warn("Draft submission failed:", err);
      showToast("Draft submission failed. Your entry was saved locally.", "warning");
    }

    setIsSubmitting(false);
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
        }} 
      />
    );
  }

  return (
    <div className="pb-24">
      <form
        onSubmit={handleSubmit}
        className="space-y-12"
      >
        {DRAFT_CLOSED && (
          <div className="glass-panel p-6 rounded-3xl border border-red-500/40 bg-red-950/30 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-red-300 mb-3">Draft Closed</p>
            <p className="text-sm text-zinc-300">
              Draft submissions are no longer accepted. Head to the Weekly Council tab to submit weekly votes.
            </p>
          </div>
        )}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
          <div className="glass-panel p-8 rounded-3xl">
            <h3 className="text-xl text-[color:var(--accent)] mb-5 gothic-font uppercase text-center tracking-[0.22em]">
              Identify Yourself
            </h3>
            <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto w-full">
              <div>
                <label htmlFor="player-name" className="sr-only">Your Name</label>
                <input
                  id="player-name"
                  required
                  type="text"
                  placeholder="Name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full p-4 rounded-xl bg-[color:var(--input-bg)] border border-[color:var(--input-border)] text-[color:var(--text)] focus:border-[color:var(--accent)] outline-none text-base text-center transition-colors"
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="player-email" className="sr-only">Your Email</label>
                <input
                  id="player-email"
                  required
                  type="email"
                  placeholder="Email"
                  value={playerEmail}
                  onChange={(e) => setPlayerEmail(e.target.value)}
                  className="w-full p-4 rounded-xl bg-[color:var(--input-bg)] border border-[color:var(--input-border)] text-[color:var(--text)] focus:border-[color:var(--accent)] outline-none text-base text-center transition-colors"
                  aria-required="true"
                />
              </div>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-3xl">
            <p className="text-xs text-zinc-500 uppercase tracking-[0.18em] mb-4 text-center">Season-long scoring</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-4 soft-card soft-card-subtle text-center border-[color:var(--accent)]/30">
                <span className="block text-[color:var(--accent)] font-semibold text-base md:text-lg">+10 PTS</span>
                Winner
              </div>
              <div className="p-4 soft-card soft-card-subtle text-center border-[color:var(--accent)]/30">
                <span className="block text-[color:var(--accent)] font-semibold text-base md:text-lg">+5 PTS</span>
                1st Out
              </div>
              <div className="p-4 soft-card soft-card-subtle text-center border-[color:var(--accent)]/30">
                <span className="block text-[color:var(--accent)] font-semibold text-base md:text-lg">+3 PTS</span>
                Traitor ID
              </div>
              <div className="p-4 soft-card soft-card-subtle text-center border-red-600/40 bg-red-950/25">
                <span className="block text-red-500 font-bold text-base md:text-lg">-2 PTS</span>
                Penalty
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-10">
          <section className="glass-panel rounded-3xl overflow-hidden">
            <div className="p-6 border-b soft-divider bg-black/30 flex flex-wrap justify-between items-center gap-6">
              <div className="flex flex-col">
                <h3 className="text-2xl text-[color:var(--accent)] gothic-font">I. The Squad</h3>
                {hasDuplicates ? (
                  <span className="text-xs text-red-500 font-semibold uppercase tracking-[0.2em] animate-pulse">
                    ⚠ Duplicate picks detected
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500 uppercase tracking-[0.2em]">
                    {DRAFT_CLOSED ? "Draft submissions are closed" : "Seal each pick to finalize"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={autoGeneratePicks}
                  className="text-sm font-semibold text-zinc-200 border border-[color:var(--accent)]/40 px-5 py-2.5 rounded-full hover:bg-[color:var(--accent)] hover:text-black transition-all uppercase tracking-[0.18em] active:scale-95"
                  aria-label="Auto-generate random picks"
                >
                  Auto-pick
                </button>
                <div className="flex flex-col items-end">
                  <span className="text-sm bg-red-900/60 px-4 py-2 rounded-full text-white font-semibold">Select 10</span>
                  <span className="text-xs text-zinc-600 mt-1 uppercase font-semibold">
                    {sealedPicks.filter(Boolean).length}/10 sealed
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-transparent p-6 md:p-8">
              {picks.map((pick, i) => {
                const isDuplicate = pick.member !== '' && duplicateNames.includes(pick.member);
                const isSealed = sealedPicks[i];
                const castPortrait = pick.member
                  ? getCastPortraitSrc(pick.member, gameState.castStatus[pick.member]?.portraitUrl)
                  : undefined;
                return (
                  <div
                    key={i}
                    className={`flex flex-col gap-4 p-6 rounded-3xl soft-card transition-all duration-500 overflow-hidden focus-within:bg-[rgba(217,221,227,0.12)] focus-within:border-[color:var(--accent-strong)] ${
                      isSealed
                        ? 'soft-card-subtle border-zinc-700/60 opacity-90'
                        : isDuplicate
                        ? 'soft-card-subtle border-red-500/60 bg-red-950/25'
                        : pick.role === 'Traitor'
                        ? 'soft-card-subtle border-red-600/50 bg-red-950/20 shadow-[inset_0_0_20px_rgba(138,28,28,0.18)]'
                        : 'border-[color:var(--accent)]/30'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center text-xs text-zinc-600 font-bold uppercase">
                        {castPortrait ? (
                          <img src={castPortrait} alt={`${pick.member} portrait`} className="w-full h-full object-cover" />
                        ) : pick.member ? (
                          <span aria-hidden="true">{pick.member.charAt(0)}</span>
                        ) : (
                          <span aria-hidden="true">?</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div
                        className={`w-full max-w-[220px] py-2.5 rounded-xl text-center text-sm font-semibold soft-card soft-card-subtle ${
                          isSealed
                            ? 'border-zinc-800/60 text-zinc-500'
                            : isDuplicate
                            ? 'border-red-500/70 text-red-400 bg-red-950/25'
                            : pick.role === 'Traitor'
                            ? 'border-red-500/70 text-red-400 bg-red-950/25'
                            : 'border-[color:var(--accent)]/35 text-[color:var(--accent)]'
                        }`}
                      >
                        #{i + 1}
                      </div>
                    </div>

                    <div className="flex-1 flex justify-center">
                      <select
                        disabled={isSealed}
                        value={pick.member}
                        onChange={(e) => updatePick(i, 'member', e.target.value)}
                        className={`w-full p-3.5 text-sm rounded-2xl bg-zinc-950 border text-white outline-none transition-colors font-semibold ${
                          isSealed
                            ? 'border-zinc-800 text-zinc-500'
                            : isDuplicate
                            ? 'border-red-600 shadow-[0_0_8px_rgba(220,38,38,0.3)]'
                            : 'border-zinc-800 focus:border-[color:var(--accent-strong)] focus:bg-[rgba(217,221,227,0.12)]'
                        }`}
                      >
                        <option value="">Choose Player...</option>
                        {CAST_NAMES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-full max-w-[220px]">
                        <input
                          disabled={isSealed}
                          type="number"
                          min="1"
                          max="10"
                          value={pick.rank}
                          onChange={(e) => updatePick(i, 'rank', parseInt(e.target.value))}
                          className={`w-full p-3.5 rounded-xl text-center text-sm bg-zinc-950 border border-zinc-800 outline-none ${
                            isSealed ? 'text-zinc-600' : 'text-white'
                          }`}
                        />
                      </div>
                      <div className="flex soft-card soft-card-subtle border-zinc-700/60 p-2 rounded-xl w-full max-w-[220px] justify-between" role="group" aria-label="Role prediction">
                        <button
                          disabled={isSealed}
                          type="button"
                          onClick={() => updatePick(i, 'role', 'Faithful')}
                          className={`flex-1 px-4 py-3 rounded-lg text-xs font-semibold transition-all ${
                            pick.role === 'Faithful'
                              ? 'bg-[color:var(--success)] text-black border-2 border-[color:var(--success)] shadow-[0_0_26px_rgba(0,229,168,0.85)] scale-[1.04]'
                              : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                          }`}
                          aria-label="Predict Faithful"
                          aria-pressed={pick.role === 'Faithful'}
                        >
                          F
                        </button>
                        <button
                          disabled={isSealed}
                          type="button"
                          onClick={() => updatePick(i, 'role', 'Traitor')}
                          className={`flex-1 px-4 py-3 rounded-lg text-xs font-semibold transition-all ${
                            pick.role === 'Traitor'
                              ? 'bg-[color:var(--danger)] text-black border-2 border-[color:var(--danger)] shadow-[0_0_26px_rgba(255,45,85,0.85)] scale-[1.04]'
                              : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                          }`}
                          aria-label="Predict Traitor"
                          aria-pressed={pick.role === 'Traitor'}
                        >
                          T
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleSeal(i)}
                        className={`w-full max-w-[220px] px-6 py-3 rounded-xl text-xs font-semibold uppercase tracking-[0.2em] transition-all border ${
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

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel p-7 rounded-3xl">
              <h3 className="text-xl text-[color:var(--accent)] gothic-font mb-5 border-b soft-divider pb-3">
                II. Prophecies
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs text-red-500 font-semibold mb-2 uppercase tracking-[0.18em]">
                    💀 First Out
                  </label>
                  <select
                    value={predFirstOut}
                    onChange={(e) => setPredFirstOut(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-black border border-zinc-800 text-sm text-white"
                  >
                    <option value="">Select...</option>
                    {CAST_NAMES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-yellow-500 font-semibold mb-2 uppercase tracking-[0.18em]">
                    🏆 Sole Winner
                  </label>
                  <select
                    value={predWinner}
                    onChange={(e) => setPredWinner(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-black border border-zinc-800 text-sm text-white"
                  >
                    <option value="">Select...</option>
                    {CAST_NAMES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="glass-panel p-7 rounded-3xl">
              <h3 className="text-xl text-[color:var(--accent)] gothic-font mb-5 border-b soft-divider pb-3">
                III. The Traitors
              </h3>
              <div className="space-y-3">
                {traitors.map((t, i) => (
                  <select
                    key={i}
                    value={t}
                    onChange={(e) => {
                      const newT = [...traitors];
                      newT[i] = e.target.value;
                      setTraitors(newT);
                    }}
                    className="w-full p-3.5 rounded-2xl bg-red-900/5 border border-red-900/30 text-sm text-white"
                  >
                    <option value="">Traitor Guess #{i + 1}</option>
                    {CAST_NAMES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          </section>

          <div className="pt-4 pb-6 flex flex-col items-center">
            {!allPicksSealed && picks.some((p) => p.member !== '') && (
              <p className="text-center text-xs text-red-500 font-semibold uppercase mb-3 tracking-[0.2em] animate-pulse">
                Seal all 10 picks to submit.
              </p>
            )}
            <button
              type="submit"
              disabled={DRAFT_CLOSED || hasDuplicates || !allPicksSealed || isSubmitting}
              className={`w-full max-w-3xl py-6 font-semibold rounded-2xl border-2 uppercase tracking-[0.28em] transition-all gothic-font text-base md:text-lg flex items-center justify-center gap-3 ${
                DRAFT_CLOSED
                  ? 'bg-red-900 border-red-600 text-white cursor-not-allowed opacity-90'
                  : hasDuplicates || !allPicksSealed || isSubmitting
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-b from-red-700 to-red-950 text-[color:var(--accent)] border-[color:var(--accent)] shadow-[0_0_20px_rgba(138,28,28,0.3)] hover:scale-[1.01] active:scale-95 cursor-pointer'
              }`}
              aria-busy={isSubmitting}
            >
              {isSubmitting && <span className="loading-spinner" aria-hidden="true" />}
              {isSubmitting
                ? 'Submitting...'
                : DRAFT_CLOSED
                ? 'Draft Closed'
                : hasDuplicates
                ? 'Resolve Duplicates'
                : !allPicksSealed
                ? 'Seal All Picks to Submit'
                : 'Seal Final Fate'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default DraftForm;
