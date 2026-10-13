import { useEffect, useMemo, useState } from "react";
import type { GameState } from "../../types";
import { normalizeWeekId } from "../../types";
import { fetchPublishedStandings } from "./fetchPublishedStandings";
import { sameStandingRoster } from "./publishedStandings";
import type { PublishedStandings } from "./publishedStandings";
import {
  applyStandingsFetchResult,
  selectPublishedStandings,
  standingsRefreshKey,
  type StandingsHold,
} from "./standingsHold";

export {
  applyStandingsFetchResult,
  selectPublishedStandings,
  standingsRefreshKey,
  type StandingsHold,
} from "./standingsHold";

/**
 * Latest server board for this season.
 * Null means score locally. While a refresh is in flight the previous server
 * board stays up. A failed refresh clears that hold so the next live update
 * cannot flash those outdated scores before the new request fails.
 */
export const usePublishedStandings = (
  gameState: GameState,
  persistRevision: number | null = null
): PublishedStandings | null => {
  const seasonId = normalizeWeekId(gameState.seasonId) ?? "";
  const refreshKey = useMemo(() => standingsRefreshKey(gameState), [gameState]);
  const playerIds = gameState.players.map((player) => player.id);
  const [hold, setHold] = useState<StandingsHold | null>(null);

  useEffect(() => {
    if (!seasonId) return undefined;
    let cancelled = false;
    const ids = playerIds;
    const requestKey = refreshKey;
    void (async () => {
      const next = await fetchPublishedStandings(seasonId);
      if (cancelled) return;
      if (next && next.seasonId === seasonId && sameStandingRoster(next, ids)) {
        setHold((current) =>
          applyStandingsFetchResult(current, {
            status: "success",
            seasonId,
            refreshKey: requestKey,
            board: next,
          })
        );
        return;
      }
      setHold((current) =>
        applyStandingsFetchResult(current, { status: "failure", seasonId })
      );
    })();
    return () => {
      cancelled = true;
    };
    // playerIds is covered by refreshKey, which changes when the roster changes.
    // persistRevision is lastSavedAt (or the row updated_at). A scoring edit
    // refetches immediately, before the 500 ms autosave, so the first response
    // can still be the pre-save board. Completing the save must fetch again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId, refreshKey, persistRevision]);

  return selectPublishedStandings(hold, seasonId, playerIds);
};
