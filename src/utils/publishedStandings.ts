import type { GameState, ScoreAdjustment, SeasonConfig } from "../../types.ts";
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
import { isPrivateRosterId, nameSlug, publicRosterIds } from "./publicRosterIds.ts";

export { isEmailShapedId, isPrivateRosterId, publicRosterIds } from "./publicRosterIds.ts";

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

const parsedTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * saveSeasonState writes the snapshot first, then copies finale and week onto
 * the seasons row. A snapshot timestamp that is newer than the season row is
 * that gap: the results are new and the row's finale flag is still the old one.
 */
export const snapshotAheadOfSeasonRow = (
  seasonUpdatedAt: string | null | undefined,
  stateUpdatedAt: string | null | undefined
): boolean => {
  const season = parsedTimestamp(seasonUpdatedAt);
  const state = parsedTimestamp(stateUpdatedAt);
  if (season === null || state === null) return false;
  return state > season;
};

const snapshotRecord = (state: unknown): Record<string, unknown> =>
  state && typeof state === "object" && !Array.isArray(state)
    ? (state as Record<string, unknown>)
    : {};

const snapshotString = (state: Record<string, unknown>, key: string): string | null => {
  const direct = state[key];
  if (typeof direct === "string" && direct.trim()) return direct;
  const nested = snapshotRecord(state.seasonConfig)[key];
  return typeof nested === "string" && nested.trim() ? nested : null;
};

/**
 * When the snapshot is ahead of the seasons row, score the snapshot's own
 * finale, week, and rule pack. Overlaying the row would publish one board
 * made of two versions.
 */
export const standingsSeasonForSnapshot = (
  season: SeasonStandingsRecord,
  state: unknown,
  timestamps: {
    seasonUpdatedAt?: string | null;
    stateUpdatedAt?: string | null;
  }
): SeasonStandingsRecord => {
  if (!snapshotAheadOfSeasonRow(timestamps.seasonUpdatedAt, timestamps.stateUpdatedAt)) {
    return season;
  }
  const snapshot = snapshotRecord(state);
  const week = snapshotString(snapshot, "activeWeekId");
  const rulePack = snapshotString(snapshot, "rulePackId");
  const finale = snapshot.finaleConfig ?? snapshotRecord(snapshot.seasonConfig).finaleConfig;
  return {
    ...season,
    ...(week ? { active_week_id: week } : {}),
    ...(finale ? { finale_config: finale } : {}),
    ...(rulePack ? { rule_pack_id: rulePack } : {}),
  };
};

/**
 * Re-read while the snapshot is ahead of the season row. The last successful
 * attempt is returned either way so the caller can score the snapshot's own
 * lifecycle fields. A later transient failure keeps that value instead of
 * failing the request.
 */
export const readUntilSeasonRowCatchesUp = async <T>(
  read: () => Promise<{
    seasonUpdatedAt: string | null;
    stateUpdatedAt: string | null;
    value: T;
  }>,
  attempts = 3,
  wait: (attempt: number) => Promise<void> = async () => undefined
): Promise<{ value: T; snapshotAhead: boolean }> => {
  const tries = Math.max(1, attempts);
  let last: { value: T; snapshotAhead: boolean } | null = null;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      const row = await read();
      const snapshotAhead = snapshotAheadOfSeasonRow(row.seasonUpdatedAt, row.stateUpdatedAt);
      last = { value: row.value, snapshotAhead };
      if (!snapshotAhead || attempt === tries - 1) return last;
      await wait(attempt);
    } catch (error) {
      if (last) return { value: last.value, snapshotAhead: true };
      throw error;
    }
  }
  return last as { value: T; snapshotAhead: boolean };
};

