import type {
  GameState,
  WeeklyRecapRecord,
  WeeklyResults,
  WeeklyScoreSnapshot,
} from "../../types";
import { normalizeWeekId, resolveActiveWeekId } from "../../types";
import { currentStandings } from "./standings";

export const RECAP_PUBLIC_ORIGIN = "https://traitorsfantasydraft.online";
const INTRO_LIMIT = 2000;

export interface RecapEpisodeResults {
  banished: string | null;
  murdered: string | null;
  shield: string | null;
  newTraitors: string[];
}

export interface RecapStanding {
  rank: number;
  name: string;
  score: number;
  /** Points gained that week. Null when history can't support it. */
  weekDelta: number | null;
  /** Positive means they moved up the table versus the previous snapshot. */
  rankDelta: number | null;
}

export interface PublicWeeklyRecap {
  seasonId: string;
  seasonLabel: string;
  leagueName: string;
  weekId: string;
  weekLabel: string;
  intro: string;
  published: boolean;
  results: RecapEpisodeResults;
  standings: RecapStanding[];
}

const emptyResults = (): RecapEpisodeResults => ({
  banished: null,
  murdered: null,
  shield: null,
  newTraitors: [],
});

const blankToNull = (value?: string | null): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const recapPath = (seasonId: string, weekId: string): string =>
  `/recap/${encodeURIComponent(seasonId)}/${encodeURIComponent(weekId)}`;

export const publicRecapUrl = (seasonId: string, weekId: string): string =>
  `${RECAP_PUBLIC_ORIGIN}${recapPath(seasonId, weekId)}`;

export const weekLabelFromId = (weekId: string, snapshotLabel?: string | null): string => {
  const label = typeof snapshotLabel === "string" ? snapshotLabel.trim() : "";
  if (label) return label;
  const match = /^week-(\d+)$/i.exec(weekId);
  if (match) return `Week ${match[1]}`;
  return weekId;
};

export const sanitizeWeeklyRecaps = (input: unknown): WeeklyRecapRecord[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const records: WeeklyRecapRecord[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as Partial<WeeklyRecapRecord>;
    const weekId = normalizeWeekId(record.weekId);
    if (!weekId || seen.has(weekId)) continue;
    seen.add(weekId);
    const intro = typeof record.intro === "string" ? record.intro.slice(0, INTRO_LIMIT) : "";
    const publishedAt =
      typeof record.publishedAt === "string" && record.publishedAt.trim()
        ? record.publishedAt
        : null;
    records.push({
      weekId,
      intro,
      published: record.published === true,
      publishedAt,
    });
  }
  return records;
};

export const recapRecordFor = (
  state: Pick<GameState, "weeklyRecaps"> | null | undefined,
  weekId: string
): WeeklyRecapRecord | null =>
  sanitizeWeeklyRecaps(state?.weeklyRecaps).find((record) => record.weekId === weekId) ?? null;

export const upsertWeeklyRecap = (
  existing: WeeklyRecapRecord[] | null | undefined,
  next: WeeklyRecapRecord
): WeeklyRecapRecord[] => {
  const weekId = normalizeWeekId(next.weekId);
  if (!weekId) return sanitizeWeeklyRecaps(existing);
  return sanitizeWeeklyRecaps([
    ...sanitizeWeeklyRecaps(existing).filter((record) => record.weekId !== weekId),
    { ...next, weekId },
  ]);
};

const historyOf = (state: GameState): WeeklyScoreSnapshot[] =>
  Array.isArray(state.weeklyScoreHistory) ? state.weeklyScoreHistory : [];

export const weekResultsFor = (state: GameState, weekId: string): WeeklyResults | null => {
  const currentId = normalizeWeekId(state.weeklyResults?.weekId);
  if (currentId === weekId && state.weeklyResults) return state.weeklyResults;
  const history = historyOf(state);
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const snapshot = history[index];
    if (normalizeWeekId(snapshot?.weeklyResults?.weekId) === weekId && snapshot?.weeklyResults) {
      return snapshot.weeklyResults;
    }
  }
  const active = resolveActiveWeekId(state);
  if (weekId === active && !currentId && state.weeklyResults) return state.weeklyResults;
  return null;
};

const episodeResults = (results: WeeklyResults | null): RecapEpisodeResults => {
  const traitors = Array.isArray(results?.bonusGames?.traitorTrio)
    ? results.bonusGames.traitorTrio.map((name) => name.trim()).filter((name) => name.length > 0)
    : [];
  return {
    banished: blankToNull(results?.nextBanished),
    murdered: blankToNull(results?.nextMurdered),
    shield: blankToNull(results?.bonusGames?.shieldGambit),
    newTraitors: traitors,
  };
};

const snapshotIndexForWeek = (history: WeeklyScoreSnapshot[], weekId: string): number =>
  history.findIndex((snapshot) => normalizeWeekId(snapshot.weeklyResults?.weekId) === weekId);

const rankByTotals = (
  namesById: Map<string, string>,
  totals: Record<string, number> | null | undefined
): Map<string, number> => {
  const rows = [...namesById.entries()]
    .map(([playerId, name]) => ({
      playerId,
      name,
      total: totals?.[playerId],
    }))
    .filter((row): row is { playerId: string; name: string; total: number } =>
      typeof row.total === "number"
    )
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });
  return new Map(rows.map((row, index) => [row.playerId, index + 1]));
};

