import type { GameState, SeasonConfig } from "../../types.ts";
import { normalizeWeekId } from "../../types.ts";
import { sanitizeSeasonConfig, sanitizeShowConfig } from "../config/validation.ts";
import { normalizeGameState } from "./normalizeGameState.ts";
import { calculatePlayerScore } from "./scoring.ts";
import { redactPublicSeasonState } from "./publicRedaction.ts";
import { isolateSeasonGameplay, rosterForSeason } from "./seasonAuthority.ts";
import {
  currentStandings,
  displayedWeekDelta,
  seasonTimeline,
  type HomeStandingsBoard,
  type SeasonTimelinePoint,
} from "./standings.ts";

/**
 * Board the site and the app both render.
 *
 * Computed by the season-standings Edge Function from the same standings.ts
 * path the website uses. Clients draw this payload. They fall back to a local
 * currentStandings call only when the function cannot be reached.
 */
export interface PublishedStandingRow {
  playerId: string;
  name: string;
  score: number;
  tieBreakDistance: number | null;
  weekDelta: number | null;
  rank: number;
  timeline: SeasonTimelinePoint[];
}

export interface PublishedStandings {
  seasonId: string;
  rows: PublishedStandingRow[];
}

/** seasons row columns the standings read needs. Snake case, as PostgREST returns it. */
export interface SeasonStandingsRecord {
  season_id: string;
  label: string;
  status: string;
  timezone: string;
  lock_schedule: unknown;
  active_week_id: string | null;
  finale_config: unknown;
  rule_pack_id: string | null;
}

const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const publishedStandingsFromGameState = (gameState: GameState): PublishedStandings => {
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const rows = currentStandings(gameState).map((row, index) => {
    const player = playersById.get(row.playerId);
    const draft = player ? calculatePlayerScore(gameState, player).draftPredictionPoints : 0;
    return {
      playerId: row.playerId,
      name: row.name,
      score: row.score,
      tieBreakDistance: row.tieBreakDistance,
      weekDelta: displayedWeekDelta(gameState, row.playerId, row.score),
      rank: index + 1,
      timeline: seasonTimeline(gameState, row.playerId, draft),
    };
  });
  return {
    seasonId: normalizeWeekId(gameState.seasonId) ?? "",
    rows,
  };
};

const seasonConfigFromRecord = (season: SeasonStandingsRecord): SeasonConfig =>
  sanitizeSeasonConfig(
    {
      seasonId: season.season_id,
      label: season.label,
      status: season.status,
      timezone: season.timezone,
      lockSchedule: season.lock_schedule,
      activeWeekId: season.active_week_id ?? undefined,
      finaleConfig: season.finale_config,
      rulePackId: season.rule_pack_id ?? undefined,
    },
    season.season_id
  );

/**
 * Same preparation the public client does before it scores: emails are
 * stripped so missing player IDs fall back to the name, the season row wins
 * for finale, lifecycle, and rule pack, foreign gameplay is stripped, then
 * show config is overlaid and the snapshot is normalized.
 */
export const gameStateForStandings = (input: {
  season: SeasonStandingsRecord;
  state: unknown;
  showConfig?: unknown | null;
}): GameState => {
  const seasonConfig = seasonConfigFromRecord(input.season);
  const raw = redactPublicSeasonState(
    input.state && typeof input.state === "object"
      ? (input.state as Partial<GameState>)
      : {}
  );
  const roster = rosterForSeason(
    seasonConfig.seasonId,
    Object.keys(raw.castStatus ?? {})
  );
  const isolated = isolateSeasonGameplay(
    { ...raw, seasonId: seasonConfig.seasonId },
    seasonConfig,
    roster
  );
  const normalized = normalizeGameState({
    ...isolated,
    rulePackId: seasonConfig.rulePackId,
  });
  if (input.showConfig == null) return normalized;
  return normalizeGameState({
    ...normalized,
    showConfig: sanitizeShowConfig(input.showConfig),
  });
};

export const standingsResponseFromRecords = (input: {
  season: SeasonStandingsRecord;
  state: unknown;
  showConfig?: unknown | null;
}): PublishedStandings =>
  publishedStandingsFromGameState(gameStateForStandings(input));

