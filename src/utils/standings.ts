import type { GameState, League, PlayerEntry, WeeklyResults, WeeklyScoreSnapshot } from "../../types.ts";
import { normalizeWeekId } from "../../types.ts";
import {
  calculatePlayerScore,
  getFinaleTieBreakDistance,
  type PlayerScore,
} from "./scoring.ts";

/**
 * Same "is there anything to score this week?" check the Leaderboard uses
 * before it falls back to the latest archived total.
 */
export const weeklyResultsAreLive = (weekly?: WeeklyResults | null): boolean =>
  Boolean(
    weekly?.nextBanished ||
      weekly?.nextMurdered ||
      weekly?.bonusGames?.redemptionRoulette ||
      weekly?.bonusGames?.shieldGambit ||
      weekly?.bonusGames?.traitorTrio?.length ||
      weekly?.finaleResults?.finalWinner ||
      weekly?.finaleResults?.lastFaithfulStanding ||
      weekly?.finaleResults?.lastTraitorStanding ||
      typeof weekly?.finaleResults?.finalPotValue === "number"
  );

export interface DisplayScoreParts {
  draftPredictionPoints: number;
  weeklyCallPoints: number;
}

const historyOf = (gameState: GameState): WeeklyScoreSnapshot[] =>
  Array.isArray(gameState.weeklyScoreHistory) ? gameState.weeklyScoreHistory : [];

/** Snapshots archived before running totals have no per-week call split. */
export const isComponentSnapshot = (
  snapshot: WeeklyScoreSnapshot | null | undefined
): boolean =>
  Boolean(snapshot?.weeklyCallPoints && typeof snapshot.weeklyCallPoints === "object");

export const componentSnapshotStart = (history: WeeklyScoreSnapshot[]): number =>
  history.findIndex((snapshot) => isComponentSnapshot(snapshot));

const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Where season-wide (no week) score adjustments come from. */
export type AdjustmentSource = Pick<GameState, "seasonId" | "scoreAdjustments">;

/**
 * Season-wide adjustments for one player created in (after, upTo].
 *
 * New snapshots persist the cumulative total from the archived state. This
 * timestamp window is only for older snapshots that lack that record, and
 * for subtracting what a legacy baseline already published. A null bound is
 * open. An unparseable createdAt only lands in the open-ended "since the
 * last archive" window.
 */
const seasonWideAdjustmentPoints = (
  source: AdjustmentSource | undefined,
  playerId: string,
  after: string | null | undefined,
  upTo: string | null | undefined
): number => {
  const adjustments = Array.isArray(source?.scoreAdjustments) ? source!.scoreAdjustments : [];
  const afterMs = after ? Date.parse(after) : Number.NEGATIVE_INFINITY;
  const upToMs = upTo ? Date.parse(upTo) : Number.POSITIVE_INFINITY;
  let points = 0;
  for (const adjustment of adjustments) {
    if (adjustment.playerId !== playerId) continue;
    if (adjustment.seasonId && source?.seasonId && adjustment.seasonId !== source.seasonId) continue;
    if (normalizeWeekId(adjustment.weekId)) continue;
    const value = finite(adjustment.points);
    if (value === null) continue;
    const created = Date.parse(adjustment.createdAt);
    const inWindow = Number.isNaN(created)
      ? upTo == null
      : (Number.isNaN(afterMs) || created > afterMs) && (Number.isNaN(upToMs) || created <= upToMs);
    if (inWindow) points += value;
  }
  return points;
};

const persistedSeasonWide = (
  snapshot: WeeklyScoreSnapshot | null | undefined,
  playerId: string
): number | null => {
  const record = snapshot?.seasonWideAdjustmentPoints;
  if (!record || typeof record !== "object") return null;
  return finite(record[playerId]) ?? 0;
};

/**
 * Portion of the cumulative season-wide total that the legacy baseline
 * already published. Frozen onto the snapshot at archive time so a later
 * delete still knows those points were in the published number.
 */
const frozenInBaseline = (
  snapshot: WeeklyScoreSnapshot | null | undefined,
  playerId: string
): number | null => {
  const record = snapshot?.seasonWideInBaselinePoints;
  if (!record || typeof record !== "object") return null;
  return finite(record[playerId]) ?? 0;
};

/** Points already published on the legacy baseline, or 0 when there is none. */
const seasonWideAlreadyInBaseline = (
  source: AdjustmentSource | undefined,
  playerId: string,
  baseline: WeeklyScoreSnapshot | undefined,
  baselineTotal: number | null
): number => {
  if (baselineTotal === null) return 0;
  const persisted = persistedSeasonWide(baseline, playerId);
  if (persisted !== null) return persisted;
  return seasonWideAdjustmentPoints(source, playerId, null, baseline?.createdAt);
};

