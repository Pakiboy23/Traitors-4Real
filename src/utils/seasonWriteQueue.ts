import { normalizeWeekId } from "../../types.ts";

/**
 * One write chain per season.
 *
 * saveSeasonState writes season_states and then updates the seasons row.
 * Two of those promises can overlap: the newer write lands, then the older
 * one lands and is what remains, while the newer promise resolves last and
 * looks authoritative. Chaining the writes keeps the order equal to the
 * order the saves were started in this process.
 *
 * Tabs and devices have their own maps. writeSeasonState also compares
 * season_states.updated_at so an older in-flight write cannot replace a
 * newer snapshot that already landed.
 */
export const enqueueSeasonWrite = <T>(
  chains: Map<string, Promise<unknown>>,
  seasonId: string,
  write: () => Promise<T>
): Promise<T> => {
  const key = normalizeWeekId(seasonId) || seasonId;
  const previous = chains.get(key) ?? Promise.resolve();
  const run = previous.then(write, write);
  chains.set(key, run);
  const dropIfTail = () => {
    if (chains.get(key) === run) chains.delete(key);
  };
  void run.then(dropIfTail, dropIfTail);
  return run;
};

export class SeasonStateWriteConflict extends Error {
  constructor(message = "Season state changed while saving. Reload and try again.") {
    super(message);
    this.name = "SeasonStateWriteConflict";
  }
}

/** Stored snapshot timestamp used as the compare-and-swap token, or null to insert. */
export const seasonStateCasExpected = (
  storedUpdatedAt: string | null | undefined
): string | null =>
  typeof storedUpdatedAt === "string" && storedUpdatedAt.trim() ? storedUpdatedAt : null;

export const assertSeasonStateCasApplied = (updatedRows: number): void => {
  if (!Number.isInteger(updatedRows) || updatedRows < 1) {
    throw new SeasonStateWriteConflict();
  }
};
