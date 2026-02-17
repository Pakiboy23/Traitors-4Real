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
  featured?: boolean;
}> = ({ title, player, valuePrefix = "", featured = false }) => {
  if (!player) {
    return (
      <div className="soft-card soft-card-subtle rounded-3xl p-5 md:p-6 text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
          {title}
        </p>
        <p className="mt-3 text-base text-[color:var(--text-muted)]">No score data yet.</p>
      </div>
    );
  }

  return (
    <div className={`${featured ? "leader-spotlight" : "soft-card"} rounded-3xl p-5 md:p-6 text-center`}>
      <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
        {title}
      </p>
      {featured && (
        <p className="mt-1 text-sm uppercase tracking-[0.14em] text-[color:var(--accent-strong)]">
          Dominating the castle
        </p>
      )}
      <div className="mt-4 flex items-center justify-center gap-4">
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
          <p className="text-base text-[color:var(--text-muted)] uppercase tracking-[0.12em]">
            {player.label}
          </p>
          <p className={`${featured ? "leader-name text-2xl md:text-3xl" : "text-xl"} headline font-semibold truncate`}>{player.name}</p>
        </div>
      </div>
      <p className={`${featured ? "text-3xl md:text-4xl text-[color:var(--accent-strong)]" : "text-2xl text-[color:var(--accent)]"} mt-4 font-extrabold`}>
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
          <div className="space-y-5 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border-strong)] bg-black/20 px-3 py-1.5 text-sm md:text-base uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
              Season 4 Round Table Intelligence
            </div>
            <h2 className="headline text-4xl sm:text-5xl lg:text-6xl leading-[1.04]">
              Run your league like a Traitor.
            </h2>
            <p className="max-w-2xl text-base md:text-lg text-[color:var(--text-muted)] leading-relaxed">
              Draft your castle roster, submit banishment and murder calls each week, and monitor
              traitor-era power shifts in one high-clarity workspace.
            </p>
            <div className="flex w-full items-center justify-center pt-2">
              <button
                onClick={onStart}
                className="btn-primary hero-enter-btn text-sm md:text-base"
              >
                ENTER THE CASTLE
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ScoreCard title="Season Leader" player={mvp} featured />
          <ScoreCard title="Latest Weekly Gain" player={weeklyMvp} valuePrefix="+" />
          <div className="text-center">
            <span className="status-pill">Optimized for mobile and desktop</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article className="soft-card rounded-3xl p-5 md:p-6 text-center">
          <p className="text-sm uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            01. Draft Dossier
          </p>
          <h3 className="headline text-xl mt-3">Structured submissions</h3>
          <p className="mt-3 text-base leading-relaxed text-[color:var(--text-muted)]">
            Build your ten-player board with ranking and role assumptions, then lock picks with
            clear validation before submitting.
          </p>
        </article>

        <article className="soft-card rounded-3xl p-5 md:p-6 text-center">
          <p className="text-sm uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            02. Council Predictions
          </p>
          <h3 className="headline text-xl mt-3">Single-week cadence</h3>
          <p className="mt-3 text-base leading-relaxed text-[color:var(--text-muted)]">
            Submit banished and murdered predictions plus bonus games each week without clutter or
            duplicate entry confusion.
          </p>
        </article>

        <article className="soft-card rounded-3xl p-5 md:p-6 text-center">
          <p className="text-sm uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            03. Castle Ledger
          </p>
          <h3 className="headline text-xl mt-3">Transparent standings</h3>
          <p className="mt-3 text-base leading-relaxed text-[color:var(--text-muted)]">
            Expand any player for scoring detail, penalties, and week-over-week trend so results are
            easy to audit.
          </p>
        </article>
      </section>
    </div>
  );
};

export default Welcome;
