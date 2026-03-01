import React from "react";
import {
  COUNCIL_LABELS,
  FinaleConfig,
  FinaleResults,
  WeeklyScoreSnapshot,
} from "../../types";
import { LIMITS } from "../../src/utils/scoringConstants";
import { formatScore } from "../../src/utils/scoring";

interface OperationsSectionProps {
  banishedOptions: string[];
  murderOptions: string[];
  activeCastNames: string[];
  nextBanished: string;
  nextMurdered: string;
  finaleConfig: FinaleConfig;
  finaleResults: FinaleResults;
  bonusResults: {
    redemptionRoulette?: string;
    shieldGambit?: string;
  };
  onSetNextBanished: (value: string) => void;
  onSetNextMurdered: (value: string) => void;
  onSetFinaleEnabled: (enabled: boolean) => void;
  onSetFinaleLabel: (value: string) => void;
  onSetFinaleLockAt: (value: string) => void;
  onSetFinaleResult: (
    key: "finalWinner" | "lastFaithfulStanding" | "lastTraitorStanding",
    value: string
  ) => void;
  onSetFinalePotValue: (value: number | null) => void;
  onUpdateBonusResult: (
    key: "redemptionRoulette" | "shieldGambit",
    value: string
  ) => void;
  scoreHistory: WeeklyScoreSnapshot[];
  visibleScoreHistory: WeeklyScoreSnapshot[];
  showAllScoreHistory: boolean;
  onToggleShowAllScoreHistory: () => void;
  onArchiveWeeklyScores: () => void;
  getScoreTopper: (snapshot: WeeklyScoreSnapshot) => {
    name: string;
    score: number;
  } | null;
}