/** Season-wide points that belong on this archived week. */
const seasonWideForSnapshot = (
  source: AdjustmentSource | undefined,
  playerId: string,
  snapshot: WeeklyScoreSnapshot | undefined,
  baseline: WeeklyScoreSnapshot | undefined,
  baselineTotal: number | null
): number => {
  const persisted = persistedSeasonWide(snapshot, playerId);
  const frozen = frozenInBaseline(snapshot, playerId);
  if (persisted !== null && frozen !== null) return persisted - frozen;
  const alreadyInBaseline = seasonWideAlreadyInBaseline(
    source,
    playerId,
    baseline,
    baselineTotal
  );
  if (persisted !== null) return persisted - alreadyInBaseline;
  return seasonWideAdjustmentPoints(
    source,
    playerId,
    baselineTotal === null ? null : baseline?.createdAt,
    snapshot?.createdAt
  );
};

/** Season-wide points entered after this archive. */
const seasonWideSinceSnapshot = (
  source: AdjustmentSource | undefined,
  playerId: string,
  snapshot: WeeklyScoreSnapshot | undefined
): number => {
  const persisted = persistedSeasonWide(snapshot, playerId);
  if (persisted !== null) {
    return seasonWideAdjustmentPoints(source, playerId, null, null) - persisted;
  }
  return seasonWideAdjustmentPoints(source, playerId, snapshot?.createdAt, null);
};

/**
 * Season total as of one archived week.
 * Legacy weeks return the published snapshot total.
 * Later weeks return the latest legacy total plus call points since then,
 * with draft points taken from that snapshot so a change counts once.
 */
export const runningTotalAtSnapshot = (
  history: WeeklyScoreSnapshot[],
  index: number,
  playerId: string,
  adjustments?: AdjustmentSource
): number | null => {
  if (index < 0 || index >= history.length) return null;
  const start = componentSnapshotStart(history);
  if (start === -1 || index < start) return finite(history[index]?.totals?.[playerId]);

  const baselineIndex = start - 1;
  const baselineTotal = baselineIndex >= 0 ? finite(history[baselineIndex]?.totals?.[playerId]) : null;
  let calls = 0;
  for (let cursor = start; cursor <= index; cursor += 1) {
    calls += finite(history[cursor]?.weeklyCallPoints?.[playerId]) ?? 0;
  }
  const draftHere = finite(history[index]?.draftPredictionPoints?.[playerId]) ?? 0;
  const adjusted = seasonWideForSnapshot(
    adjustments,
    playerId,
    history[index],
    baselineTotal === null ? undefined : history[baselineIndex],
    baselineTotal
  );
  if (baselineTotal === null) return calls + draftHere + adjusted;

  const anchor = finite(history[start]?.draftPredictionPoints?.[playerId]);
  const draftDelta = anchor === null ? 0 : draftHere - anchor;
  return baselineTotal + calls + draftDelta + adjusted;
};

const withCurrentDraft = (
  history: WeeklyScoreSnapshot[],
  playerId: string,
  archivedTotal: number,
  currentDraft: number
): number => {
  const start = componentSnapshotStart(history);
  if (start === -1) return archivedTotal;
  const lastIndex = history.length - 1;
  const draftAtLast = finite(history[lastIndex]?.draftPredictionPoints?.[playerId]) ?? 0;
  const baselineTotal =
    start > 0 ? finite(history[start - 1]?.totals?.[playerId]) : null;
  if (baselineTotal === null) return archivedTotal - draftAtLast + currentDraft;
  const anchor = finite(history[start]?.draftPredictionPoints?.[playerId]);
  if (anchor === null) return archivedTotal;
  return archivedTotal - (draftAtLast - anchor) + (currentDraft - anchor);
};

/**
 * Leaderboard number.
 * Legacy history (weeks archived before the call split) still shows the latest
 * published snapshot, plus season-wide adjustments entered after that archive.
 * Once a snapshot carries `weeklyCallPoints`, the total is that baseline plus
 * every later week's calls, plus the draft-point change since the first of
 * those snapshots.
 */
export const resolveDisplayTotal = (
  gameState: GameState,
  playerId: string,
  scoringTotal: number,
  parts?: DisplayScoreParts
): number => {
  const history = historyOf(gameState);
  const start = componentSnapshotStart(history);
  const live = weeklyResultsAreLive(gameState.weeklyResults);
  if (start === -1) {
    if (live) return scoringTotal;
    const latest = history[history.length - 1];
    const archived = finite(latest?.totals?.[playerId]);
    if (archived === null) return scoringTotal;
    return archived + seasonWideSinceSnapshot(gameState, playerId, latest);
  }

  const atLast = runningTotalAtSnapshot(history, history.length - 1, playerId, gameState);
  if (atLast === null) return scoringTotal;
  const currentDraft = parts?.draftPredictionPoints ?? 0;
  let total =
    withCurrentDraft(history, playerId, atLast, currentDraft) +
    seasonWideSinceSnapshot(gameState, playerId, history[history.length - 1]);
  if (live) total += parts?.weeklyCallPoints ?? 0;
  return total;
};

