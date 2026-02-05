import React, { useState } from "react";
import { CAST_NAMES, GameState, PlayerEntry } from "../types";
import { submitWeeklyCouncilVote } from "../services/pocketbase";
import { calculatePlayerScore } from "../src/utils/scoring";
import { useToast } from "./Toast";

interface WeeklyCouncilProps {
  gameState: GameState;
  onAddEntry: (entry: PlayerEntry) => void;
}

const normalize = (value: string) => value.trim().toLowerCase();
const getWeeklyCouncilData = (
  name: string,
  email: string,
  banished: string,
  murdered: string,
  bonus: {
    redemptionRoulette?: string;
    doubleOrNothing?: boolean;
    shieldGambit?: string;
  },
  leagueLabel?: string
) => {
  const header = leagueLabel
    ? `TRAITORS WEEKLY COUNCIL - ${leagueLabel}`
    : "TRAITORS WEEKLY COUNCIL";
  return `${header}\nPlayer: ${name}\nEmail: ${email}\n\n=== WEEKLY COUNCIL ===\nNext Banished: ${banished || "None"}\nNext Murdered: ${murdered || "None"}\n\n=== BONUS GAMES ===\nRedemption Roulette: ${bonus.redemptionRoulette || "None"}\nDouble or Nothing: ${bonus.doubleOrNothing ? "Yes" : "No"}\nShield Gambit: ${bonus.shieldGambit || "None"}`;
};

