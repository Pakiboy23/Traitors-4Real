import type {
  GameState,
  WeeklyRecapRecord,
  WeeklyResults,
  WeeklyScoreSnapshot,
} from "../../types";
import { inferActiveWeekId, normalizeWeekId, resolveActiveWeekId } from "../../types";
import { currentStandings, runningTotalsRecord } from "./standings";

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

/** One published week on the public recap hub. Unpublished weeks never appear. */
export interface PublicRecapWeek {
  weekId: string;
  weekLabel: string;
  href: string;
  intro: string;
  publishedAt: string | null;
}

export interface PublicRecapIndex {
  seasonId: string;
  seasonLabel: string;
  leagueName: string;
  weeks: PublicRecapWeek[];
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

export const recapHubPath = (seasonId: string): string =>
  `/recap/${encodeURIComponent(seasonId)}`;

export const publicRecapHubUrl = (seasonId: string): string =>
  `${RECAP_PUBLIC_ORIGIN}${recapHubPath(seasonId)}`;

/** `/recap/week-2` is a short link onto the live season, not a season hub. */
export const isShortRecapWeek = (segment: string): boolean => /^week-\d+$/i.test(segment);

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

const weekSortKey = (weekId: string): number => {
  const match = /^week-(\d+)$/i.exec(weekId);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};

const compareRecapWeeks = (left: string, right: string): number => {
  const leftKey = weekSortKey(left);
  const rightKey = weekSortKey(right);
  const leftNumeric = Number.isFinite(leftKey);
  const rightNumeric = Number.isFinite(rightKey);
  if (leftNumeric && rightNumeric && leftKey !== rightKey) return leftKey - rightKey;
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left.localeCompare(right);
};

const snapshotLabelFor = (
  history: GameState["weeklyScoreHistory"],
  weekId: string
): string | null => {
  if (!Array.isArray(history)) return null;
  const snapshot = history.find(
    (entry) => normalizeWeekId(entry?.weeklyResults?.weekId) === weekId
  );
  return snapshot?.label ?? null;
};

export const formatRecapPublishedAt = (value: string | null | undefined): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

export const emptyPublicRecapIndex = (seasonId: string, seasonLabel?: string | null): PublicRecapIndex => ({
  seasonId,
  seasonLabel: seasonLabel?.trim() || seasonId,
  leagueName: "Round Table Draft",
  weeks: [],
});

/**
 * Published weeks for the public hub. Week pages use the same `published`
 * flag: a week shows up here only when `weeklyRecaps` marks it published.
 * Adding a week to that array is enough — nothing here lists week numbers.
 */
export const buildPublicRecapIndex = (
  state: Pick<
    GameState,
    "seasonId" | "seasonConfig" | "showConfig" | "weeklyRecaps" | "weeklyScoreHistory"
  > | null | undefined,
  seasonIdInput: string
): PublicRecapIndex | null => {
  const seasonId = seasonIdInput.trim();
  if (!seasonId || isShortRecapWeek(seasonId)) return null;
  const weeks = sanitizeWeeklyRecaps(state?.weeklyRecaps)
    .filter((record) => record.published)
    .map((record) => ({
      weekId: record.weekId,
      weekLabel: weekLabelFromId(
        record.weekId,
        snapshotLabelFor(state?.weeklyScoreHistory, record.weekId)
      ),
      href: recapPath(seasonId, record.weekId),
      intro: record.intro.trim(),
      publishedAt: record.publishedAt ?? null,
    }))
    .sort((left, right) => compareRecapWeeks(left.weekId, right.weekId));
  return {
    seasonId,
    seasonLabel: state?.seasonConfig?.label?.trim() || seasonId,
    leagueName: state?.showConfig?.leagueName?.trim() || "Round Table Draft",
    weeks,
  };
};

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

export interface RecapWeekOption {
  weekId: string;
  label: string;
}

type RecapWeekSource = Pick<GameState, "weeklyResults" | "activeWeekId" | "weeklyScoreHistory">;

/**
 * The week the recap editor opens on. Same source the editor used when it
 * could only publish the running week: `weeklyResults.weekId`, then the
 * inferred active week.
 */
export const activeRecapWeekId = (state: RecapWeekSource | null | undefined): string =>
  normalizeWeekId(state?.weeklyResults?.weekId) ??
  inferActiveWeekId({
    activeWeekId: state?.activeWeekId,
    weeklyScoreHistory: state?.weeklyScoreHistory,
  });

const recapOptionLabel = (weekId: string, snapshotLabel?: string | null): string => {
  const plain = weekLabelFromId(weekId);
  const labeled = weekLabelFromId(weekId, snapshotLabel);
  if (labeled === plain || labeled === weekId) return plain;
  return `${labeled} (${plain})`;
};

/**
 * Weeks the admin can publish a recap for. Archived snapshots come first, in
 * the order they were stored. The active week is added when it is not already
 * one of those snapshots, so a finished week stays editable after archive.
 */
export const recapEditorWeeks = (state: RecapWeekSource | null | undefined): RecapWeekOption[] => {
  const history = Array.isArray(state?.weeklyScoreHistory) ? state.weeklyScoreHistory : [];
  const seen = new Set<string>();
  const weeks: RecapWeekOption[] = [];
  for (const snapshot of history) {
    const weekId = normalizeWeekId(snapshot?.weeklyResults?.weekId);
    if (!weekId || seen.has(weekId)) continue;
    seen.add(weekId);
    weeks.push({ weekId, label: recapOptionLabel(weekId, snapshot?.label) });
  }
  const active = activeRecapWeekId(state);
  if (!seen.has(active)) {
    weeks.push({ weekId: active, label: recapOptionLabel(active) });
  }
  return weeks;
};

export type RecapEditorChange =
  | { kind: "intro"; weekId: string; intro: string }
  | { kind: "publish"; weekId: string; publishedAt: string }
  | { kind: "unpublish"; weekId: string };

/**
 * Intro, publish, and unpublish for one week. Other weeks' records stay put.
 * `published` is a JSON boolean on the stored record.
 */
export const applyRecapEditorChange = (
  recaps: WeeklyRecapRecord[] | null | undefined,
  change: RecapEditorChange
): WeeklyRecapRecord[] => {
  const existing = recapRecordFor({ weeklyRecaps: recaps }, change.weekId);
  switch (change.kind) {
    case "intro":
      return upsertWeeklyRecap(recaps, {
        weekId: change.weekId,
        intro: change.intro,
        published: existing?.published === true,
        publishedAt: existing?.publishedAt ?? null,
      });
    case "publish":
      return upsertWeeklyRecap(recaps, {
        weekId: change.weekId,
        intro: existing?.intro ?? "",
        published: true,
        publishedAt: existing?.publishedAt ?? change.publishedAt,
      });
    case "unpublish":
      return upsertWeeklyRecap(recaps, {
        weekId: change.weekId,
        intro: existing?.intro ?? "",
        published: false,
        publishedAt: existing?.publishedAt ?? null,
      });
    default: {
      const _exhaustive: never = change;
      return _exhaustive;
    }
  }
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
    const currentTotals = runningTotalsRecord(history, index, namesById.keys(), state);
    const current = currentTotals[playerId];
    const previousTotals =
      index > 0 ? runningTotalsRecord(history, index - 1, namesById.keys(), state) : null;
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
  const previousTotals = runningTotalsRecord(history, history.length - 1, namesById.keys(), state);
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
