import type { PublicWeeklyRecap } from "../src/utils/weeklyRecap";
import { formatScore } from "../src/utils/scoring";

const resultValue = (value: string | null) => value || "—";

const Movement = ({
  weekDelta,
  rankDelta,
}: {
  weekDelta: number | null;
  rankDelta: number | null;
}) => {
  if (weekDelta === null && (rankDelta === null || rankDelta === 0)) {
    return <span className="recap-delta">—</span>;
  }
  const points =
    weekDelta === null
      ? null
      : weekDelta > 0
        ? `+${formatScore(weekDelta)}`
        : weekDelta < 0
          ? `−${formatScore(Math.abs(weekDelta))}`
          : "0";
  const rank =
    rankDelta === null || rankDelta === 0
      ? null
      : rankDelta > 0
        ? `▲${rankDelta}`
        : `▼${Math.abs(rankDelta)}`;
  const direction = (weekDelta ?? 0) > 0 || (rankDelta ?? 0) > 0
    ? "up"
    : (weekDelta ?? 0) < 0 || (rankDelta ?? 0) < 0
      ? "down"
      : "flat";
  return (
    <span className={`recap-delta recap-delta-${direction}`}>
      {points}
      {points && rank ? " " : ""}
      {rank}
    </span>
  );
};

export const RecapUnavailable = ({
  title,
  body,
}: {
  title: string;
  body: string;
}) => (
  <main className="recap-page">
    <p className="recap-kicker">Round Table Draft</p>
    <h1 className="headline recap-title">{title}</h1>
    <p className="recap-intro">{body}</p>
    <a className="recap-home" href="/">
      Back to the league
    </a>
  </main>
);

const WeeklyRecapView = ({ recap }: { recap: PublicWeeklyRecap }) => {
  if (!recap.published) {
    return (
      <RecapUnavailable
        title="This recap isn't published yet"
        body="The league hasn't posted this week. The link will work after it's published."
      />
    );
  }

  const results = [
    { label: "Banished", value: resultValue(recap.results.banished) },
    { label: "Murdered", value: resultValue(recap.results.murdered) },
    { label: "Shield", value: resultValue(recap.results.shield) },
    {
      label: "New Traitors",
      value: recap.results.newTraitors.length > 0 ? recap.results.newTraitors.join(", ") : "—",
    },
  ];

  return (
    <main className="recap-page">
      <p className="recap-kicker">{recap.leagueName}</p>
      <h1 className="headline recap-title">{recap.weekLabel}</h1>
      <p className="recap-season">{recap.seasonLabel}</p>
      {recap.intro ? <p className="recap-intro">{recap.intro}</p> : null}

      <section className="recap-results" aria-label="Episode results">
        {results.map((result) => (
          <article key={result.label} className="recap-result">
            <p className="recap-result-label">{result.label}</p>
            <p className="recap-result-value">{result.value}</p>
          </article>
        ))}
      </section>

      <section className="recap-standings" aria-label="Current standings">
        <div className="recap-standings-head">
          <h2 className="headline">Standings</h2>
          <p>Current scores. The week column is movement since the previous snapshot.</p>
        </div>
        <ol className="recap-table">
          {recap.standings.map((row) => (
            <li key={`${row.rank}-${row.name}`} className="recap-row">
              <span className="recap-rank">{row.rank}</span>
              <span className="recap-name">{row.name}</span>
              <span className="recap-score">{formatScore(row.score)}</span>
              <Movement weekDelta={row.weekDelta} rankDelta={row.rankDelta} />
            </li>
          ))}
        </ol>
        {recap.standings.length === 0 ? (
          <p className="recap-intro">No scores yet.</p>
        ) : null}
      </section>

      <a className="recap-home" href="/">
        Open Round Table Draft
      </a>
    </main>
  );
};

export default WeeklyRecapView;
