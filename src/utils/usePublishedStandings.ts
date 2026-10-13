import { useEffect, useMemo, useState } from "react";
import type { GameState } from "../../types";
import { normalizeWeekId } from "../../types";
import { fetchPublishedStandings } from "./fetchPublishedStandings";
import {
  sameStandingRoster,
  type PublishedStandings,
} from "./publishedStandings";

/** Changes when a field that can move the board changes. */
export const standingsRefreshKey = (gameState: GameState): string =>
  JSON.stringify({
    seasonId: gameState.seasonId ?? null,
    activeWeekId: gameState.activeWeekId ?? null,
    rulePackId: gameState.rulePackId ?? null,
    finaleConfig: gameState.finaleConfig ?? null,
    castStatus: gameState.castStatus,
    weeklyResults: gameState.weeklyResults ?? null,
    scoreAdjustments: gameState.scoreAdjustments ?? null,
    weeklyScoreHistory: gameState.weeklyScoreHistory ?? null,
    players: gameState.players.map((player) => ({
      id: player.id,
      name: player.name,
      picks: player.picks,
      predFirstOut: player.predFirstOut,
      predWinner: player.predWinner,
      predTraitors: player.predTraitors,
      weeklyPredictions: player.weeklyPredictions ?? null,
    })),
  });

/**
 * Latest server board for this season.
 * Null means score locally. While a refresh is in flight the previous server
 * board stays up. A failed refresh for this snapshot drops back to local.
 */
export const usePublishedStandings = (gameState: GameState): PublishedStandings | null => {
  const seasonId = normalizeWeekId(gameState.seasonId) ?? "";
  const refreshKey = useMemo(() => standingsRefreshKey(gameState), [gameState]);
  const playerIds = gameState.players.map((player) => player.id);
  const [hold, setHold] = useState<PublishedStandings | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!seasonId) return undefined;
    let cancelled = false;
    const ids = playerIds;
    void (async () => {
      const next = await fetchPublishedStandings(seasonId);
      if (cancelled) return;
      if (next && next.seasonId === seasonId && sameStandingRoster(next, ids)) {
        setHold(next);
        setFailedKey(null);
        return;
      }
      setFailedKey(refreshKey);
    })();
    return () => {
      cancelled = true;
    };
    // playerIds is covered by refreshKey, which changes when the roster changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId, refreshKey]);

  if (!seasonId || failedKey === refreshKey) return null;
  if (!hold || hold.seasonId !== seasonId) return null;
  if (!sameStandingRoster(hold, playerIds)) return null;
  return hold;
};
