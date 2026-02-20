import React, { useState } from "react";
import { CAST_NAMES, COUNCIL_LABELS, GameState, PlayerEntry } from "../types";
import { submitWeeklyCouncilVote } from "../services/pocketbase";
import { calculatePlayerScore } from "../src/utils/scoring";
import { useToast } from "./Toast";

interface WeeklyCouncilProps {
  gameState: GameState;
  onAddEntry: (entry: PlayerEntry) => void;
}

const normalize = (value: string) => value.trim().toLowerCase();
const WEEKLY_LABEL = COUNCIL_LABELS.weekly;
const WEEKLY_LABEL_LOWER = WEEKLY_LABEL.toLowerCase();
const JR_LABEL = COUNCIL_LABELS.jr;

const WeeklyCouncil: React.FC<WeeklyCouncilProps> = ({ gameState, onAddEntry }) => {
  const { showToast } = useToast();
  const activeCastNames = CAST_NAMES.filter((name) => !gameState.castStatus[name]?.isEliminated);
  const banishedOptions = activeCastNames;
  const murderOptions = ["No Murder", ...activeCastNames];

  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [weeklyBanished, setWeeklyBanished] = useState("");
  const [weeklyMurdered, setWeeklyMurdered] = useState("");
  const [bonusRedemption, setBonusRedemption] = useState("");
  const [bonusDoubleOrNothing, setBonusDoubleOrNothing] = useState(false);
  const [bonusShield, setBonusShield] = useState("");
  const [bonusTrio, setBonusTrio] = useState<string[]>(["", "", ""]);
  const [mainSubmitted, setMainSubmitted] = useState(false);
  const [isMainSubmitting, setIsMainSubmitting] = useState(false);

  const [jrName, setJrName] = useState("");
  const [jrEmail, setJrEmail] = useState("");
  const [jrWeeklyBanished, setJrWeeklyBanished] = useState("");
  const [jrWeeklyMurdered, setJrWeeklyMurdered] = useState("");
  const [jrBonusRedemption, setJrBonusRedemption] = useState("");
  const [jrBonusDoubleOrNothing, setJrBonusDoubleOrNothing] = useState(false);
  const [jrBonusShield, setJrBonusShield] = useState("");
  const [jrBonusTrio, setJrBonusTrio] = useState<string[]>(["", "", ""]);
  const [jrSubmitted, setJrSubmitted] = useState(false);
  const [isJrSubmitting, setIsJrSubmitting] = useState(false);

  const hasBonusSelection = (bonus: {
    redemptionRoulette?: string;
    doubleOrNothing?: boolean;
    shieldGambit?: string;
    traitorTrio?: string[];
  }) =>
    Boolean(
      bonus.redemptionRoulette || bonus.doubleOrNothing || bonus.shieldGambit || bonus.traitorTrio?.some(Boolean)
    );

  const updateTrioPick = (
    picks: string[],
    setPicks: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) => {
    const next = [...picks];
    next[index] = value;
    setPicks(next);
  };

  const findExistingPlayer = (league?: "main" | "jr") => {
    if (!playerName && !playerEmail) return undefined;
    const normalizedEmail = normalize(playerEmail);
    const normalizedName = normalize(playerName);

    if (normalizedEmail) {
      const matchByEmail = gameState.players.find((player) => {
        const email = normalize(player.email || "");
        const matchesLeague = league
          ? league === "jr"
            ? player.league === "jr"
            : player.league !== "jr"
          : true;
        return matchesLeague && email && email === normalizedEmail;
      });
      if (matchByEmail) return matchByEmail;
    }

    if (normalizedName) {
      return gameState.players.find((player) => {
        const matchesLeague = league
          ? league === "jr"
            ? player.league === "jr"
            : player.league !== "jr"
          : true;
        return matchesLeague && normalize(player.name) === normalizedName;
      });
    }

    return undefined;
  };

  const findExistingJrPlayer = () => {
    if (!jrName && !jrEmail) return undefined;
    const normalizedEmail = normalize(jrEmail);
    const normalizedName = normalize(jrName);

    if (normalizedEmail) {
      const matchByEmail = gameState.players.find((player) => {
        const email = normalize(player.email || "");
        return player.league === "jr" && email && email === normalizedEmail;
      });
      if (matchByEmail) return matchByEmail;
    }

    if (normalizedName) {
      return gameState.players.find((player) => player.league === "jr" && normalize(player.name) === normalizedName);
    }

    return undefined;
  };

  const handleWeeklySubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!playerName || !playerEmail) {
      showToast("Enter name and email before submitting.", "warning");
      return;
    }

    if (
      !weeklyBanished &&
      !weeklyMurdered &&
      !hasBonusSelection({
        redemptionRoulette: bonusRedemption,
        doubleOrNothing: bonusDoubleOrNothing,
        shieldGambit: bonusShield,
        traitorTrio: bonusTrio,
      })
    ) {
      showToast(`Select at least one ${WEEKLY_LABEL_LOWER} or bonus prediction.`, "warning");
      return;
    }

    const existingPlayer = findExistingPlayer("main");
    if (!existingPlayer) {
      showToast("Main league vote requires an existing draft entry.", "error");
      return;
    }

    setMainSubmitted(false);
    setIsMainSubmitting(true);

    const updatedEntry: PlayerEntry = {
      ...existingPlayer,
      name: playerName,
      email: playerEmail,
      weeklyPredictions: {
        nextBanished: weeklyBanished,
        nextMurdered: weeklyMurdered,
        bonusGames: {
          redemptionRoulette: bonusRedemption,
          doubleOrNothing: bonusDoubleOrNothing,
          shieldGambit: bonusShield,
          traitorTrio: bonusTrio.filter(Boolean),
        },
      },
    };

    onAddEntry(updatedEntry);

    try {
      await submitWeeklyCouncilVote({
        name: playerName,
        email: playerEmail,
        weeklyPredictions: {
          nextBanished: weeklyBanished,
          nextMurdered: weeklyMurdered,
        },
        bonusGames: {
          redemptionRoulette: bonusRedemption,
          doubleOrNothing: bonusDoubleOrNothing,
          shieldGambit: bonusShield,
          traitorTrio: bonusTrio.filter(Boolean),
        },
        league: "main",
      });
      showToast(`${WEEKLY_LABEL} submitted.`, "success");
      setMainSubmitted(true);
    } catch (err) {
      const message =
        typeof (err as Error)?.message === "string" && (err as Error).message.length
          ? (err as Error).message
          : "Submission failed. Please try again.";
      console.warn(`${WEEKLY_LABEL} submission failed:`, err);
      showToast(message, "error");
    } finally {
      setIsMainSubmitting(false);
    }
  };

  const handleJrWeeklySubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!jrName || !jrEmail) {
      showToast(`Enter name and email before submitting ${JR_LABEL} picks.`, "warning");
      return;
    }

    if (
      !jrWeeklyBanished &&
      !jrWeeklyMurdered &&
      !hasBonusSelection({
        redemptionRoulette: jrBonusRedemption,
        doubleOrNothing: jrBonusDoubleOrNothing,
        shieldGambit: jrBonusShield,
        traitorTrio: jrBonusTrio,
      })
    ) {
      showToast(`Select at least one ${WEEKLY_LABEL_LOWER} or bonus prediction.`, "warning");
      return;
    }

    setJrSubmitted(false);
    setIsJrSubmitting(true);

    try {
      await submitWeeklyCouncilVote({
        name: jrName,
        email: jrEmail,
        weeklyPredictions: {
          nextBanished: jrWeeklyBanished,
          nextMurdered: jrWeeklyMurdered,
        },
        bonusGames: {
          redemptionRoulette: jrBonusRedemption,
          doubleOrNothing: jrBonusDoubleOrNothing,
          shieldGambit: jrBonusShield,
          traitorTrio: jrBonusTrio.filter(Boolean),
        },
        league: "jr",
      });
      showToast(`${JR_LABEL} vote submitted.`, "success");
      setJrSubmitted(true);
    } catch (err) {
      const message =
        typeof (err as Error)?.message === "string" && (err as Error).message.length
          ? (err as Error).message
          : "Submission failed. Please try again.";
      console.warn(`${JR_LABEL} submission failed:`, err);
      showToast(message, "error");
    } finally {
      setIsJrSubmitting(false);
    }
  };

  const mainPlayerMatch = findExistingPlayer("main");
  const mainScoreTotal = mainPlayerMatch ? calculatePlayerScore(gameState, mainPlayerMatch).total : null;
  const hasMainDouble = mainScoreTotal !== null && mainScoreTotal < 0;

  const jrPlayerMatch = findExistingJrPlayer();
  const jrScoreTotal = jrPlayerMatch ? calculatePlayerScore(gameState, jrPlayerMatch).total : null;
  const hasJrDouble = jrScoreTotal !== null && jrScoreTotal < 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Round Table Operations</p>
          <h2 className="headline text-3xl md:text-4xl">Submit episode predictions</h2>
        </div>
        <div className="status-pill">Main + Jr workflows</div>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-[0.72fr_1.28fr] gap-4 md:gap-5">
        <aside className="soft-card rounded-3xl p-5 md:p-6 space-y-4 h-fit text-center">
          <div>
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Bonus Mechanics</p>
            <h3 className="headline text-2xl mt-2">How bonus scoring works</h3>
          </div>
          <div className="space-y-3 text-base text-[color:var(--text-muted)] leading-relaxed">
            <article className="soft-card soft-card-subtle rounded-2xl p-3">
              <p className="font-semibold text-[color:var(--text)]">Redemption Roulette</p>
              <p className="mt-1">Pick the next revealed traitor. Correct picks score +8 and misses score -1.</p>
            </article>
            <article className="soft-card soft-card-subtle rounded-2xl p-3">
              <p className="font-semibold text-[color:var(--text)]">Double or Nothing</p>
              <p className="mt-1">Applies a 2x multiplier to weekly banished/murdered calls.</p>
            </article>
            <article className="soft-card soft-card-subtle rounded-2xl p-3">
              <p className="font-semibold text-[color:var(--text)]">Shield Gambit + Trio</p>
              <p className="mt-1">Predict the shield winner and keep a three-person traitor shortlist.</p>
            </article>
          </div>
        </aside>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          <article className="soft-card league-panel-main rounded-3xl p-5 md:p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div>
                <div className="inline-flex items-center justify-center gap-2">
                  <span className="league-glyph league-glyph-main" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                      <path d="M12 2 19 5v6c0 5-3.5 9.4-7 11-3.5-1.6-7-6-7-11V5l7-3Zm0 4.2-4 1.7V11c0 3.5 2.2 6.5 4 7.7 1.8-1.2 4-4.2 4-7.7V7.9l-4-1.7Z" />
                    </svg>
                  </span>
                  <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--accent-strong)]">Main League</p>
                </div>
                <h3 className="headline text-2xl mt-1">{WEEKLY_LABEL}</h3>
              </div>
              {mainSubmitted && <span className="status-pill border-[color:var(--success)]/60 text-[color:var(--success)]">Submitted</span>}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input
                type="text"
                placeholder="Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="field-soft p-3.5"
              />
              <input
                type="email"
                placeholder="Email"
                value={playerEmail}
                onChange={(e) => setPlayerEmail(e.target.value)}
                className="field-soft p-3.5"
              />
              <select
                value={weeklyBanished}
                onChange={(e) => setWeeklyBanished(e.target.value)}
                className="field-soft p-3.5 text-base"
              >
                <option value="">Next Banished</option>
                {banishedOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={weeklyMurdered}
                onChange={(e) => setWeeklyMurdered(e.target.value)}
                className="field-soft p-3.5 text-base"
              >
                <option value="">Next Murdered</option>
                {murderOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="soft-card soft-card-subtle league-subpanel-main rounded-2xl p-4 space-y-3">
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Bonus Inputs</p>
                <span className={`status-pill ${hasMainDouble ? "border-[color:var(--success)]/60 text-[color:var(--success)]" : ""}`}>
                  {hasMainDouble ? "2x Boost Active" : "2x Boost Locked"}
                </span>
              </div>
              <select
                value={bonusRedemption}
                onChange={(e) => setBonusRedemption(e.target.value)}
                className="field-soft p-3 text-base"
              >
                <option value="">Redemption Roulette</option>
                {activeCastNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={bonusShield}
                onChange={(e) => setBonusShield(e.target.value)}
                className="field-soft p-3 text-base"
              >
                <option value="">Shield Gambit</option>
                {activeCastNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <label className="soft-card soft-card-subtle rounded-xl px-3 py-2.5 flex items-center justify-between text-sm uppercase tracking-[0.12em]">
                Double or Nothing
                <input
                  type="checkbox"
                  checked={bonusDoubleOrNothing}
                  onChange={(e) => setBonusDoubleOrNothing(e.target.checked)}
                  className="h-4 w-4"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {bonusTrio.map((pick, index) => (
                  <select
                    key={`main-trio-${index}`}
                    value={pick}
                    onChange={(e) => updateTrioPick(bonusTrio, setBonusTrio, index, e.target.value)}
                    className="field-soft p-2.5 text-sm"
                  >
                    <option value="">Trio {index + 1}</option>
                    {activeCastNames.map((name) => (
                      <option key={`main-trio-${index}-${name}`} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleWeeklySubmit}
              disabled={isMainSubmitting}
              className="w-full btn-primary py-3.5 text-sm md:text-base"
            >
              {isMainSubmitting && <span className="loading-spinner mr-2" aria-hidden="true" />}
              {isMainSubmitting ? "Submitting..." : `Submit ${WEEKLY_LABEL}`}
            </button>
          </article>

          <article className="soft-card league-panel-jr rounded-3xl p-5 md:p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div>
                <div className="inline-flex items-center justify-center gap-2">
                  <span className="league-glyph league-glyph-jr" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                      <path d="M20.7 3.3a1 1 0 0 0-1.4 0l-2.8 2.8-1.8-.6-.6-1.8-2.8 2.8a1 1 0 0 0-.2 1l.7 2.2-5.5 5.5-1.7-.3-1.5 1.5 1.8 1.8-1.9 1.9 2.8 2.8 1.9-1.9 1.8 1.8 1.5-1.5-.3-1.7 5.5-5.5 2.2.7a1 1 0 0 0 1-.2l2.8-2.8-1.8-.6-.6-1.8 2.8-2.8a1 1 0 0 0 0-1.4l-1.6-1.6Z" />
                    </svg>
                  </span>
                  <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--traitor-crimson-strong)]">Jr League</p>
                </div>
                <h3 className="headline text-2xl mt-1">{JR_LABEL}</h3>
              </div>
              {jrSubmitted && <span className="status-pill border-[color:var(--success)]/60 text-[color:var(--success)]">Submitted</span>}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input
                type="text"
                placeholder="Name"
                value={jrName}
                onChange={(e) => setJrName(e.target.value)}
                className="field-soft p-3.5"
              />
              <input
                type="email"
                placeholder="Email"
                value={jrEmail}
                onChange={(e) => setJrEmail(e.target.value)}
                className="field-soft p-3.5"
              />
              <select
                value={jrWeeklyBanished}
                onChange={(e) => setJrWeeklyBanished(e.target.value)}
                className="field-soft p-3.5 text-base"
              >
                <option value="">Next Banished</option>
                {banishedOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={jrWeeklyMurdered}
                onChange={(e) => setJrWeeklyMurdered(e.target.value)}
                className="field-soft p-3.5 text-base"
              >
                <option value="">Next Murdered</option>
                {murderOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="soft-card soft-card-subtle league-subpanel-jr rounded-2xl p-4 space-y-3">
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Bonus Inputs</p>
                <span className={`status-pill ${hasJrDouble ? "border-[color:var(--success)]/60 text-[color:var(--success)]" : ""}`}>
                  {hasJrDouble ? "2x Boost Active" : "2x Boost Locked"}
                </span>
              </div>
              <select
                value={jrBonusRedemption}
                onChange={(e) => setJrBonusRedemption(e.target.value)}
                className="field-soft p-3 text-base"
              >
                <option value="">Redemption Roulette</option>
                {activeCastNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={jrBonusShield}
                onChange={(e) => setJrBonusShield(e.target.value)}
                className="field-soft p-3 text-base"
              >
                <option value="">Shield Gambit</option>
                {activeCastNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <label className="soft-card soft-card-subtle rounded-xl px-3 py-2.5 flex items-center justify-between text-sm uppercase tracking-[0.12em]">
                Double or Nothing
                <input
                  type="checkbox"
                  checked={jrBonusDoubleOrNothing}
                  onChange={(e) => setJrBonusDoubleOrNothing(e.target.checked)}
                  className="h-4 w-4"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {jrBonusTrio.map((pick, index) => (
                  <select
                    key={`jr-trio-${index}`}
                    value={pick}
                    onChange={(e) => updateTrioPick(jrBonusTrio, setJrBonusTrio, index, e.target.value)}
                    className="field-soft p-2.5 text-sm"
                  >
                    <option value="">Trio {index + 1}</option>
                    {activeCastNames.map((name) => (
                      <option key={`jr-trio-${index}-${name}`} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleJrWeeklySubmit}
              disabled={isJrSubmitting}
              className="w-full btn-primary py-3.5 text-sm md:text-base"
            >
              {isJrSubmitting && <span className="loading-spinner mr-2" aria-hidden="true" />}
              {isJrSubmitting ? "Submitting..." : `Submit ${JR_LABEL}`}
            </button>
          </article>
        </div>
      </section>
    </div>
  );
};

export default WeeklyCouncil;
