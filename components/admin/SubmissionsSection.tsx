import React from "react";
import { PlayerEntry, WeeklySubmissionHistoryEntry } from "../../types";
import { SubmissionRecord } from "../../services/pocketbase";

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
            const match = findPlayerMatch(players, submission, league);
            const canMerge = Boolean(match) || league === "jr";
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
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-muted)] mt-1">
                      {createdLabel ? `Submitted ${createdLabel}` : "Submitted"}
                      {match ? ` · Match by ${match.type}` : league === "jr" ? " · New Jr player" : " · No match"}
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
                      Merge
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