const parseTimeline = (value: unknown): SeasonTimelinePoint[] | null => {
  if (!Array.isArray(value)) return null;
  const points: SeasonTimelinePoint[] = [];
  for (const point of value) {
    if (!point || typeof point !== "object") return null;
    const label = (point as { label?: unknown }).label;
    const total = finite((point as { total?: unknown }).total);
    if (typeof label !== "string" || total === null) return null;
    points.push({ label, total });
  }
  return points;
};

const parseRow = (value: unknown): PublishedStandingRow | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const score = finite(row.score);
  const rank = finite(row.rank);
  const tieBreak = row.tieBreakDistance == null ? null : finite(row.tieBreakDistance);
  const weekDelta = row.weekDelta == null ? null : finite(row.weekDelta);
  const timeline = parseTimeline(row.timeline);
  if (typeof row.playerId !== "string" || !row.playerId.trim()) return null;
  if (typeof row.name !== "string") return null;
  if (score === null || rank === null || !Number.isInteger(rank) || rank < 1) return null;
  if (row.tieBreakDistance != null && tieBreak === null) return null;
  if (row.weekDelta != null && weekDelta === null) return null;
  if (!timeline) return null;
  return {
    playerId: row.playerId,
    name: row.name,
    score,
    tieBreakDistance: tieBreak,
    weekDelta,
    rank,
    timeline,
  };
};

/** Rejects error bodies and anything that is not a standings payload. */
export const parsePublishedStandings = (value: unknown): PublishedStandings | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const seasonId = normalizeWeekId(typeof record.seasonId === "string" ? record.seasonId : null);
  if (!seasonId || !Array.isArray(record.rows)) return null;
  const rows: PublishedStandingRow[] = [];
  for (const row of record.rows) {
    const parsed = parseRow(row);
    if (!parsed) return null;
    rows.push(parsed);
  }
  return { seasonId, rows };
};

export const sameStandingRoster = (
  standings: PublishedStandings,
  playerIds: readonly string[]
): boolean => {
  if (standings.rows.length !== playerIds.length) return false;
  const ids = new Set(standings.rows.map((row) => row.playerId));
  if (ids.size !== standings.rows.length) return false;
  return playerIds.every((id) => ids.has(id));
};

/**
 * Server board for this season, or null when the client should score locally.
 * A roster that does not match the players on screen is treated as stale.
 */
export const usablePublishedStandings = (
  standings: PublishedStandings | null | undefined,
  gameState: GameState
): PublishedStandings | null => {
  if (!standings) return null;
  const seasonId = normalizeWeekId(gameState.seasonId);
  if (!seasonId || standings.seasonId !== seasonId) return null;
  const playerIds = gameState.players.map((player) => player.id);
  if (!sameStandingRoster(standings, playerIds)) return null;
  return standings;
};

/** Home podium from a server board. Portrait and league still come from the player row. */
export const homeBoardFromStandings = (
  gameState: GameState,
  standings: PublishedStandings
): HomeStandingsBoard => {
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const finalStandings = standings.rows.slice(0, 3).map((row) => {
    const player = playersById.get(row.playerId);
    const entry: HomeStandingsBoard["finalStandings"][number] = {
      name: row.name,
      score: row.score,
      league: player?.league === "jr" ? "jr" : "main",
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

/**
 * Recap rows keep their week movement and take score and order from the server
 * board. Returns null when a name cannot be matched, so the caller keeps the
 * local recap.
 */
export const orderByPublishedStandings = <T extends { name: string; score: number; rank: number }>(
  rows: readonly T[],
  standings: PublishedStandings
): T[] | null => {
  if (rows.length !== standings.rows.length) return null;
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.name)) return null;
    seen.add(row.name);
  }
  const byName = new Map(standings.rows.map((row) => [row.name, row]));
  if (!rows.every((row) => byName.has(row.name))) return null;
  return rows
    .map((row) => {
      const server = byName.get(row.name);
      if (!server) return row;
      return { ...row, score: server.score, rank: server.rank };
    })
    .sort((a, b) => a.rank - b.rank);
};