/** Points added between the previous archive and the number on the board. */
export const displayedWeekDelta = (
  gameState: GameState,
  playerId: string,
  displayTotal: number
): number | null => {
  const history = historyOf(gameState);
  if (history.length < 2) return null;
  if (componentSnapshotStart(history) === -1) {
    const last = finite(history[history.length - 1]?.totals?.[playerId]);
    const prev = finite(history[history.length - 2]?.totals?.[playerId]);
    if (last === null || prev === null) return null;
    return (
      last -
      prev +
      seasonWideSinceSnapshot(gameState, playerId, history[history.length - 1])
    );
  }
  const previous = runningTotalAtSnapshot(history, history.length - 2, playerId, gameState);
  if (previous === null) return null;
  return displayTotal - previous;
};

export interface SeasonTimelinePoint {
  label: string;
  total: number;
}

const timelineLabel = (snapshot: WeeklyScoreSnapshot): string =>
  snapshot.label?.trim() || new Date(snapshot.createdAt).toLocaleDateString();

/** Per-player archive strip. Legacy chips stay on the published number. */
export const seasonTimeline = (
  gameState: GameState,
  playerId: string,
  currentDraft?: number
): SeasonTimelinePoint[] => {
  const history = historyOf(gameState);
  const live = weeklyResultsAreLive(gameState.weeklyResults);
  const points: SeasonTimelinePoint[] = [];
  history.forEach((snapshot, index) => {
    const archived = runningTotalAtSnapshot(history, index, playerId, gameState);
    if (archived === null) return;
    const isLast = index === history.length - 1;
    let total = archived;
    if (isLast && !live) {
      if (typeof currentDraft === "number") {
        total = withCurrentDraft(history, playerId, archived, currentDraft);
      }
      total += seasonWideSinceSnapshot(gameState, playerId, snapshot);
    }
    points.push({ label: timelineLabel(snapshot), total });
  });
  return points;
};

/** Totals map used for recap movement, in the same units as the leaderboard. */
export const runningTotalsRecord = (
  history: WeeklyScoreSnapshot[],
  index: number,
  playerIds: Iterable<string>,
  adjustments?: AdjustmentSource
): Record<string, number> => {
  const totals: Record<string, number> = {};
  for (const playerId of playerIds) {
    const total = runningTotalAtSnapshot(history, index, playerId, adjustments);
    if (typeof total === "number") totals[playerId] = total;
  }
  return totals;
};

const carriedBaselinePoints = (
  history: WeeklyScoreSnapshot[]
): Record<string, number> | null => {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const record = history[index]?.seasonWideInBaselinePoints;
    if (record && typeof record === "object") return record;
  }
  return null;
};

/**
 * Season-wide points the legacy baseline already published.
 * The first component archive freezes that split from timestamps while the
 * rows still exist. Later archives copy it, so a delete cannot erase the
 * only record that those points were inside the published total.
 */
const seasonWideInBaselineForArchive = (state: GameState): Record<string, number> => {
  const history = historyOf(state);
  const carried = carriedBaselinePoints(history);
  const points: Record<string, number> = {};
  if (carried) {
    for (const player of state.players) {
      points[player.id] = finite(carried[player.id]) ?? 0;
    }
    return points;
  }
  const start = componentSnapshotStart(history);
  let baseline: WeeklyScoreSnapshot | undefined;
  if (start === -1) baseline = history[history.length - 1];
  else if (start > 0) baseline = history[start - 1];
  else baseline = undefined;
  for (const player of state.players) {
    const baselineTotal = baseline ? finite(baseline.totals?.[player.id]) : null;
    points[player.id] = seasonWideAlreadyInBaseline(state, player.id, baseline, baselineTotal);
  }
  return points;
};

/** Fields Archive Week writes onto a new snapshot. */
export const snapshotScoreRecords = (
  state: GameState
): {
  totals: Record<string, number>;
  weeklyCallPoints: Record<string, number>;
  draftPredictionPoints: Record<string, number>;
  seasonWideAdjustmentPoints: Record<string, number>;
  seasonWideInBaselinePoints: Record<string, number>;
} => {
  const totals: Record<string, number> = {};
  const weeklyCallPoints: Record<string, number> = {};
  const draftPredictionPoints: Record<string, number> = {};
  const seasonWide: Record<string, number> = {};
  const inBaseline = seasonWideInBaselineForArchive(state);
  for (const player of state.players) {
    const scored: PlayerScore = calculatePlayerScore(state, player);
    totals[player.id] = scored.total;
    weeklyCallPoints[player.id] = scored.weeklyCallPoints;
    draftPredictionPoints[player.id] = scored.draftPredictionPoints;
    seasonWide[player.id] = seasonWideAdjustmentPoints(state, player.id, null, null);
  }
  return {
    totals,
    weeklyCallPoints,
    draftPredictionPoints,
    seasonWideAdjustmentPoints: seasonWide,
    seasonWideInBaselinePoints: inBaseline,
  };
};

