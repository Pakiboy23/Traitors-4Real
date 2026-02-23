import React from "react";
import {
  BonusGamePredictions,
  BonusPointBreakdownEntry,
  FinalePredictions,
  PlayerEntry,
  WeeklySubmissionHistoryEntry,
} from "../../types";
import { SubmissionRecord } from "../../services/pocketbase";

type SubmissionBonusScore = {
  hasResults: boolean;
  points: number;
  breakdown: BonusPointBreakdownEntry[];
};

interface SubmissionsSectionProps {
  pocketbaseUrl: string;
  players: PlayerEntry[];
  submissions: SubmissionRecord[];
  isLoadingSubmissions: boolean;
  submissionsError: string | null;
  onRefreshSubmissions: () => void;
  onMergeAllSubmissions: () => void;
  mergeAllDisabled: boolean;
  getSubmissionLeague: (submission: SubmissionRecord) => "main" | "jr";
  getSubmissionBonusGames: (
    submission: SubmissionRecord
  ) => BonusGamePredictions | undefined;
  getSubmissionFinalePredictions: (
    submission: SubmissionRecord
  ) => FinalePredictions | undefined;
  isSubmissionLateForFinale: (submission: SubmissionRecord) => boolean;
  getSubmissionBonusScore: (
    submission: SubmissionRecord
  ) => SubmissionBonusScore;
  findPlayerMatch: (
    players: PlayerEntry[],
    submission: SubmissionRecord,
    league: "main" | "jr"
  ) => { index: number; type: "id" | "email" | "name" } | null;
  onMergeSubmission: (submission: SubmissionRecord) => void;
  onDismissSubmission: (submission: SubmissionRecord) => void;
  history: WeeklySubmissionHistoryEntry[];
  visibleHistory: WeeklySubmissionHistoryEntry[];
  showAllHistory: boolean;
  canToggleShowAllHistory: boolean;
  onToggleShowAllHistory: () => void;
  onClearHistory: () => void;
}

const renderBonusSummary = (bonusGames?: BonusGamePredictions) => {
  const traitorTrio = Array.isArray(bonusGames?.traitorTrio)
    ? bonusGames.traitorTrio.filter(Boolean)
    : [];
  const doubleOrNothing =
    bonusGames?.doubleOrNothing === true
      ? "On"
      : bonusGames?.doubleOrNothing === false
        ? "Off"
        : "Not set";

  return (
    <p className="text-xs text-[color:var(--text-muted)] mt-1">
      Bonus: <span className="text-[color:var(--text)]">Roulette {bonusGames?.redemptionRoulette || "None"}</span> ·
      <span className="text-[color:var(--text)]"> Shield {bonusGames?.shieldGambit || "None"}</span> ·
      <span className="text-[color:var(--text)]"> Double {doubleOrNothing}</span> ·
      <span className="text-[color:var(--text)]">
        {" "}
        Trio {traitorTrio.length > 0 ? traitorTrio.join(", ") : "None"}
      </span>
    </p>
  );
};

const renderFinaleSummary = (finalePredictions?: FinalePredictions) => {
  if (!finalePredictions) return null;
  return (
    <p className="text-xs text-[color:var(--text-muted)] mt-1">
      Finale: <span className="text-[color:var(--text)]">Winner {finalePredictions.finalWinner || "None"}</span> ·
      <span className="text-[color:var(--text)]">
        {" "}
        Last Faithful {finalePredictions.lastFaithfulStanding || "None"}
      </span>{" "}
      ·
      <span className="text-[color:var(--text)]">
        {" "}
        Last Traitor {finalePredictions.lastTraitorStanding || "None"}
      </span>{" "}
      ·
      <span className="text-[color:var(--text)]">
        {" "}
        Pot{" "}
        {typeof finalePredictions.finalPotEstimate === "number"
          ? finalePredictions.finalPotEstimate
          : "None"}
      </span>
    </p>
  );
};

const formatPoints = (value: number) => {
  const normalized = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return value > 0 ? `+${normalized}` : normalized;
};

const formatBreakdown = (items: BonusPointBreakdownEntry[]) => {
  if (items.length === 0) return "No scored bonus picks.";
  return items.map((item) => `${item.label} ${formatPoints(item.points)}`).join(" · ");
};

const renderBonusPointsPreview = (score: SubmissionBonusScore) => {
  if (!score.hasResults) {
    return (
      <p className="text-xs text-[color:var(--text-muted)] mt-1">
        Bonus points: <span className="text-[color:var(--text)]">Pending results</span>
      </p>
    );
  }
  return (
    <p className="text-xs text-[color:var(--text-muted)] mt-1">
      Bonus points: <span className="text-[color:var(--text)]">{formatPoints(score.points)}</span> ·{" "}
      <span className="text-[color:var(--text)]">{formatBreakdown(score.breakdown)}</span>
    </p>
  );
};

const renderHistoryBonusPoints = (entry: WeeklySubmissionHistoryEntry) => {
  if (typeof entry.bonusPoints !== "number") {
    return (
      <p className="text-xs text-[color:var(--text-muted)] mt-1">
        Bonus points: <span className="text-[color:var(--text)]">Pending results</span>
      </p>
    );
  }
  const breakdown = Array.isArray(entry.bonusPointBreakdown)
    ? entry.bonusPointBreakdown
    : [];
  return (
    <p className="text-xs text-[color:var(--text-muted)] mt-1">
      Bonus points: <span className="text-[color:var(--text)]">{formatPoints(entry.bonusPoints)}</span> ·{" "}
      <span className="text-[color:var(--text)]">{formatBreakdown(breakdown)}</span>
    </p>
  );
};