const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const publishedStandingsFromGameState = (gameState: GameState): PublishedStandings => {
  const rosterIds = publicRosterIds(gameState.players);
  const rows = currentStandings(gameState).map((row, index) => {
    const player = gameState.players[row.playerIndex];
    const draft = player ? calculatePlayerScore(gameState, player).draftPredictionPoints : 0;
    const publicId =
      rosterIds[row.playerIndex] || nameSlug(row.name) || `player-${row.playerIndex + 1}`;
    return {
      playerId: publicId,
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
export const gameStateForStandings = (
  input: {
    season: SeasonStandingsRecord;
    state: unknown;
    showConfig?: unknown | null;
  },
  now: number = Date.now()
): GameState => {
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
  const normalized = normalizeGameState(
    {
      ...isolated,
      rulePackId: seasonConfig.rulePackId,
    },
    now
  );
  if (input.showConfig == null) return normalized;
  return normalizeGameState(
    {
      ...normalized,
      showConfig: sanitizeShowConfig(input.showConfig),
    },
    now
  );
};

/** score_adjustments row, as PostgREST returns it. Points may arrive as a string. */
export interface ScoreAdjustmentRow {
  id: string;
  season_id: string;
  player_id: string;
  week_id?: string | null;
  reason: string;
  points: number | string;
  created_by_label?: string | null;
  created_at?: string | null;
}

export const scoreAdjustmentsFromRows = (
  rows: readonly ScoreAdjustmentRow[]
): ScoreAdjustment[] =>
  rows.flatMap((row) => {
    const points = typeof row.points === "number" ? row.points : Number(row.points);
    if (
      typeof row.id !== "string" ||
      !row.id ||
      typeof row.player_id !== "string" ||
      !row.player_id ||
      typeof row.season_id !== "string" ||
      !row.season_id ||
      typeof row.reason !== "string" ||
      !row.reason ||
      !Number.isFinite(points)
    ) {
      return [];
    }
    return [
      {
        id: row.id,
        seasonId: row.season_id,
        playerId: row.player_id,
        weekId: row.week_id ?? undefined,
        reason: row.reason,
        points,
        createdBy: row.created_by_label || "admin",
        createdAt: row.created_at || "1970-01-01T00:00:00.000Z",
      },
    ];
  });

const isPendingLocalAdjustment = (value: unknown): value is ScoreAdjustment => {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ScoreAdjustment>;
  return (
    typeof row.id === "string" &&
    row.id.startsWith("local-") &&
    typeof row.playerId === "string" &&
    typeof row.reason === "string" &&
    typeof row.points === "number"
  );
};

/**
 * The score_adjustments table is the list the admin restores.
 * A successful read replaces the copy inside the season snapshot, which is
 * written later by the debounced save and can be missing or stale.
 * Rows the admin added locally after a failed insert stay. Their ids start
 * with `local-`. When that suffix is the id of a row the table already
 * committed, the local copy is the same correction and is not scored again.
 */
export const stateWithAuthoritativeAdjustments = (
  state: unknown,
  adjustments: readonly ScoreAdjustment[]
): unknown => {
  const base =
    state && typeof state === "object" && !Array.isArray(state)
      ? { ...(state as Record<string, unknown>) }
      : {};
  const tableIds = new Set(adjustments.map((row) => row.id));
  const pending = Array.isArray(base.scoreAdjustments)
    ? base.scoreAdjustments.filter((row) => {
        if (!isPendingLocalAdjustment(row) || tableIds.has(row.id)) return false;
        const requestId = row.id.startsWith("local-") ? row.id.slice("local-".length) : "";
        return !requestId || !tableIds.has(requestId);
      })
    : [];
  return { ...base, scoreAdjustments: [...adjustments, ...pending] };
};

/** PostgREST's default max rows. A full page means another page exists. */
export const ADJUSTMENT_PAGE_SIZE = 1000;

export type ScoreAdjustmentPage = {
  data: readonly ScoreAdjustmentRow[] | null;
  error: { message: string } | null;
};

/**
 * Every score_adjustments row for the season.
 * A failed page fails the read. Returning the pages already collected would
 * replace the snapshot with a truncated list and drop older corrections.
 */
export const collectScoreAdjustmentRows = async (
  fetchPage: (from: number, to: number) => Promise<ScoreAdjustmentPage>,
  pageSize: number = ADJUSTMENT_PAGE_SIZE
): Promise<{ rows: ScoreAdjustmentRow[] } | { error: string }> => {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    return { error: "Score adjustments page size is invalid." };
  }
  const rows: ScoreAdjustmentRow[] = [];
  let from = 0;
  for (;;) {
    const page = await fetchPage(from, from + pageSize - 1);
    if (page.error) return { error: page.error.message || "Score adjustments read failed." };
    const data = page.data ?? [];
    rows.push(...data);
    if (data.length < pageSize) return { rows };
    from += pageSize;
  }
};

export const standingsResponseFromRecords = (
  input: {
    season: SeasonStandingsRecord;
    state: unknown;
    showConfig?: unknown | null;
  },
  now: number = Date.now()
): PublishedStandings =>
  publishedStandingsFromGameState(gameStateForStandings(input, now));

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
  if (isPrivateRosterId(row.playerId)) return null;
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
  const playerIds = publicRosterIds(gameState.players);
  if (!sameStandingRoster(standings, playerIds)) return null;
  return standings;
};

/** Home podium from a server board. Portrait and league still come from the player row. */
export const homeBoardFromStandings = (
  gameState: GameState,
  standings: PublishedStandings
): HomeStandingsBoard => {
  const rosterIds = publicRosterIds(gameState.players);
  const playersByPublicId = new Map(
    gameState.players.map((player, index) => [rosterIds[index], player])
  );
  const finalStandings = standings.rows.slice(0, 3).map((row) => {
    const player = playersByPublicId.get(row.playerId);
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

export interface PublishedWeekMovement {
  name: string;
  delta: number;
  league: "main" | "jr";
  portraitUrl?: string;
}

/**
 * Home weekly MVP and top movers from the published weekDelta.
 * That delta includes season-wide adjustments scored after the latest archive.
 * Snapshot subtraction does not, so the two must not be mixed on one screen.
 */
export const publishedWeekMovement = (
  gameState: GameState,
  standings: PublishedStandings
): PublishedWeekMovement[] => {
  const rosterIds = publicRosterIds(gameState.players);
  const playersByPublicId = new Map(
    gameState.players.map((player, index) => [rosterIds[index], player])
  );
  return standings.rows
    .filter(
      (row): row is PublishedStandingRow & { weekDelta: number } =>
        typeof row.weekDelta === "number"
    )
    .map((row) => {
      const player = playersByPublicId.get(row.playerId);
      const entry: PublishedWeekMovement = {
        name: row.name,
        delta: row.weekDelta,
        league: player?.league === "jr" ? "jr" : "main",
      };
      if (typeof player?.portraitUrl === "string") entry.portraitUrl = player.portraitUrl;
      return entry;
    })
    .sort((a, b) => b.delta - a.delta || a.name.localeCompare(b.name));
};

/**
 * Movement Home may take from a published board.
 * An empty list means the server has no week deltas, which is the first
 * archive. Home then keeps the local calculation that treats the prior total
 * as zero. An empty array must not count as a published movement.
 */
export const homeWeekMovement = (
  gameState: GameState,
  standings: PublishedStandings | null
): PublishedWeekMovement[] | null => {
  if (!standings) return null;
  const movement = publishedWeekMovement(gameState, standings);
  return movement.length > 0 ? movement : null;
};

/**
 * Recap rows keep their week movement and take score and order from the server
 * board. Rows that carry a public roster id match on that id, so two players
 * with the same display name still use the server scores. Older rows with no
 * id match on a unique name. Returns null when a row cannot be matched, so
 * the caller keeps the local recap.
 */
export const orderByPublishedStandings = <
  T extends { name: string; score: number; rank: number; playerId?: string },
>(
  rows: readonly T[],
  standings: PublishedStandings
): T[] | null => {
  if (rows.length !== standings.rows.length) return null;
  const identified = rows.every(
    (row) => typeof row.playerId === "string" && row.playerId.length > 0
  );
  if (identified) {
    const byPublicId = new Map(standings.rows.map((row) => [row.playerId, row]));
    const seen = new Set<string>();
    for (const row of rows) {
      const playerId = row.playerId ?? "";
      if (seen.has(playerId) || !byPublicId.has(playerId)) return null;
      seen.add(playerId);
    }
    return rows
      .map((row) => {
        const server = byPublicId.get(row.playerId ?? "");
        if (!server) return row;
        return { ...row, score: server.score, rank: server.rank };
      })
      .sort((a, b) => a.rank - b.rank);
  }
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