export interface StandingSortKey {
  name: string;
  displayTotal: number;
  tieBreakDistance: number | null;
}

/** Leaderboard order: score, finale pot distance when that tie-break is on, then name. */
export const compareStandingEntries = (a: StandingSortKey, b: StandingSortKey): number => {
  if (b.displayTotal !== a.displayTotal) return b.displayTotal - a.displayTotal;
  const aDistance = a.tieBreakDistance;
  const bDistance = b.tieBreakDistance;
  if (aDistance === null && bDistance !== null) return 1;
  if (aDistance !== null && bDistance === null) return -1;
  if (
    typeof aDistance === "number" &&
    typeof bDistance === "number" &&
    aDistance !== bDistance
  ) {
    return aDistance - bDistance;
  }
  return a.name.localeCompare(b.name);
};

export interface LeaderboardRankContext {
  tieBreakActive: boolean;
  pot: number | null;
}

export const leaderboardRankContext = (gameState: GameState): LeaderboardRankContext => {
  const history = Array.isArray(gameState.weeklyScoreHistory)
    ? gameState.weeklyScoreHistory
    : [];
  const latest = history[history.length - 1];
  const live = weeklyResultsAreLive(gameState.weeklyResults);
  const detail = !live && latest?.weeklyResults ? latest.weeklyResults : gameState.weeklyResults;
  const rawPot = detail?.finaleResults?.finalPotValue;
  const pot = typeof rawPot === "number" && Number.isFinite(rawPot) ? rawPot : null;
  return {
    tieBreakActive: Boolean(gameState.finaleConfig?.enabled) && typeof pot === "number",
    pot,
  };
};

const tieBreakDistanceFor = (
  player: PlayerEntry,
  context: LeaderboardRankContext
): number | null => {
  if (!context.tieBreakActive || typeof context.pot !== "number") return null;
  return getFinaleTieBreakDistance(player, context.pot);
};

export interface CurrentStanding {
  playerId: string;
  name: string;
  score: number;
  tieBreakDistance: number | null;
}

/** Current standings in leaderboard order. Scores come from calculatePlayerScore. */
export const currentStandings = (gameState: GameState): CurrentStanding[] => {
  const context = leaderboardRankContext(gameState);
  return gameState.players
    .map((player) => {
      const scoring = calculatePlayerScore(gameState, player);
      return {
        playerId: player.id,
        name: player.name,
        score: resolveDisplayTotal(gameState, player.id, scoring.total, {
          draftPredictionPoints: scoring.draftPredictionPoints,
          weeklyCallPoints: scoring.weeklyCallPoints,
        }),
        tieBreakDistance: tieBreakDistanceFor(player, context),
      };
    })
    .sort((a, b) =>
      compareStandingEntries(
        { name: a.name, displayTotal: a.score, tieBreakDistance: a.tieBreakDistance },
        { name: b.name, displayTotal: b.score, tieBreakDistance: b.tieBreakDistance }
      )
    );
};

export interface HomePodiumEntry {
  name: string;
  score: number;
  portraitUrl?: string;
  league: League;
}

export interface HomeSeasonMvp {
  name: string;
  score: number;
  portraitUrl?: string;
  label: "Season MVP";
}

export interface HomeStandingsBoard {
  mvp: HomeSeasonMvp | null;
  finalStandings: HomePodiumEntry[];
}

const leagueOf = (player: PlayerEntry | undefined): League =>
  player?.league === "jr" ? "jr" : "main";

/**
 * Home Season MVP and podium. Order and scores are currentStandings, so a
 * finale pot that remains only on the archived snapshot ranks Home with the
 * Leaderboard and recap. Portrait and league still come from the player row.
 */
export const homeStandingsBoard = (gameState: GameState): HomeStandingsBoard => {
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const finalStandings = currentStandings(gameState)
    .slice(0, 3)
    .map((row) => {
      const player = playersById.get(row.playerId);
      const entry: HomePodiumEntry = {
        name: row.name,
        score: row.score,
        league: leagueOf(player),
      };
      if (typeof player?.portraitUrl === "string") entry.portraitUrl = player.portraitUrl;
      return entry;
    });
  const top = finalStandings[0];
  return {
    mvp: top
      ? {
          name: top.name,
          score: top.score,
          portraitUrl: top.portraitUrl,
          label: "Season MVP",
        }
      : null,
    finalStandings,
  };
};
