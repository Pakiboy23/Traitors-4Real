import React from "react";
import { formatScore } from "../src/utils/scoring";

export interface MvpHighlight {
  name: string;
  score: number;
  label: string;
  portraitUrl?: string;
}

interface WelcomeProps {
  onStart: () => void;
  mvp?: MvpHighlight | null;
  weeklyMvp?: MvpHighlight | null;
}

const ScoreCard: React.FC<{
  title: string;
  player?: MvpHighlight | null;
  valuePrefix?: string;
}> = ({ title, player, valuePrefix = "" }) => {
  if (!player) {
    return (
      <div className="soft-card soft-card-subtle rounded-3xl p-5 md:p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
          {title}
        </p>
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">No score data yet.</p>
      </div>
    );
  }

  return (
    <div className="soft-card rounded-3xl p-5 md:p-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
        {title}
      </p>
      <div className="mt-4 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full overflow-hidden border border-[color:var(--panel-border-strong)] bg-black/30 flex items-center justify-center">
          {player.portraitUrl ? (
            <img
              src={player.portraitUrl}
              alt={player.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-lg font-bold text-[color:var(--text-muted)]" aria-hidden="true">
              {player.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-[color:var(--text-muted)] uppercase tracking-[0.14em]">
            {player.label}
          </p>
          <p className="headline text-xl font-semibold truncate">{player.name}</p>
        </div>
      </div>
      <p className="mt-4 text-2xl font-extrabold text-[color:var(--accent)]">
        {valuePrefix}
        {formatScore(player.score)}
      </p>
    </div>
  );
};

const Welcome: React.FC<WelcomeProps> = ({ onStart, mvp, weeklyMvp }) => {
  return (
    <div className="space-y-8 md:space-y-10">
      <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5 md:gap-6">
        <div className="glass-panel p-6 sm:p-8 md:p-10">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border-strong)] bg-black/20 px-3 py-1 text-[10px] sm:text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
              Season 4 Intelligence Center
            </div>
            <h2 className="headline text-4xl sm:text-5xl lg:text-6xl leading-[1.04]">
              A cleaner way to run your league strategy.
            </h2>
            <p className="max-w-2xl text-base md:text-lg text-[color:var(--text-muted)] leading-relaxed">
              Draft your roster, submit weekly predictions, and monitor leader movement in one
              streamlined workspace designed for fast decisions.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={onStart}
                className="btn-primary px-7 md:px-9 py-3 md:py-3.5 text-xs md:text-sm"
              >
                Start Weekly Picks
              </button>
              <span className="status-pill">Optimized for mobile and desktop</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ScoreCard title="Season Leader" player={mvp} />
          <ScoreCard title="Latest Weekly Gain" player={weeklyMvp} valuePrefix="+" />
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article className="soft-card rounded-3xl p-5 md:p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            01. Draft Engine
          </p>
          <h3 className="headline text-xl mt-3">Structured submissions</h3>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--text-muted)]">
            Build your ten-player board with ranking and role assumptions, then lock picks with
            clear validation before submitting.
          </p>
        </article>

        <article className="soft-card rounded-3xl p-5 md:p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            02. Weekly Ops
          </p>
          <h3 className="headline text-xl mt-3">Single-week cadence</h3>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--text-muted)]">
            Submit banished and murdered predictions plus bonus games each week without clutter or
            duplicate entry confusion.
          </p>
        </article>

        <article className="soft-card rounded-3xl p-5 md:p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            03. Score Clarity
          </p>
          <h3 className="headline text-xl mt-3">Transparent standings</h3>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--text-muted)]">
            Expand any player for scoring detail, penalties, and week-over-week trend so results are
            easy to audit.
          </p>
        </article>
      </section>
    </div>
  );
};

export default Welcome;