const WeeklyCouncil: React.FC<WeeklyCouncilProps> = ({ gameState, onAddEntry }) => {
  const { showToast } = useToast();
  const activeCastNames = CAST_NAMES.filter(
    (name) => !gameState.castStatus[name]?.isEliminated
  );
  const banishedOptions = activeCastNames;
  const murderOptions = ["No Murder", ...activeCastNames];
  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [weeklyBanished, setWeeklyBanished] = useState("");
  const [weeklyMurdered, setWeeklyMurdered] = useState("");
  const [bonusRedemption, setBonusRedemption] = useState("");
  const [bonusDoubleOrNothing, setBonusDoubleOrNothing] = useState(false);
  const [bonusShield, setBonusShield] = useState("");
  const [mainSubmitted, setMainSubmitted] = useState(false);
  const [isMainSubmitting, setIsMainSubmitting] = useState(false);

  const [jrName, setJrName] = useState("");
  const [jrEmail, setJrEmail] = useState("");
  const [jrWeeklyBanished, setJrWeeklyBanished] = useState("");
  const [jrWeeklyMurdered, setJrWeeklyMurdered] = useState("");
  const [jrBonusRedemption, setJrBonusRedemption] = useState("");
  const [jrBonusDoubleOrNothing, setJrBonusDoubleOrNothing] = useState(false);
  const [jrBonusShield, setJrBonusShield] = useState("");
  const [jrSubmitted, setJrSubmitted] = useState(false);
  const [isJrSubmitting, setIsJrSubmitting] = useState(false);

  const hasBonusSelection = (bonus: {
    redemptionRoulette?: string;
    doubleOrNothing?: boolean;
    shieldGambit?: string;
  }) =>
    Boolean(
      bonus.redemptionRoulette ||
        bonus.doubleOrNothing ||
        bonus.shieldGambit
    );

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
        return (
          player.league === "jr" && email && email === normalizedEmail
        );
      });
      if (matchByEmail) return matchByEmail;
    }
    if (normalizedName) {
      return gameState.players.find(
        (player) =>
          player.league === "jr" && normalize(player.name) === normalizedName
      );
    }
    return undefined;
  };

  const handleWeeklySubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!playerName || !playerEmail) {
      showToast("Please enter your name and email before submitting weekly votes.", "warning");
      return;
    }

    if (
      !weeklyBanished &&
      !weeklyMurdered &&
      !hasBonusSelection({
        redemptionRoulette: bonusRedemption,
        doubleOrNothing: bonusDoubleOrNothing,
        shieldGambit: bonusShield,
      })
    ) {
      showToast("Please select at least one weekly council or bonus prediction.", "warning");
      return;
    }

    const existingPlayer = findExistingPlayer("main");
    if (!existingPlayer) {
      showToast("We couldn't find your draft entry yet. Please submit your draft once first.", "error");
      return;
    }

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
        },
        league: "main",
      });
      showToast("Your weekly council vote has been submitted!", "success");
    } catch (err) {
      const message =
        typeof (err as Error)?.message === "string" && (err as Error).message.length
          ? (err as Error).message
          : "Weekly votes could not be submitted. Please try again.";
      console.warn("Weekly council submission failed:", err);
      showToast(message, "error");
    }

    setIsMainSubmitting(false);

    const body = encodeURIComponent(
      getWeeklyCouncilData(
        playerName,
        playerEmail,
        weeklyBanished,
        weeklyMurdered,
        {
          redemptionRoulette: bonusRedemption,
          doubleOrNothing: bonusDoubleOrNothing,
          shieldGambit: bonusShield,
        },
        "Main League"
      )
    );
    const subject = encodeURIComponent(`Traitors Weekly Council - ${playerName}`);
    window.location.href = `mailto:s.haarisshariff@gmail.com,haaris.shariff@universalorlando.com?subject=${subject}&body=${body}`;
    setMainSubmitted(true);
  };

  const handleJrWeeklySubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!jrName || !jrEmail) {
      showToast("Please enter your name and email before submitting Jr. League votes.", "warning");
      return;
    }

    if (
      !jrWeeklyBanished &&
      !jrWeeklyMurdered &&
      !hasBonusSelection({
        redemptionRoulette: jrBonusRedemption,
        doubleOrNothing: jrBonusDoubleOrNothing,
        shieldGambit: jrBonusShield,
      })
    ) {
      showToast("Please select at least one weekly council or bonus prediction.", "warning");
      return;
    }

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
        },
        league: "jr",
      });
      showToast("Your Jr. League vote has been submitted!", "success");
    } catch (err) {
      const message =
        typeof (err as Error)?.message === "string" && (err as Error).message.length
          ? (err as Error).message
          : "Weekly votes could not be submitted. Please try again.";
      console.warn("Jr. League weekly submission failed:", err);
      showToast(message, "error");
    }

    setIsJrSubmitting(false);

    const body = encodeURIComponent(
      getWeeklyCouncilData(
        jrName,
        jrEmail,
        jrWeeklyBanished,
        jrWeeklyMurdered,
        {
          redemptionRoulette: jrBonusRedemption,
          doubleOrNothing: jrBonusDoubleOrNothing,
          shieldGambit: jrBonusShield,
        },
        "Jr. League"
      )
    );
    const subject = encodeURIComponent(`Traitors Jr. League Council - ${jrName}`);
    window.location.href = `mailto:s.haarisshariff@gmail.com,haaris.shariff@universalorlando.com?subject=${subject}&body=${body}`;
    setJrSubmitted(true);
  };

  const mainPlayerMatch = findExistingPlayer("main");
  const mainScoreTotal = mainPlayerMatch
    ? calculatePlayerScore(gameState, mainPlayerMatch).total
    : null;
  const hasMainDouble = mainScoreTotal !== null && mainScoreTotal < 0;

  const jrPlayerMatch = findExistingJrPlayer();
  const jrScoreTotal = jrPlayerMatch
    ? calculatePlayerScore(gameState, jrPlayerMatch).total
    : null;
  const hasJrDouble = jrScoreTotal !== null && jrScoreTotal < 0;

  return (
    <div className="space-y-12">
      <div className="text-center space-y-3">
        <h2 className="text-3xl md:text-4xl gothic-font text-[color:var(--accent)] uppercase tracking-[0.22em]">
          Weekly Council
        </h2>
        <p className="text-xs text-zinc-500 uppercase tracking-[0.2em]">
          Submit your weekly predictions here
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] gap-8 items-start">
        <aside className="glass-panel p-6 rounded-3xl bg-black/40 space-y-5">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-[0.2em]">Bonus Game Rules</p>
            <h3 className="text-2xl gothic-font text-[color:var(--accent)] uppercase tracking-[0.2em] mt-2">
              Weekly Opportunities
            </h3>
          </div>
          <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
            <div className="soft-card soft-card-subtle border-amber-400/30 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200 font-semibold">
                🎲 Redemption Roulette
              </p>
              <p className="mt-2">
                Predict the next revealed traitor. +8 points if correct, but -1 if wrong. If your
                total score is negative, you automatically get a 2x boost (+16).
              </p>
            </div>
            <div className="soft-card soft-card-subtle border-indigo-400/30 bg-indigo-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-200 font-semibold">
                ⚡ Double or Nothing
              </p>
              <p className="mt-2">
                Opt in to double your weekly council stakes. Correct picks earn 2x points and misses
                are 2x penalties.
              </p>
            </div>
            <div className="soft-card soft-card-subtle border-sky-400/30 bg-sky-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-sky-200 font-semibold">
                🛡️ Shield Gambit
              </p>
              <p className="mt-2">
                Guess who wins the next shield. +5 points if correct, with an extra +3 bonus when
                you’re in the red.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex flex-col gap-12">
          <section className="glass-panel main-panel p-8 rounded-3xl lg:min-h-[620px] flex flex-col">
            <div className="mb-6 h-8" aria-hidden="true" />
            <div className="grid grid-cols-1 gap-8 flex-1 content-start">
              <div className="space-y-4 text-center lg:text-left">
                <h3 className="text-2xl md:text-3xl gothic-font text-[color:var(--accent)] uppercase tracking-[0.2em]">
                  Weekly Council Votes
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Already drafted? Submit your weekly banished and murdered predictions here.
                </p>
                {mainSubmitted && (
                  <div className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 text-xs uppercase tracking-[0.2em]">
                    Vote Submitted
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="main-name" className="sr-only">Your Name</label>
                    <input
                      id="main-name"
                      type="text"
                      placeholder="Name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full p-4 rounded-xl field-soft text-[color:var(--text)] focus:border-[color:var(--accent)] outline-none text-base text-center transition-colors"
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label htmlFor="main-email" className="sr-only">Your Email</label>
                    <input
                      id="main-email"
                      type="email"
                      placeholder="Email"
                      value={playerEmail}
                      onChange={(e) => setPlayerEmail(e.target.value)}
                      className="w-full p-4 rounded-xl field-soft text-[color:var(--text)] focus:border-[color:var(--accent)] outline-none text-base text-center transition-colors"
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label htmlFor="main-banished" className="block text-xs text-red-400 font-semibold mb-2 uppercase tracking-[0.18em] text-center">
                      Next Banished
                    </label>
                    <select
                      id="main-banished"
                      value={weeklyBanished}
                      onChange={(e) => setWeeklyBanished(e.target.value)}
                      className="w-full p-3.5 rounded-xl field-soft text-sm text-[color:var(--text)] text-center transition-colors"
                    >
                      <option value="">Select...</option>
                      {banishedOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="main-murdered" className="block text-xs text-fuchsia-400 font-semibold mb-2 uppercase tracking-[0.18em] text-center">
                      Next Murdered
                    </label>
                    <select
                      id="main-murdered"
                      value={weeklyMurdered}
                      onChange={(e) => setWeeklyMurdered(e.target.value)}
                      className="w-full p-3.5 rounded-xl field-soft text-sm text-[color:var(--text)] text-center transition-colors"
                    >
                      <option value="">Select...</option>
                      {murderOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="soft-card soft-card-subtle border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-black/25 to-black/60 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-amber-200 font-semibold uppercase tracking-[0.2em]">
                        🎲 Bonus Round
                      </p>
                      <p className="text-[11px] text-amber-100/70 uppercase tracking-[0.18em]">
                        Extra points, extra danger
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] border ${
                        hasMainDouble
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                          : "border-amber-400/30 bg-black/40 text-amber-200"
                      }`}
                    >
                      {hasMainDouble ? "2x Boost Active" : "2x Boost Locked"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Redemption Roulette doubles for negative scores. Shield Gambit grants an extra +3
                    if you're in the red. Double or Nothing amplifies weekly council stakes.
                  </p>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="main-redemption" className="block text-xs text-amber-300 font-semibold mb-2 uppercase tracking-[0.18em] text-center">
                        Redemption Roulette
                      </label>
                      <select
                        id="main-redemption"
                        value={bonusRedemption}
                        onChange={(e) => setBonusRedemption(e.target.value)}
                        className="w-full p-3.5 rounded-xl field-soft border-amber-500/40 text-sm text-[color:var(--text)] text-center transition-colors"
                      >
                        <option value="">Select...</option>
                        {activeCastNames.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center justify-between gap-3 rounded-xl soft-card soft-card-subtle border-amber-400/30 px-4 py-3 text-xs uppercase tracking-[0.18em] text-amber-100">
                      <span>Double or Nothing</span>
                      <input
                        type="checkbox"
                        checked={bonusDoubleOrNothing}
                        onChange={(e) => setBonusDoubleOrNothing(e.target.checked)}
                        className="h-4 w-4 rounded border-amber-300 text-amber-400 focus:ring-amber-300"
                      />
                    </label>
                  <div>
                    <label htmlFor="main-shield" className="block text-xs text-sky-300 font-semibold mb-2 uppercase tracking-[0.18em] text-center">
                      Shield Gambit
                    </label>
                    <select
                        id="main-shield"
                        value={bonusShield}
                        onChange={(e) => setBonusShield(e.target.value)}
                        className="w-full p-3.5 rounded-xl field-soft border-sky-500/40 text-sm text-[color:var(--text)] text-center transition-colors"
                      >
                        <option value="">Select...</option>
                        {activeCastNames.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleWeeklySubmit}
                  disabled={isMainSubmitting}
                  className="w-full px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-[0.2em] bg-[color:var(--accent-strong)] text-black border border-[color:var(--accent-strong)] shadow-[0_14px_34px_rgba(217,221,227,0.38)] hover:brightness-105 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  aria-busy={isMainSubmitting}
                >
                  {isMainSubmitting && <span className="loading-spinner" aria-hidden="true" />}
                  {isMainSubmitting ? "Submitting..." : "Submit Weekly Council"}
                </button>
              </div>
            </div>
          </section>

          <section className="glass-panel jr-panel p-8 rounded-3xl lg:min-h-[620px] flex flex-col">
          <div className="mb-6 h-8" aria-hidden="true" />
          <div className="grid grid-cols-1 gap-8 flex-1 content-start">
            <div className="space-y-4 text-center lg:text-left">
              <h3 className="text-2xl md:text-3xl gothic-font text-[color:var(--accent)] uppercase tracking-[0.2em]">
                Jr. League Weekly Council
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Missed the initial draft? You can still play each week by submitting your council
                predictions. No draft entry required.
              </p>
              {jrSubmitted && (
                <div className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 text-xs uppercase tracking-[0.2em]">
                  Vote Submitted
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="jr-name" className="sr-only">Your Name</label>
                  <input
                    id="jr-name"
                    type="text"
                    placeholder="Name"
                    value={jrName}
                    onChange={(e) => setJrName(e.target.value)}
                    className="w-full p-4 rounded-xl field-soft text-[color:var(--text)] focus:border-[color:var(--accent)] outline-none text-base text-center transition-colors"
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="jr-email" className="sr-only">Your Email</label>
                  <input
                    id="jr-email"
                    type="email"
                    placeholder="Email"
                    value={jrEmail}
                    onChange={(e) => setJrEmail(e.target.value)}
                    className="w-full p-4 rounded-xl field-soft text-[color:var(--text)] focus:border-[color:var(--accent)] outline-none text-base text-center transition-colors"
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="jr-banished" className="block text-xs text-red-400 font-semibold mb-2 uppercase tracking-[0.18em] text-center">
                    Next Banished
                  </label>
                  <select
                    id="jr-banished"
                    value={jrWeeklyBanished}
                    onChange={(e) => setJrWeeklyBanished(e.target.value)}
                    className="w-full p-3.5 rounded-xl field-soft text-sm text-[color:var(--text)] text-center transition-colors"
                  >
                    <option value="">Select...</option>
                    {banishedOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="jr-murdered" className="block text-xs text-fuchsia-400 font-semibold mb-2 uppercase tracking-[0.18em] text-center">
                    Next Murdered
                  </label>
                  <select
                    id="jr-murdered"
                    value={jrWeeklyMurdered}
                    onChange={(e) => setJrWeeklyMurdered(e.target.value)}
                    className="w-full p-3.5 rounded-xl field-soft text-sm text-[color:var(--text)] text-center transition-colors"
                  >
                    <option value="">Select...</option>
                    {murderOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="soft-card soft-card-subtle border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-black/25 to-black/60 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-amber-200 font-semibold uppercase tracking-[0.2em]">
                      🎲 Bonus Round
                    </p>
                    <p className="text-[11px] text-amber-100/70 uppercase tracking-[0.18em]">
                      Extra points, extra danger
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] border ${
                      hasJrDouble
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                        : "border-amber-400/30 bg-black/40 text-amber-200"
                    }`}
                  >
                    {hasJrDouble ? "2x Boost Active" : "2x Boost Locked"}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Redemption Roulette doubles for negative scores. Shield Gambit grants an extra +3
                  if you're in the red. Double or Nothing amplifies weekly council stakes.
                </p>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="jr-redemption" className="block text-xs text-amber-300 font-semibold mb-2 uppercase tracking-[0.18em] text-center">
                      Redemption Roulette
                    </label>
                    <select
                      id="jr-redemption"
                      value={jrBonusRedemption}
                      onChange={(e) => setJrBonusRedemption(e.target.value)}
                      className="w-full p-3.5 rounded-xl field-soft border-amber-500/40 text-sm text-[color:var(--text)] text-center transition-colors"
                    >
                      <option value="">Select...</option>
                      {activeCastNames.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-black/40 px-4 py-3 text-xs uppercase tracking-[0.18em] text-amber-100">
                    <span>Double or Nothing</span>
                    <input
                      type="checkbox"
                      checked={jrBonusDoubleOrNothing}
                      onChange={(e) => setJrBonusDoubleOrNothing(e.target.checked)}
                      className="h-4 w-4 rounded border-amber-300 text-amber-400 focus:ring-amber-300"
                    />
                  </label>
                  <div>
                    <label htmlFor="jr-shield" className="block text-xs text-sky-300 font-semibold mb-2 uppercase tracking-[0.18em] text-center">
                      Shield Gambit
                    </label>
                    <select
                      id="jr-shield"
                      value={jrBonusShield}
                      onChange={(e) => setJrBonusShield(e.target.value)}
                      className="w-full p-3.5 rounded-xl field-soft border-sky-500/40 text-sm text-[color:var(--text)] text-center transition-colors"
                    >
                      <option value="">Select...</option>
                      {activeCastNames.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      </select>
                    </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleJrWeeklySubmit}
                disabled={isJrSubmitting}
                className="w-full px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-[0.2em] bg-[color:var(--accent-strong)] text-black border border-[color:var(--accent-strong)] shadow-[0_14px_34px_rgba(217,221,227,0.38)] hover:brightness-105 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                aria-busy={isJrSubmitting}
              >
                {isJrSubmitting && <span className="loading-spinner" aria-hidden="true" />}
                {isJrSubmitting ? "Submitting..." : "Submit Jr. League Vote"}
              </button>
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
};

export default WeeklyCouncil;
