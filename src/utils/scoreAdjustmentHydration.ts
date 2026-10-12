import type { ScoreAdjustment } from "../../types";

/**
 * AdminPanel copies `score_adjustments` into `gameState` on mount. Autosave
 * then writes the whole `season_states` JSON 500ms later. Public standings
 * read that JSON copy — the table itself is admin-only and is not broadcast.
 *
 * A failed list used to come back as `[]`, which replaced live adjustments
 * and published a zeroed board. A fetch that started before the commissioner
 * added or removed a row can do the same if it is allowed to land late.
 */
export type ScoreAdjustmentHydrationDecision =
  | { apply: false }
  | { apply: true; records: ScoreAdjustment[] };

export function decideScoreAdjustmentHydration(input: {
  /** This response belongs to the newest list started for this panel. */
  isLatestFetch: boolean;
  /** Local add/remove revision when the fetch started, and now. */
  writeRevisionAtFetchStart: number;
  writeRevisionNow: number;
  records: unknown;
}): ScoreAdjustmentHydrationDecision {
  if (!input.isLatestFetch) return { apply: false };
  if (input.writeRevisionNow !== input.writeRevisionAtFetchStart) {
    return { apply: false };
  }
  if (!Array.isArray(input.records)) return { apply: false };
  return { apply: true, records: input.records as ScoreAdjustment[] };
}
