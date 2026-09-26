import type {
  FinaleConfig,
  GameState,
  PlayerEntry,
  SeasonConfig,
  SeasonState,
} from "../../types";
import { normalizeWeekId } from "../../types";
import {
  NEW_BLOOD_CAST_NAMES,
  NEW_BLOOD_SEASON_ID,
} from "../config/newBloodCast";

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

const emptyWeeklyResults = {
  weekId: "week-1",
  nextBanished: "",
  nextMurdered: "",
  bonusGames: { redemptionRoulette: "", shieldGambit: "", traitorTrio: [] as string[] },
  finaleResults: { ...emptyFinaleResults },
};

const emptyWeeklyPredictions = {
  nextBanished: "",
  nextMurdered: "",
  bonusGames: {
    redemptionRoulette: "",
    doubleOrNothing: false,
    shieldGambit: "",
    traitorTrio: [] as string[],
  },
  finalePredictions: {
    finalWinner: "",
    lastFaithfulStanding: "",
    lastTraitorStanding: "",
    finalPotEstimate: null as number | null,
  },
};

/** New Blood has a bundled roster. Other seasons keep whatever the snapshot already listed. */
export const rosterForSeason = (
  seasonId: string | null | undefined,
  fallbackNames: string[] = []
): string[] => {
  if (normalizeWeekId(seasonId ?? null) === NEW_BLOOD_SEASON_ID) {
    return [...NEW_BLOOD_CAST_NAMES];
  }
  return fallbackNames.filter((name) => typeof name === "string" && name.trim());
};

const nameOnRoster = (name: string | null | undefined, roster: Set<string>) =>
  Boolean(name && roster.has(name));

/**
 * True when the snapshot still carries another season's board: celebrity
 * leftovers on a civilian roster, Week 11 archives, or draft picks that
 * are not on this season's cast.
 */
export const hasForeignSeasonGameplay = (
  state: Pick<Partial<GameState>, "castStatus" | "players" | "weeklyResults" | "weeklyScoreHistory">,
  roster: string[]
): boolean => {
  if (roster.length === 0) return false;
  const allowed = new Set(roster);

  if (Object.keys(state.castStatus || {}).some((name) => !allowed.has(name))) {
    return true;
  }

  const weeklyHitsForeign = (results?: GameState["weeklyResults"]) =>
    Boolean(
      (results?.nextBanished && !allowed.has(results.nextBanished)) ||
        (results?.nextMurdered &&
          results.nextMurdered !== "No Murder" &&
          !allowed.has(results.nextMurdered)) ||
        (results?.finaleResults?.finalWinner &&
          !allowed.has(results.finaleResults.finalWinner)) ||
        (results?.finaleResults?.lastFaithfulStanding &&
          !allowed.has(results.finaleResults.lastFaithfulStanding)) ||
        (results?.finaleResults?.lastTraitorStanding &&
          !allowed.has(results.finaleResults.lastTraitorStanding))
    );

  if (weeklyHitsForeign(state.weeklyResults)) return true;

  if (
    (state.weeklyScoreHistory ?? []).some((snapshot) => weeklyHitsForeign(snapshot.weeklyResults))
  ) {
    return true;
  }

  return (state.players ?? []).some((player) => {
    if ((player.picks ?? []).some((pick) => pick.member && !allowed.has(pick.member))) {
      return true;
    }
    if (player.predWinner && !allowed.has(player.predWinner)) return true;
    if (player.predFirstOut && !allowed.has(player.predFirstOut)) return true;
    if ((player.predTraitors ?? []).some((name) => name && !allowed.has(name))) return true;
    const weekly = player.weeklyPredictions;
    if (weekly?.nextBanished && !allowed.has(weekly.nextBanished)) return true;
    if (
      weekly?.nextMurdered &&
      weekly.nextMurdered !== "No Murder" &&
      !allowed.has(weekly.nextMurdered)
    ) {
      return true;
    }
    const finale = weekly?.finalePredictions;
    if (finale?.finalWinner && !allowed.has(finale.finalWinner)) return true;
    if (finale?.lastFaithfulStanding && !allowed.has(finale.lastFaithfulStanding)) return true;
    if (finale?.lastTraitorStanding && !allowed.has(finale.lastTraitorStanding)) return true;
    return false;
  });
};

