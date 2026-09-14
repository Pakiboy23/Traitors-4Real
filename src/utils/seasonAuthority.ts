import type { FinaleConfig, GameState, SeasonConfig, SeasonState } from "../../types";
import { normalizeWeekId } from "../../types";

const DEFAULT_FINALE_CONFIG: FinaleConfig = {
  enabled: false,
  label: "Finale",
  lockAt: "",
};

/**
 * The seasons row is the authority for lifecycle fields. A season_states
 * snapshot is a frozen copy and can still carry the previous season's finale
 * (clone leftover, or an admin save of stale local state). Overlay the row
 * before Home, scoring, or a write reads finaleConfig.
 */
export const applySeasonRecord = <T extends object>(
  state: T,
  season: SeasonConfig
): T & {
  seasonId: string;
  seasonConfig: SeasonConfig;
  finaleConfig: FinaleConfig;
} => ({
  ...state,
  seasonId: season.seasonId,
  seasonConfig: season,
  finaleConfig: season.finaleConfig ?? DEFAULT_FINALE_CONFIG,
});

/**
 * Admin autosave must not write the previous season's board into the newly
 * selected season. That race is what stamped Season 4's certified finale onto
 * the live New Blood snapshot.
 */
export const canPersistSeasonState = ({
  activeSeasonId,
  loadedSeasonId,
}: {
  activeSeasonId: string | null | undefined;
  loadedSeasonId: string | null | undefined;
}): boolean => {
  const active = normalizeWeekId(activeSeasonId ?? null);
  const loaded = normalizeWeekId(loadedSeasonId ?? null);
  return Boolean(active && loaded && active === loaded);
};

/** Home "Season Complete" / final podium. Finale week alone is not enough. */
export const isFinaleResultsCertified = (
  state: Pick<GameState, "finaleConfig" | "weeklyResults">
): boolean =>
  Boolean(
    state.finaleConfig?.enabled &&
      state.weeklyResults?.finaleResults?.finalWinner &&
      state.weeklyResults?.finaleResults?.lastFaithfulStanding &&
      state.weeklyResults?.finaleResults?.lastTraitorStanding
  );

const emptyFinaleResults = {
  finalWinner: "",
  lastFaithfulStanding: "",
  lastTraitorStanding: "",
  finalPotValue: null as number | null,
};

/**
 * Clone copies roster shape, not the source season's outcome. The target
 * row's finaleConfig wins — otherwise a new season opens on FINAL RESULTS.
 */
export const resetSeasonStateForClone = (
  state: SeasonState,
  target: SeasonConfig
): SeasonState => {
  const castStatus = Object.fromEntries(
    Object.entries(state.castStatus || {}).map(([name, status]) => [
      name,
      { ...status, isWinner: false, isFirstOut: false, isTraitor: false, isEliminated: false },
    ])
  );
  return applySeasonRecord(
    {
      ...state,
      players: [],
      castStatus,
      weeklyResults: {
        weekId: "week-1",
        nextBanished: "",
        nextMurdered: "",
        bonusGames: { redemptionRoulette: "", shieldGambit: "", traitorTrio: [] },
        finaleResults: { ...emptyFinaleResults },
      },
      activeWeekId: "week-1",
      weeklySubmissionHistory: [],
      weeklyScoreHistory: [],
      scoreAdjustments: [],
    },
    target
  );
};