const movementFor = (
  state: GameState,
  weekId: string,
  playerId: string,
  liveScore: number,
  liveRank: number
): { weekDelta: number | null; rankDelta: number | null } => {
  const history = historyOf(state);
  const namesById = new Map(state.players.map((player) => [player.id, player.name]));
  const index = snapshotIndexForWeek(history, weekId);
  const active = resolveActiveWeekId(state);

  if (index >= 0) {
    const currentTotals = history[index]?.totals ?? {};
    const current = currentTotals[playerId];
    const previousTotals = index > 0 ? history[index - 1]?.totals ?? {} : null;
    const weekDelta =
      typeof current !== "number"
        ? null
        : previousTotals
          ? typeof previousTotals[playerId] === "number"
            ? current - previousTotals[playerId]
            : null
          : current;
    if (!previousTotals) return { weekDelta, rankDelta: null };
    const snapshotRank = rankByTotals(namesById, currentTotals).get(playerId);
    const previousRank = rankByTotals(namesById, previousTotals).get(playerId);
    const rankDelta =
      typeof snapshotRank === "number" && typeof previousRank === "number"
        ? previousRank - snapshotRank
        : null;
    return { weekDelta, rankDelta };
  }

  if (weekId !== active || history.length === 0) return { weekDelta: null, rankDelta: null };
  const previousTotals = history[history.length - 1]?.totals ?? {};
  const previous = previousTotals[playerId];
  const weekDelta = typeof previous === "number" ? liveScore - previous : null;
  const previousRank = rankByTotals(namesById, previousTotals).get(playerId);
  const rankDelta = typeof previousRank === "number" ? previousRank - liveRank : null;
  return { weekDelta, rankDelta };
};

const unpublishedRecap = (
  state: GameState,
  weekId: string,
  seasonId: string
): PublicWeeklyRecap => ({
  seasonId,
  seasonLabel: state.seasonConfig?.label || seasonId,
  leagueName: state.showConfig?.leagueName || "Round Table Draft",
  weekId,
  weekLabel: weekLabelFromId(weekId),
  intro: "",
  published: false,
  results: emptyResults(),
  standings: [],
});

/**
 * Public recap for one week. Standings use calculatePlayerScore via
 * currentStandings — the same numbers as the Leaderboard. Unpublished weeks
 * return no episode results and no table.
 */
export const buildPublicWeeklyRecap = (
  state: GameState,
  weekIdInput: string
): PublicWeeklyRecap | null => {
  const weekId = normalizeWeekId(weekIdInput);
  if (!weekId) return null;
  const seasonId =
    normalizeWeekId(state.seasonId) ??
    normalizeWeekId(state.seasonConfig?.seasonId) ??
    "season";
  const record = recapRecordFor(state, weekId);
  if (!record?.published) return unpublishedRecap(state, weekId, seasonId);

  const history = historyOf(state);
  const snapshot = history.find(
    (entry) => normalizeWeekId(entry.weeklyResults?.weekId) === weekId
  );
  const standings = currentStandings(state);
  return {
    seasonId,
    seasonLabel: state.seasonConfig?.label || seasonId,
    leagueName: state.showConfig?.leagueName || "Round Table Draft",
    weekId,
    weekLabel: weekLabelFromId(weekId, snapshot?.label),
    intro: record.intro.trim(),
    published: true,
    results: episodeResults(weekResultsFor(state, weekId)),
    standings: standings.map((row, index) => {
      const rank = index + 1;
      const movement = movementFor(state, weekId, row.playerId, row.score, rank);
      return {
        rank,
        name: row.name,
        score: row.score,
        weekDelta: movement.weekDelta,
        rankDelta: movement.rankDelta,
      };
    }),
  };
};

export const recapShareDescription = (recap: PublicWeeklyRecap): string => {
  const intro = recap.intro.trim();
  if (intro) return intro.slice(0, 200);
  const bits: string[] = [];
  if (recap.results.banished) bits.push(`Banished: ${recap.results.banished}`);
  if (recap.results.murdered) bits.push(`Murdered: ${recap.results.murdered}`);
  if (recap.results.shield) bits.push(`Shield: ${recap.results.shield}`);
  if (recap.results.newTraitors.length > 0) {
    bits.push(`New Traitors: ${recap.results.newTraitors.join(", ")}`);
  }
  const leader = recap.standings[0];
  if (leader) bits.push(`Leader: ${leader.name}`);
  return bits.join(" · ") || "Weekly standings and episode results.";
};

/** Keys that must never appear on the public recap payload. */
export const PUBLIC_RECAP_FORBIDDEN_KEYS = [
  "email",
  "portraitUrl",
  "picks",
  "predTraitors",
  "weeklyPredictions",
  "weeklySubmissionHistory",
  "createdBy",
] as const;

export const publicRecapHasForbiddenKey = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => publicRecapHasForbiddenKey(item));
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    if ((PUBLIC_RECAP_FORBIDDEN_KEYS as readonly string[]).includes(key)) return true;
    return publicRecapHasForbiddenKey(nested);
  });
};
