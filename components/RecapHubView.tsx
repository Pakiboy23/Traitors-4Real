import { formatRecapPublishedAt, type PublicRecapIndex } from "../src/utils/weeklyRecap";

const RecapHubView = ({ index }: { index: PublicRecapIndex }) => (
  <main className="recap-page">
    <p className="recap-kicker">{index.leagueName}</p>
    <h1 className="headline recap-title">{index.seasonLabel}</h1>
    <p className="recap-season">Recaps</p>
    {index.weeks.length === 0 ? (
      <p className="recap-intro">No recaps published yet.</p>
    ) : (
      <ol className="recap-index" aria-label="Published recaps">
        {index.weeks.map((week) => {
          const published = formatRecapPublishedAt(week.publishedAt);
          return (
            <li key={week.weekId}>
              <a className="recap-index-link" href={week.href}>
                <span className="headline recap-index-label">{week.weekLabel}</span>
                {published ? (
                  <time className="recap-index-meta" dateTime={week.publishedAt ?? undefined}>
                    {published}
                  </time>
                ) : null}
                {week.intro ? <p className="recap-index-intro">{week.intro}</p> : null}
              </a>
            </li>
          );
        })}
      </ol>
    )}
    <a className="recap-home" href="/">
      Open Round Table Draft
    </a>
  </main>
);

export default RecapHubView;