const OperationsSection: React.FC<OperationsSectionProps> = ({
  banishedOptions,
  murderOptions,
  activeCastNames,
  nextBanished,
  nextMurdered,
  finaleConfig,
  finaleResults,
  bonusResults,
  onSetNextBanished,
  onSetNextMurdered,
  onSetFinaleEnabled,
  onSetFinaleLabel,
  onSetFinaleLockAt,
  onSetFinaleResult,
  onSetFinalePotValue,
  onUpdateBonusResult,
  scoreHistory,
  visibleScoreHistory,
  showAllScoreHistory,
  onToggleShowAllScoreHistory,
  onArchiveWeeklyScores,
  getScoreTopper,
}) => {
  const toLocalDateTimeValue = (value: string) => {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return "";
    const date = new Date(parsed);
    const pad = (input: number) => String(input).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };
  const finaleOutcomeOptions = Array.from(
    new Set(
      [
        ...activeCastNames,
        finaleResults.finalWinner,
        finaleResults.lastFaithfulStanding,
        finaleResults.lastTraitorStanding,
      ].filter((member): member is string => Boolean(member))
    )
  );

  return (
    <div className="space-y-5">
      <section className="soft-card rounded-3xl p-5 md:p-6 space-y-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Weekly Outcomes</p>
          <h3 className="headline text-2xl">Episode results</h3>
          <p className="text-sm text-[color:var(--text-muted)]">
            These values are used to score {COUNCIL_LABELS.weekly.toLowerCase()} picks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">
              Next Banished
            </label>
            <select
              value={nextBanished}
              onChange={(e) => onSetNextBanished(e.target.value)}
              className="w-full field-soft p-3 text-sm"
            >
              <option value="">Select...</option>
              {banishedOptions.map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">
              Next Murdered
            </label>
            <select
              value={nextMurdered}
              onChange={(e) => onSetNextMurdered(e.target.value)}
              className="w-full field-soft p-3 text-sm"
            >
              <option value="">Select...</option>
              {murderOptions.map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="soft-card soft-card-subtle rounded-2xl p-4 space-y-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Bonus Outcomes</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">
                Redemption Roulette
              </label>
              <select
                value={bonusResults.redemptionRoulette ?? ""}
                onChange={(e) => onUpdateBonusResult("redemptionRoulette", e.target.value)}
                className="w-full field-soft p-3 text-sm"
              >
                <option value="">Select...</option>
                {activeCastNames.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">
                Shield Gambit
              </label>
              <select
                value={bonusResults.shieldGambit ?? ""}
                onChange={(e) => onUpdateBonusResult("shieldGambit", e.target.value)}
                className="w-full field-soft p-3 text-sm"
              >
                <option value="">Select...</option>
                {activeCastNames.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="soft-card soft-card-subtle rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
              Finale Control
            </p>
            <button
              type="button"
              onClick={() => onSetFinaleEnabled(!finaleConfig.enabled)}
              className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-[0.14em] font-semibold ${
                finaleConfig.enabled ? "bg-[color:var(--accent)] text-black" : "btn-secondary"
              }`}
            >
              {finaleConfig.enabled ? "Enabled" : "Disabled"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">
                Finale Label
              </label>
              <input
                type="text"
                value={finaleConfig.label}
                onChange={(e) => onSetFinaleLabel(e.target.value)}
                className="w-full field-soft p-3 text-sm"
                placeholder="Finale Gauntlet"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">
                Lock Time
              </label>
              <input
                type="datetime-local"
                value={toLocalDateTimeValue(finaleConfig.lockAt)}
                onChange={(e) => {
                  const next = e.target.value ? new Date(e.target.value) : null;
                  onSetFinaleLockAt(
                    next && !Number.isNaN(next.getTime()) ? next.toISOString() : finaleConfig.lockAt
                  );
                }}
                className="w-full field-soft p-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">
                Final Winner
              </label>
              <select
                value={finaleResults.finalWinner ?? ""}
                onChange={(e) => onSetFinaleResult("finalWinner", e.target.value)}
                className="w-full field-soft p-3 text-sm"
              >
                <option value="">Select...</option>
                {finaleOutcomeOptions.map((member) => (
                  <option key={`finale-final-winner-${member}`} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">
                Last Faithful Standing
              </label>
              <select
                value={finaleResults.lastFaithfulStanding ?? ""}
                onChange={(e) => onSetFinaleResult("lastFaithfulStanding", e.target.value)}
                className="w-full field-soft p-3 text-sm"
              >
                <option value="">Select...</option>
                {finaleOutcomeOptions.map((member) => (
                  <option key={`finale-last-faithful-${member}`} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">
                Last Traitor Standing
              </label>
              <select
                value={finaleResults.lastTraitorStanding ?? ""}
                onChange={(e) => onSetFinaleResult("lastTraitorStanding", e.target.value)}
                className="w-full field-soft p-3 text-sm"
              >
                <option value="">Select...</option>
                {finaleOutcomeOptions.map((member) => (
                  <option key={`finale-last-traitor-${member}`} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">
                Final Pot Value
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={
                  typeof finaleResults.finalPotValue === "number"
                    ? String(finaleResults.finalPotValue)
                    : ""
                }
                onChange={(e) => {
                  const value = e.target.value.trim();
                  if (!value.length) {
                    onSetFinalePotValue(null);
                    return;
                  }
                  const parsed = Number(value);
                  onSetFinalePotValue(Number.isFinite(parsed) ? parsed : null);
                }}
                className="w-full field-soft p-3 text-sm"
                placeholder="e.g. 75000"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="soft-card rounded-3xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Score Archives</p>
            <h3 className="headline text-2xl">Weekly snapshots</h3>
          </div>
          <div className="flex gap-2">
            {scoreHistory.length > LIMITS.SCORE_HISTORY_DEFAULT_DISPLAY && (
              <button
                type="button"
                onClick={onToggleShowAllScoreHistory}
                className="btn-secondary px-4 text-[11px]"
              >
                {showAllScoreHistory ? "Recent" : "All"}
              </button>
            )}
            <button type="button" onClick={onArchiveWeeklyScores} className="btn-primary px-4 text-[11px]">
              Archive Week
            </button>
          </div>
        </div>

        {scoreHistory.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            No weekly snapshots yet. Archive after each episode to track progress.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleScoreHistory.map((snapshot) => {
              const topper = getScoreTopper(snapshot);
              const weeklyResults = snapshot.weeklyResults;
              const outcomeSummaryParts: string[] = [];
              if (weeklyResults?.nextBanished) {
                outcomeSummaryParts.push(`Banished: ${weeklyResults.nextBanished}`);
              }
              if (weeklyResults?.nextMurdered) {
                outcomeSummaryParts.push(`Murdered: ${weeklyResults.nextMurdered}`);
              }
              if (weeklyResults?.bonusGames?.redemptionRoulette) {
                outcomeSummaryParts.push(
                  `Roulette: ${weeklyResults.bonusGames.redemptionRoulette}`
                );
              }
              if (weeklyResults?.bonusGames?.shieldGambit) {
                outcomeSummaryParts.push(
                  `Shield: ${weeklyResults.bonusGames.shieldGambit}`
                );
              }
              if (weeklyResults?.finaleResults?.finalWinner) {
                outcomeSummaryParts.push(
                  `Final Winner: ${weeklyResults.finaleResults.finalWinner}`
                );
              }
              if (weeklyResults?.finaleResults?.lastFaithfulStanding) {
                outcomeSummaryParts.push(
                  `Last Faithful: ${weeklyResults.finaleResults.lastFaithfulStanding}`
                );
              }
              if (weeklyResults?.finaleResults?.lastTraitorStanding) {
                outcomeSummaryParts.push(
                  `Last Traitor: ${weeklyResults.finaleResults.lastTraitorStanding}`
                );
              }
              if (typeof weeklyResults?.finaleResults?.finalPotValue === "number") {
                outcomeSummaryParts.push(
                  `Pot: $${weeklyResults.finaleResults.finalPotValue.toLocaleString()}`
                );
              }
              return (
                <article key={snapshot.id} className="soft-card soft-card-subtle rounded-2xl p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text)]">{snapshot.label}</p>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-muted)] mt-1">
                        Archived {new Date(snapshot.createdAt).toLocaleString()}
                      </p>
                      {outcomeSummaryParts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {outcomeSummaryParts.map((part, idx) => (
                            <span
                              key={`${snapshot.id}-outcome-${idx}`}
                              className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-[color:var(--text-muted)]"
                            >
                              {part}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                      {topper ? `Top: ${topper.name} (${formatScore(topper.score)})` : "Top: —"}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default OperationsSection;
