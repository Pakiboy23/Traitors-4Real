import { useEffect, useMemo, useState } from "react";
import type { GameState } from "../../types";
import { normalizeWeekId } from "../../types";
import { fetchPublishedStandings } from "./fetchPublishedStandings";
import { publicRosterIds, sameStandingRoster } from "./publishedStandings";
import type { PublishedStandings } from "./publishedStandings";
import {
  applyStandingsFetchResult,
  selectPublishedStandings,
  standingsEditIsUnsaved,
  standingsRefreshKey,
  type StandingsHold,
} from "./standingsHold";

export {
  applyStandingsFetchResult,
  selectPublishedStandings,
  standingsEditIsUnsaved,
  standingsRefreshKey,
  type StandingsHold,
} from "./standingsHold";

/**
 * Latest server board for this season.
 * Null means score locally. A scoring edit stays on the local board until
 * that snapshot has been saved and a fetch for it returns. A failed refresh
 * clears the hold so the next live update cannot flash those outdated scores.
 */
export const usePublishedStandings = (
  gameState: GameState,
  persistRevision: number | null = null,
  unsavedRefreshKey: string | null = null
): PublishedStandings | null => {
  const seasonId = normalizeWeekId(gameState.seasonId) ?? "";
  const refreshKey = useMemo(() => standingsRefreshKey(gameState), [gameState]);
  const rosterIds = useMemo(() => publicRosterIds(gameState.players), [gameState.players]);
  const editIsUnsaved = standingsEditIsUnsaved(unsavedRefreshKey, refreshKey);
  const [hold, setHold] = useState<StandingsHold | null>(null);

  useEffect(() => {
    if (!seasonId || editIsUnsaved) return undefined;
    let cancelled = false;
    const ids = rosterIds;
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
    // rosterIds is covered by refreshKey, which changes when the roster changes.
    // An unsaved admin edit does not fetch, so the pre-save response cannot
    // replace the board. persistRevision refetches after the save succeeds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId, refreshKey, persistRevision, editIsUnsaved]);

  if (editIsUnsaved) return null;
  return selectPublishedStandings(hold, seasonId, rosterIds, refreshKey);
};
