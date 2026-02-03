import React, { useState } from "react";
import { CAST_NAMES, GameState, PlayerEntry } from "../types";
import { submitWeeklyCouncilVote } from "../services/pocketbase";
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
  leagueLabel?: string
) => {
  const header = leagueLabel
    ? `TRAITORS WEEKLY COUNCIL - ${leagueLabel}`
    : "TRAITORS WEEKLY COUNCIL";
  return `${header}\nPlayer: ${name}\nEmail: ${email}\n\n=== WEEKLY COUNCIL ===\nNext Banished: ${banished || "None"}\nNext Murdered: ${murdered || "None"}`;
};

const WeeklyCouncil: React.FC<WeeklyCouncilProps> = ({ gameState, onAddEntry }) => {
  const { showToast } = useToast();
  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [weeklyBanished, setWeeklyBanished] = useState("");
  const [weeklyMurdered, setWeeklyMurdered] = useState("");
  const [mainSubmitted, setMainSubmitted] = useState(false);
  const [isMainSubmitting, setIsMainSubmitting] = useState(false);

  const [jrName, setJrName] = useState("");
  const [jrEmail, setJrEmail] = useState("");
  const [jrWeeklyBanished, setJrWeeklyBanished] = useState("");
  const [jrWeeklyMurdered, setJrWeeklyMurdered] = useState("");
  const [jrSubmitted, setJrSubmitted] = useState(false);
  const [isJrSubmitting, setIsJrSubmitting] = useState(false);

  const findExistingPlayer = () => {
    if (!playerName && !playerEmail) return undefined;
    const normalizedEmail = normalize(playerEmail);
    const normalizedName = normalize(playerName);
    if (normalizedEmail) {
      const matchByEmail = gameState.players.find((player) => {
        const email = normalize(player.email || "");
        return email && email === normalizedEmail;
      });
      if (matchByEmail) return matchByEmail;
    }
    if (normalizedName) {
      return gameState.players.find(
        (player) => normalize(player.name) === normalizedName
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

    if (!weeklyBanished && !weeklyMurdered) {
      showToast("Please select at least one weekly council prediction.", "warning");
      return;
    }

    const existingPlayer = findExistingPlayer();
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

    if (!jrWeeklyBanished && !jrWeeklyMurdered) {
      showToast("Please select at least one weekly council prediction.", "warning");
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
        "Jr. League"
      )
    );
    const subject = encodeURIComponent(`Traitors Jr. League Council - ${jrName}`);
    window.location.href = `mailto:s.haarisshariff@gmail.com,haaris.shariff@universalorlando.com?subject=${subject}&body=${body}`;
    setJrSubmitted(true);
  };

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

      <div className="flex flex-col lg:flex-row lg:gap-x-20 lg:items-start">
        <section className="glass-panel main-panel p-8 rounded-3xl border border-[color:var(--accent)]/30 lg:min-h-[620px] flex flex-col lg:flex-1">
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
                    className="w-full p-4 rounded-xl bg-[color:var(--input-bg)] border border-[color:var(--input-border)] text-[color:var(--text)] focus:border-[color:var(--accent)] outline-none text-base text-center transition-colors"
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
                    className="w-full p-4 rounded-xl bg-[color:var(--input-bg)] border border-[color:var(--input-border)] text-[color:var(--text)] focus:border-[color:var(--accent)] outline-none text-base text-center transition-colors"
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
                    className="w-full p-3.5 rounded-xl bg-[color:var(--input-bg)] border border-[color:var(--input-border)] text-sm text-[color:var(--text)] text-center transition-colors"
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
                  <label htmlFor="main-murdered" className="block text-xs text-fuchsia-400 font-semibold mb-2 uppercase tracking-[0.18em] text-center">
                    Next Murdered
                  </label>
                  <select
                    id="main-murdered"
                    value={weeklyMurdered}
                    onChange={(e) => setWeeklyMurdered(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-[color:var(--input-bg)] border border-[color:var(--input-border)] text-sm text-[color:var(--text)] text-center transition-colors"
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

        <div
          className="w-full lg:hidden"
          style={{ height: "64px", flexShrink: 0 }}
          aria-hidden="true"
        />

        <section className="glass-panel jr-panel p-8 rounded-3xl border border-[color:var(--accent)]/20 lg:min-h-[620px] flex flex-col lg:flex-1">
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
                    className="w-full p-4 rounded-xl bg-[color:var(--input-bg)] border border-[color:var(--input-border)] text-[color:var(--text)] focus:border-[color:var(--accent)] outline-none text-base text-center transition-colors"
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
                    className="w-full p-4 rounded-xl bg-[color:var(--input-bg)] border border-[color:var(--input-border)] text-[color:var(--text)] focus:border-[color:var(--accent)] outline-none text-base text-center transition-colors"
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
                    className="w-full p-3.5 rounded-xl bg-[color:var(--input-bg)] border border-[color:var(--input-border)] text-sm text-[color:var(--text)] text-center transition-colors"
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
                  <label htmlFor="jr-murdered" className="block text-xs text-fuchsia-400 font-semibold mb-2 uppercase tracking-[0.18em] text-center">
                    Next Murdered
                  </label>
                  <select
                    id="jr-murdered"
                    value={jrWeeklyMurdered}
                    onChange={(e) => setJrWeeklyMurdered(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-[color:var(--input-bg)] border border-[color:var(--input-border)] text-sm text-[color:var(--text)] text-center transition-colors"
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
  );
};

export default WeeklyCouncil;
