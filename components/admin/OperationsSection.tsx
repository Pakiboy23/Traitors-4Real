import React from "react";
import { COUNCIL_LABELS, WeeklyScoreSnapshot } from "../../types";
import { LIMITS } from "../../src/utils/scoringConstants";
import { formatScore } from "../../src/utils/scoring";

interface OperationsSectionProps {
  banishedOptions: string[];
  murderOptions: string[];
  activeCastNames: string[];
  nextBanished: string;
  nextMurdered: string;
  bonusResults: {
    redemptionRoulette?: string;
    shieldGambit?: string;
  };
  onSetNextBanished: (value: string) => void;
  onSetNextMurdered: (value: string) => void;
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
  bonusResults,
  onSetNextBanished,
  onSetNextMurdered,
  onUpdateBonusResult,
  scoreHistory,
  visibleScoreHistory,
  showAllScoreHistory,
  onToggleShowAllScoreHistory,
  onArchiveWeeklyScores,
  getScoreTopper,
}) => {
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
              return (
                <article key={snapshot.id} className="soft-card soft-card-subtle rounded-2xl p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text)]">{snapshot.label}</p>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-muted)] mt-1">
                        Archived {new Date(snapshot.createdAt).toLocaleString()}
                      </p>
                      {(weeklyResults?.nextBanished ||
                        weeklyResults?.nextMurdered ||
                        weeklyResults?.bonusGames?.redemptionRoulette ||
                        weeklyResults?.bonusGames?.shieldGambit) && (
                        <p className="text-xs text-[color:var(--text-muted)] mt-2">
                          {weeklyResults?.nextBanished ? `Banished: ${weeklyResults.nextBanished}` : ""}
                          {weeklyResults?.nextBanished && weeklyResults?.nextMurdered ? " • " : ""}
                          {weeklyResults?.nextMurdered ? `Murdered: ${weeklyResults.nextMurdered}` : ""}
                          {(weeklyResults?.nextBanished || weeklyResults?.nextMurdered) &&
                          (weeklyResults?.bonusGames?.redemptionRoulette || weeklyResults?.bonusGames?.shieldGambit)
                            ? " • "
                            : ""}
                          {weeklyResults?.bonusGames?.redemptionRoulette
                            ? `Roulette: ${weeklyResults.bonusGames.redemptionRoulette}`
                            : ""}
                          {weeklyResults?.bonusGames?.redemptionRoulette &&
                          weeklyResults?.bonusGames?.shieldGambit
                            ? " • "
                            : ""}
                          {weeklyResults?.bonusGames?.shieldGambit
                            ? `Shield: ${weeklyResults.bonusGames.shieldGambit}`
                            : ""}
                        </p>
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