const stripPlayerToSeason = (player: PlayerEntry, roster: Set<string>): PlayerEntry => ({
  ...player,
  picks: (player.picks ?? []).filter((pick) => nameOnRoster(pick.member, roster)),
  predWinner: nameOnRoster(player.predWinner, roster) ? player.predWinner : "",
  predFirstOut: nameOnRoster(player.predFirstOut, roster) ? player.predFirstOut : "",
  predTraitors: (player.predTraitors ?? []).filter((name) => nameOnRoster(name, roster)),
  weeklyPredictions: {
    ...emptyWeeklyPredictions,
    nextBanished: nameOnRoster(player.weeklyPredictions?.nextBanished, roster)
      ? player.weeklyPredictions!.nextBanished
      : "",
    nextMurdered:
      player.weeklyPredictions?.nextMurdered === "No Murder" ||
      nameOnRoster(player.weeklyPredictions?.nextMurdered, roster)
        ? player.weeklyPredictions?.nextMurdered ?? ""
        : "",
    finalePredictions: {
      finalWinner: nameOnRoster(
        player.weeklyPredictions?.finalePredictions?.finalWinner,
        roster
      )
        ? player.weeklyPredictions!.finalePredictions!.finalWinner
        : "",
      lastFaithfulStanding: nameOnRoster(
        player.weeklyPredictions?.finalePredictions?.lastFaithfulStanding,
        roster
      )
        ? player.weeklyPredictions!.finalePredictions!.lastFaithfulStanding
        : "",
      lastTraitorStanding: nameOnRoster(
        player.weeklyPredictions?.finalePredictions?.lastTraitorStanding,
        roster
      )
        ? player.weeklyPredictions!.finalePredictions!.lastTraitorStanding
        : "",
      finalPotEstimate:
        player.weeklyPredictions?.finalePredictions?.finalPotEstimate ?? null,
    },
  },
});

const rebuildCastStatus = (
  roster: string[],
  previous: GameState["castStatus"] | undefined
): GameState["castStatus"] =>
  Object.fromEntries(
    roster.map((name) => [
      name,
      {
        isWinner: false,
        isFirstOut: false,
        isTraitor: false,
        isEliminated: false,
        portraitUrl: previous?.[name]?.portraitUrl ?? null,
        age: previous?.[name]?.age ?? null,
        occupation: previous?.[name]?.occupation ?? null,
        hometown: previous?.[name]?.hometown ?? null,
      },
    ])
  );

/**
 * A live/draft season must not display another season's certified board.
 * Archived and finalized seasons keep their snapshot — that is the record.
 */
export const isolateSeasonGameplay = <T extends Partial<GameState>>(
  state: T,
  season: SeasonConfig,
  roster: string[]
): T & {
  seasonId: string;
  seasonConfig: SeasonConfig;
  finaleConfig: FinaleConfig;
} => {
  const applied = applySeasonRecord(state, season);
  if (season.status === "archived" || season.status === "finalized") {
    return applied;
  }
  if (roster.length === 0 || !hasForeignSeasonGameplay(applied, roster)) {
    return applied;
  }

  const allowed = new Set(roster);
  return {
    ...applied,
    players: (applied.players ?? []).map((player) => stripPlayerToSeason(player, allowed)),
    castStatus: rebuildCastStatus(roster, applied.castStatus),
    showConfig: applied.showConfig
      ? { ...applied.showConfig, castNames: roster }
      : applied.showConfig,
    weeklyResults: { ...emptyWeeklyResults },
    activeWeekId: "week-1",
    weeklySubmissionHistory: [],
    weeklyScoreHistory: [],
    weeklyRecaps: [],
    scoreAdjustments: [],
  };
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
      weeklyResults: { ...emptyWeeklyResults },
      activeWeekId: "week-1",
      weeklySubmissionHistory: [],
      weeklyScoreHistory: [],
      weeklyRecaps: [],
      scoreAdjustments: [],
    },
    target
  );
};
