"use client";

import type { GameState } from "../types";
import { buildPublicWeeklyRecap } from "../src/utils/weeklyRecap";
import {
  orderByPublishedStandings,
  usablePublishedStandings,
  type PublishedStandings,
} from "../src/utils/publishedStandings";
import type { RecapDeepLink } from "../src/utils/pushDeepLink";
import WeeklyRecapView, { RecapUnavailable } from "./WeeklyRecapView";

interface InAppRecapProps {
  gameState: GameState;
  link: RecapDeepLink;
  loadedSeasonId: string | null;
  publishedStandings?: PublishedStandings | null;
  onClose: () => void;
}

/**
 * Notification tap inside the bundled app. The web recap is the fallback when
 * this device is sitting on a different season than the link.
 */
const InAppRecap = ({
  gameState,
  link,
  loadedSeasonId,
  publishedStandings = null,
  onClose,
}: InAppRecapProps) => {
  const seasonMatches = !link.seasonId || link.seasonId === loadedSeasonId;
  const built = seasonMatches ? buildPublicWeeklyRecap(gameState, link.weekId) : null;
  const published = usablePublishedStandings(publishedStandings, gameState);
  const ordered =
    built && published ? orderByPublishedStandings(built.standings, published) : null;
  const recap = built && ordered ? { ...built, standings: ordered } : built;

  return (
    <div className="recap-in-app">
      <div className="recap-in-app-bar">
        <button type="button" className="btn-secondary recap-close" onClick={onClose}>
          Back
        </button>
      </div>
      {recap ? (
        <WeeklyRecapView recap={recap} />
      ) : (
        <RecapUnavailable
          title="Open this recap on the web"
          body="This device is on a different season than the notification."
        />
      )}
      {!recap ? (
        <p className="recap-page recap-fallback">
          <a className="recap-home" href={link.url}>
            {link.url}
          </a>
        </p>
      ) : null}
    </div>
  );
};

export default InAppRecap;
