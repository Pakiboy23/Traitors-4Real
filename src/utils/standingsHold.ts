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

export type StandingsSaveCommit = {
  /** The saved season is still on screen, so its key is now persisted. */
  recordSavedKey: boolean;
  /** The board on screen is still that saved snapshot. */
  clearUnsaved: boolean;
};

/**
 * A save may finish after the admin has loaded a different season, or after
 * the board on screen has moved on.
 *
 * The saved key is recorded when that season is still active and this save
 * started after every save already applied. An older in-flight save that
 * finishes later must not replace the newer key. Clearing the unsaved hold
 * is separate: a save for an older key must still count as persisted, or
 * reverting to it later looks unsaved and nothing clears it. A different
 * season records nothing.
 */
export const standingsSaveCommit = (input: {
  savedSeasonId: string;
  activeSeasonId: string | null | undefined;
  savedStandingsKey: string;
  currentStandingsKey: string;
  /** Monotonic id captured when this save started. */
  saveGeneration: number;
  /** Highest generation already applied for a save that finished. */
  appliedGeneration: number;
}): StandingsSaveCommit => {
  const savedSeasonId = normalizeWeekId(input.savedSeasonId);
  const activeSeasonId = normalizeWeekId(input.activeSeasonId);
  if (!savedSeasonId || savedSeasonId !== activeSeasonId) {
    return { recordSavedKey: false, clearUnsaved: false };
  }
  if (!(input.saveGeneration > input.appliedGeneration)) {
    return { recordSavedKey: false, clearUnsaved: false };
  }
  return {
    recordSavedKey: true,
    clearUnsaved: input.savedStandingsKey === input.currentStandingsKey,
  };
};

/**
 * An older save can still finish after a newer one and upsert the previous
 * snapshot. Rewrite the current snapshot when this completion lost that race
 * and its body is not the board on screen. The same body does not need another
 * write. A different season is left alone.
 */
export const staleSaveNeedsRewrite = (input: {
  savedSeasonId: string;
  activeSeasonId: string | null | undefined;
  saveGeneration: number;
  appliedGeneration: number;
  savedSerialized: string;
  currentSerialized: string;
}): boolean => {
  const savedSeasonId = normalizeWeekId(input.savedSeasonId);
  const activeSeasonId = normalizeWeekId(input.activeSeasonId);
  if (!savedSeasonId || savedSeasonId !== activeSeasonId) return false;
  if (!(input.saveGeneration < input.appliedGeneration)) return false;
  return input.savedSerialized !== input.currentSerialized;
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
