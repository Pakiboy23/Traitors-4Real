import React, { useState } from "react";
import { CAST_NAMES, COUNCIL_LABELS, DraftPick, GameState, PlayerEntry } from "../types";
import { submitDraftEntry } from "../services/pocketbase";
import ConfirmationCard from "./ConfirmationCard";
import { getCastPortraitSrc } from "../src/castPortraits";
import { useToast } from "./Toast";

interface DraftFormProps {
  gameState: GameState;
  onAddEntry: (entry: PlayerEntry) => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const DRAFT_CLOSED = String(import.meta.env.VITE_DRAFT_CLOSED ?? "true").toLowerCase() !== "false";
const DRAFT_SIZE = 10;
const createEmptyPick = (): DraftPick => ({ member: "", rank: 1, role: "Faithful" });
const createEmptyPicks = () => Array.from({ length: DRAFT_SIZE }, createEmptyPick);

const DraftForm: React.FC<DraftFormProps> = ({ gameState, onAddEntry }) => {
  const { showToast } = useToast();
  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [picks, setPicks] = useState<DraftPick[]>(createEmptyPicks());
  const [sealedPicks, setSealedPicks] = useState<boolean[]>(Array(DRAFT_SIZE).fill(false));
  const [predFirstOut, setPredFirstOut] = useState("");
  const [predWinner, setPredWinner] = useState("");
  const [traitors, setTraitors] = useState(["", "", ""]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeCastNames = CAST_NAMES.filter((name) => !gameState.castStatus[name]?.isEliminated);

  const getDuplicatePicks = () => {
    const selected = picks.map((pick) => pick.member).filter((member) => member !== "");
    const duplicates = selected.filter((item, index) => selected.indexOf(item) !== index);
    return [...new Set(duplicates)];
  };

  const duplicateNames = getDuplicatePicks();
  const hasDuplicates = duplicateNames.length > 0;
  const sealedCount = sealedPicks.filter(Boolean).length;
  const allPicksSealed = sealedPicks.every(Boolean) && picks.every((pick) => pick.member !== "");

  const updatePick = <K extends keyof DraftPick>(idx: number, field: K, value: DraftPick[K]) => {
    if (sealedPicks[idx]) return;
    const nextPicks = [...picks];
    nextPicks[idx] = { ...nextPicks[idx], [field]: value };
    setPicks(nextPicks);
  };

  const toggleSeal = (idx: number) => {
    if (!picks[idx].member) {
      showToast("Select a player before sealing this slot.", "warning");
      return;
    }
    const next = [...sealedPicks];
    next[idx] = !next[idx];
    setSealedPicks(next);
  };

  const autoGeneratePicks = () => {
    const shuffled = shuffleArray(activeCastNames);
    const selected = shuffled.slice(0, DRAFT_SIZE);
    const ranks = shuffleArray(Array.from({ length: DRAFT_SIZE }, (_, index) => index + 1));
    const bonusPool = shuffled.slice(DRAFT_SIZE);

    const nextPicks: DraftPick[] = selected.map((member, index) => ({
      member,
      rank: ranks[index],
      role: Math.random() > 0.75 ? "Traitor" : "Faithful",
    }));

    setPicks(nextPicks);
    setSealedPicks(Array(DRAFT_SIZE).fill(true));

    if (!predFirstOut) setPredFirstOut(bonusPool[0] ?? "");
    if (!predWinner) setPredWinner(bonusPool[1] ?? "");
    if (traitors.every((entry) => entry === "")) {
      setTraitors([bonusPool[2] ?? "", bonusPool[3] ?? "", bonusPool[4] ?? ""]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (DRAFT_CLOSED) {
      showToast(`Draft submissions are closed. Use the ${COUNCIL_LABELS.weekly} tab for weekly picks.`, "warning");
      return;
    }

    if (!playerName.trim() || !playerEmail.trim()) {
      showToast("Name and email are required.", "warning");
      return;
    }

    if (hasDuplicates) {
      showToast("Each draft slot must contain a unique player.", "error");
      return;
    }

    if (!allPicksSealed) {
      showToast("Seal all ten picks before submitting.", "warning");
      return;
    }

    setIsSubmitting(true);

    const newEntry: PlayerEntry = {
      id: Date.now().toString(),
      name: playerName,
      email: playerEmail,
      picks: picks.filter((pick) => pick.member !== ""),
      predFirstOut,
      predWinner,
      predTraitors: traitors.filter((pick) => pick !== ""),
    };

    onAddEntry(newEntry);

    try {
      await submitDraftEntry(newEntry);
      showToast("Draft submitted successfully.", "success");
    } catch (err) {
      console.warn("Draft submission failed:", err);
      showToast("Submission to server failed. Your entry is still saved locally.", "warning");
    }

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <ConfirmationCard
        playerName={playerName}
        onReset={() => {
          setIsSubmitted(false);
          setPlayerName("");
          setPlayerEmail("");
          setPicks(createEmptyPicks());
          setSealedPicks(Array(DRAFT_SIZE).fill(false));
          setPredFirstOut("");
          setPredWinner("");
          setTraitors(["", "", ""]);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Castle Draft Workflow</p>
          <h2 className="headline text-3xl md:text-4xl font-semibold">Build your 10-player board</h2>
        </div>
        <div className="status-pill">{sealedCount}/10 sealed</div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 md:space-y-7">
        {DRAFT_CLOSED && (
          <div className="soft-card rounded-3xl p-4 md:p-5 border-[color:var(--danger)]/50 bg-[color:var(--danger)]/10 text-center">
            <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--danger)] font-semibold">Draft Closed</p>
            <p className="mt-1 text-base text-[color:var(--text-muted)]">
              Draft entries are disabled. Continue with weekly voting in {COUNCIL_LABELS.weekly}.
            </p>
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="soft-card rounded-3xl p-5 md:p-6 text-center">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Step 1</p>
            <h3 className="headline text-xl mt-2">Player Identity</h3>
            <div className="grid grid-cols-1 gap-3 mt-4">
              <input
                id="player-name"
                required
                type="text"
                placeholder="Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="field-soft p-3.5"
                autoComplete="name"
              />
              <input
                id="player-email"
                required
                type="email"
                placeholder="Email"
                value={playerEmail}
                onChange={(e) => setPlayerEmail(e.target.value)}
                className="field-soft p-3.5"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="soft-card rounded-3xl p-5 md:p-6 text-center">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Scoring Snapshot</p>
            <h3 className="headline text-xl mt-2">Season scoring rules</h3>
            <div className="grid grid-cols-2 gap-3 mt-4 text-base">
              <div className="soft-card soft-card-subtle rounded-2xl p-3 text-center">
                <p className="text-xl font-bold text-[color:var(--accent)]">+10</p>
                Winner
              </div>
              <div className="soft-card soft-card-subtle rounded-2xl p-3 text-center">
                <p className="text-xl font-bold text-[color:var(--accent)]">+5</p>
                First Out
              </div>
              <div className="soft-card soft-card-subtle rounded-2xl p-3 text-center">
                <p className="text-xl font-bold text-[color:var(--accent)]">+3</p>
                Traitor Call
              </div>
              <div className="soft-card soft-card-subtle rounded-2xl p-3 text-center border-[color:var(--danger)]/50 bg-[color:var(--danger)]/10">
                <p className="text-xl font-bold text-[color:var(--danger)]">-2</p>
                Reversal Penalty
              </div>
            </div>
          </div>
        </section>

        <section className="soft-card rounded-3xl p-4 md:p-5 space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div>
              <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Step 2</p>
              <h3 className="headline text-xl">Draft Slots</h3>
            </div>
            <div className="flex items-center justify-center gap-2">
              {hasDuplicates && (
                <span className="status-pill border-[color:var(--danger)]/60 text-[color:var(--danger)]">
                  Duplicate picks found
                </span>
              )}
              <button type="button" onClick={autoGeneratePicks} className="btn-secondary px-4 text-sm">
                Auto Fill
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {picks.map((pick, index) => {
              const isDuplicate = pick.member !== "" && duplicateNames.includes(pick.member);
              const isSealed = sealedPicks[index];
              const castPortrait = pick.member
                ? getCastPortraitSrc(pick.member, gameState.castStatus[pick.member]?.portraitUrl)
                : undefined;

              return (
                <article
                  key={index}
                  className={`soft-card soft-card-subtle rounded-3xl p-4 space-y-3 border ${
                    isSealed
                      ? "border-[color:var(--panel-border-strong)]"
                      : isDuplicate
                      ? "border-[color:var(--danger)]/70"
                      : "border-[color:var(--panel-border)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full overflow-hidden border border-[color:var(--panel-border)] bg-black/30 flex items-center justify-center">
                        {castPortrait ? (
                          <img src={castPortrait} alt={pick.member} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm font-semibold text-[color:var(--text)]">
                            {pick.member ? pick.member.charAt(0) : index + 1}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-semibold text-[color:var(--text)]">Slot {index + 1}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSeal(index)}
                      className={`btn-secondary px-3 text-sm ${
                        isSealed
                          ? "border-[color:var(--danger)]/55 text-[color:var(--danger)]"
                          : ""
                      }`}
                    >
                      {isSealed ? "Unseal" : "Seal"}
                    </button>
                  </div>

                  <select
                    disabled={isSealed}
                    value={pick.member}
                    onChange={(e) => updatePick(index, "member", e.target.value)}
                    className="field-soft p-3 text-base"
                  >
                    <option value="">Choose player...</option>
                    {activeCastNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      disabled={isSealed}
                      type="number"
                      min="1"
                      max="10"
                      value={pick.rank}
                      onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10);
                        updatePick(index, "rank", Number.isFinite(next) ? next : 1);
                      }}
                      className="field-soft rank-input p-3 text-base text-center font-bold"
                    />
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        disabled={isSealed}
                        onClick={() => updatePick(index, "role", "Faithful")}
                        className={`rounded-xl border px-2 py-1 text-sm font-semibold uppercase ${
                          pick.role === "Faithful"
                            ? "bg-[color:var(--success)] text-black border-[color:var(--success)]"
                            : "border-[color:var(--panel-border)] text-[color:var(--text-muted)]"
                        }`}
                      >
                        Faithful
                      </button>
                      <button
                        type="button"
                        disabled={isSealed}
                        onClick={() => updatePick(index, "role", "Traitor")}
                        className={`rounded-xl border px-2 py-1 text-sm font-semibold uppercase ${
                          pick.role === "Traitor"
                            ? "bg-[color:var(--danger)] text-black border-[color:var(--danger)]"
                            : "border-[color:var(--panel-border)] text-[color:var(--text-muted)]"
                        }`}
                      >
                        Traitor
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="soft-card rounded-3xl p-5 md:p-6 text-center">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Step 3</p>
            <h3 className="headline text-xl mt-2">Round table predictions</h3>
            <div className="space-y-3 mt-4">
              <div>
                <label className="text-sm uppercase tracking-[0.14em] text-[color:var(--text-muted)]">First Out</label>
                <select
                  value={predFirstOut}
                  onChange={(e) => setPredFirstOut(e.target.value)}
                  className="field-soft p-3 text-base mt-1"
                >
                  <option value="">Select...</option>
                  {activeCastNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Winner</label>
                <select
                  value={predWinner}
                  onChange={(e) => setPredWinner(e.target.value)}
                  className="field-soft p-3 text-base mt-1"
                >
                  <option value="">Select...</option>
                  {activeCastNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="soft-card rounded-3xl p-5 md:p-6 text-center">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Step 4</p>
            <h3 className="headline text-xl mt-2">Traitor shortlist</h3>
            <div className="space-y-3 mt-4">
              {traitors.map((value, index) => (
                <select
                  key={index}
                  value={value}
                  onChange={(e) => {
                    const next = [...traitors];
                    next[index] = e.target.value;
                    setTraitors(next);
                  }}
                  className="field-soft p-3 text-base"
                >
                  <option value="">Traitor guess #{index + 1}</option>
                  {activeCastNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>
        </section>

        <section className="soft-card rounded-3xl p-4 md:p-5">
          {!allPicksSealed && picks.some((pick) => pick.member !== "") && (
            <p className="mb-3 text-sm uppercase tracking-[0.16em] text-[color:var(--danger)] font-semibold text-center">
              Seal every slot before final submission
            </p>
          )}

          <button
            type="submit"
            disabled={DRAFT_CLOSED || hasDuplicates || !allPicksSealed || isSubmitting}
            className={`w-full py-4 md:py-5 rounded-2xl text-sm md:text-base font-extrabold uppercase tracking-[0.16em] transition-all ${
              DRAFT_CLOSED
                ? "bg-[color:var(--danger)]/70 text-white cursor-not-allowed"
                : hasDuplicates || !allPicksSealed || isSubmitting
                ? "bg-[color:var(--bg-soft)] text-[color:var(--text-muted)] border border-[color:var(--panel-border)] cursor-not-allowed"
                : "btn-primary"
            }`}
            aria-busy={isSubmitting}
          >
            {isSubmitting && <span className="loading-spinner mr-2" aria-hidden="true" />}
            {isSubmitting
              ? "Submitting..."
              : DRAFT_CLOSED
              ? "Draft Closed"
              : hasDuplicates
              ? "Fix Duplicate Picks"
              : !allPicksSealed
              ? "Seal All Picks"
              : "Submit Draft"}
          </button>
        </section>
      </form>
    </div>
  );
};

export default DraftForm;