const SubmissionsSection: React.FC<SubmissionsSectionProps> = ({
  pocketbaseUrl,
  players,
  submissions,
  isLoadingSubmissions,
  submissionsError,
  onRefreshSubmissions,
  onMergeAllSubmissions,
  mergeAllDisabled,
  getSubmissionLeague,
  getSubmissionBonusGames,
  getSubmissionFinalePredictions,
  isSubmissionLateForFinale,
  getSubmissionBonusScore,
  findPlayerMatch,
  onMergeSubmission,
  onDismissSubmission,
  history,
  visibleHistory,
  showAllHistory,
  canToggleShowAllHistory,
  onToggleShowAllHistory,
  onClearHistory,
}) => {
  return (
    <div className="space-y-5">
      <section className="soft-card rounded-3xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Incoming Votes</p>
            <h3 className="headline text-2xl">Weekly submissions</h3>
            <p className="text-sm text-[color:var(--text-muted)]">API endpoint: {pocketbaseUrl}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onRefreshSubmissions} className="btn-secondary px-4 text-[11px]">
              Refresh
            </button>
            <button
              type="button"
              onClick={onMergeAllSubmissions}
              disabled={mergeAllDisabled}
              className={`px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.14em] font-semibold ${
                mergeAllDisabled
                  ? "border border-[color:var(--panel-border)] text-[color:var(--text-muted)] cursor-not-allowed"
                  : "btn-primary"
              }`}
            >
              Merge All
            </button>
          </div>
        </div>

        {isLoadingSubmissions && <p className="text-sm text-[color:var(--text-muted)]">Loading submissions...</p>}
        {submissionsError && <p className="text-sm text-[color:var(--danger)]">{submissionsError}</p>}
        {!isLoadingSubmissions && submissions.length === 0 && (
          <p className="text-sm text-[color:var(--text-muted)]">No submissions yet.</p>
        )}

        <div className="space-y-3">
          {submissions.map((submission) => {
            const league = getSubmissionLeague(submission);
            const bonusGames = getSubmissionBonusGames(submission);
            const finalePredictions = getSubmissionFinalePredictions(submission);
            const bonusScore = getSubmissionBonusScore(submission);
            const match = findPlayerMatch(players, submission, league);
            const isLate = isSubmissionLateForFinale(submission);
            const canMerge = (Boolean(match) || league === "jr") && !isLate;
            const createdLabel = submission.created ? new Date(submission.created).toLocaleString() : "";
            return (
              <article key={submission.id} className="soft-card soft-card-subtle rounded-2xl p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)]">
                      {submission.name}
                      {submission.email && (
                        <span className="text-xs text-[color:var(--text-muted)] ml-2">{submission.email}</span>
                      )}
                    </p>
                    <p className="text-xs text-[color:var(--text-muted)] mt-1">
                      Banished: <span className="text-[color:var(--text)]">{submission.weeklyBanished || "None"}</span> ·
                      Murdered: <span className="text-[color:var(--text)]">{submission.weeklyMurdered || "None"}</span>
                    </p>
                    {renderBonusSummary(bonusGames)}
                    {renderFinaleSummary(finalePredictions)}
                    {renderBonusPointsPreview(bonusScore)}
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-muted)] mt-1">
                      {createdLabel ? `Submitted ${createdLabel}` : "Submitted"}
                      {match ? ` · Match by ${match.type}` : league === "jr" ? " · New Jr player" : " · No match"}
                      {isLate ? " · Late (after finale lock)" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onMergeSubmission(submission)}
                      disabled={!canMerge}
                      className={`px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.14em] font-semibold ${
                        canMerge
                          ? "bg-[color:var(--success)] text-black"
                          : "border border-[color:var(--panel-border)] text-[color:var(--text-muted)] cursor-not-allowed"
                      }`}
                    >
                      {isLate ? "Locked" : "Merge"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissSubmission(submission)}
                      className="btn-secondary px-4 text-[11px] border-[color:var(--danger)]/45 text-[color:var(--danger)]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="soft-card rounded-3xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Merge Log</p>
            <h3 className="headline text-2xl">Merged history</h3>
          </div>
          <div className="flex gap-2">
            {canToggleShowAllHistory && (
              <button type="button" onClick={onToggleShowAllHistory} className="btn-secondary px-4 text-[11px]">
                {showAllHistory ? "Recent" : "All"}
              </button>
            )}
            {history.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="btn-secondary px-4 text-[11px] border-[color:var(--danger)]/45 text-[color:var(--danger)]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">No merged submissions yet.</p>
        ) : (
          <div className="space-y-3">
            {visibleHistory.map((entry) => {
              const mergedLabel = entry.mergedAt ? new Date(entry.mergedAt).toLocaleString() : "";
              const createdLabel = entry.created ? new Date(entry.created).toLocaleString() : "";
              return (
                <article key={entry.id} className="soft-card soft-card-subtle rounded-2xl p-4">
                  <p className="text-sm font-semibold text-[color:var(--text)]">
                    {entry.name}
                    {entry.email && <span className="text-xs text-[color:var(--text-muted)] ml-2">{entry.email}</span>}
                  </p>
                  <p className="text-xs text-[color:var(--text-muted)] mt-1">
                    Banished: <span className="text-[color:var(--text)]">{entry.weeklyBanished || "None"}</span> ·
                    Murdered: <span className="text-[color:var(--text)]">{entry.weeklyMurdered || "None"}</span>
                  </p>
                  {renderBonusSummary(entry.bonusGames)}
                  {renderFinaleSummary(entry.finalePredictions)}
                  {renderHistoryBonusPoints(entry)}
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-muted)] mt-1">
                    {createdLabel ? `Submitted ${createdLabel}` : "Submitted"}
                    {mergedLabel ? ` · Merged ${mergedLabel}` : ""}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default SubmissionsSection;
