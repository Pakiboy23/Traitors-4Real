import type { ScoreAdjustment } from "../../types";

/**
 * AdminPanel copies `score_adjustments` into `gameState` on mount. Autosave
 * then writes the whole `season_states` JSON 500ms later. Public standings
 * read that JSON copy — the table itself is admin-only and is not broadcast.
 *
 * A failed list used to come back as `[]`, which replaced live adjustments
 * and published a zeroed board. A fetch that started before the commissioner
 * added or removed a row can do the same if it is allowed to land late. A
 * write begun on one season must not bump another season's revision or apply
 * its snapshot after a load of a different board.
 */
export type ScoreAdjustmentHydrationDecision =
  | { apply: false }
  | { apply: true; records: ScoreAdjustment[] };

export function bumpSeasonScopedCounter(
  counters: Record<string, number>,
  seasonId: string
): number {
  const next = (counters[seasonId] ?? 0) + 1;
  counters[seasonId] = next;
  return next;
}

export function readSeasonScopedCounter(
  counters: Record<string, number>,
  seasonId: string
): number {
  return counters[seasonId] ?? 0;
}

export function isSameScoreAdjustmentSeason(
  seasonIdAtStart: string,
  seasonIdNow: string | null | undefined
): boolean {
  return Boolean(seasonIdAtStart) && seasonIdAtStart === seasonIdNow;
}

export function decideScoreAdjustmentHydration(input: {
  /** This response belongs to the newest list started for this season. */
  isLatestFetch: boolean;
  /** Local add/remove revision when the fetch started, and now. */
  writeRevisionAtFetchStart: number;
  writeRevisionNow: number;
  /** Season the list was started for, and the board currently on screen. */
  seasonIdAtStart: string;
  seasonIdNow: string | null | undefined;
  records: unknown;
}): ScoreAdjustmentHydrationDecision {
  if (!isSameScoreAdjustmentSeason(input.seasonIdAtStart, input.seasonIdNow)) {
    return { apply: false };
  }
  if (!input.isLatestFetch) return { apply: false };
  if (input.writeRevisionNow !== input.writeRevisionAtFetchStart) {
    return { apply: false };
  }
  if (!Array.isArray(input.records)) return { apply: false };
  return { apply: true, records: input.records as ScoreAdjustment[] };
}
