import {
  sameStandingRoster,
  type PublishedStandings,
} from "./publishedStandings";
import { normalizeWeekId, type GameState } from "../../types";

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

export type StandingsHold = {
  seasonId: string;
  refreshKey: string;
  board: PublishedStandings;
};

/**
 * Apply a fetch result to the held board.
 *
 * A success replaces the hold. A failure clears any hold for that season so a
 * later gameState change cannot resurface a board that predates the failure.
 * Leaving the hold in place and only stamping a failedKey is what flashed the
 * old server scores whenever refreshKey moved on.
 */
export const applyStandingsFetchResult = (
  current: StandingsHold | null,
  result:
    | {
        status: "success";
        seasonId: string;
        refreshKey: string;
        board: PublishedStandings;
      }
    | { status: "failure"; seasonId: string }
): StandingsHold | null => {
  if (result.status === "success") {
    return {
      seasonId: result.seasonId,
      refreshKey: result.refreshKey,
      board: result.board,
    };
  }
  if (!current || current.seasonId !== result.seasonId) return current;
  return null;
};

/**
 * True when this scoring snapshot is an admin edit that has not been saved.
 * The local board stays up until that save completes and a fetch for it returns.
 */
export const standingsEditIsUnsaved = (
  unsavedRefreshKey: string | null,
  refreshKey: string
): boolean => unsavedRefreshKey !== null && unsavedRefreshKey === refreshKey;

/**
 * A save may finish after the admin has loaded a different season, or after
 * the board on screen has moved on. Only the save that still matches both
 * may clear the unsaved hold. Committing any other completion stamps the
 * active season as unsaved with nothing left to clear it.
 */
export const shouldCommitStandingsSave = (input: {
  savedSeasonId: string;
  activeSeasonId: string | null | undefined;
  savedStandingsKey: string;
  currentStandingsKey: string;
}): boolean => {
  const savedSeasonId = normalizeWeekId(input.savedSeasonId);
  const activeSeasonId = normalizeWeekId(input.activeSeasonId);
  if (!savedSeasonId || savedSeasonId !== activeSeasonId) return false;
  return input.savedStandingsKey === input.currentStandingsKey;
};

/** Board the UI may render. Null means score locally. */
export const selectPublishedStandings = (
  hold: StandingsHold | null,
  seasonId: string,
  playerIds: readonly string[],
  refreshKey?: string
): PublishedStandings | null => {
  if (!seasonId || !hold || hold.seasonId !== seasonId) return null;
  if (refreshKey !== undefined && hold.refreshKey !== refreshKey) return null;
  if (!sameStandingRoster(hold.board, playerIds)) return null;
  return hold.board;
};
