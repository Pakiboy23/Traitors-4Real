import { normalizeWeekId } from "../../types.ts";

/**
 * One write chain per season.
 *
 * saveSeasonState upserts season_states and then updates the seasons row.
 * Two of those promises can overlap: the newer upsert lands, then the older
 * one lands and is what remains, while the newer promise resolves last and
 * looks authoritative. Chaining the writes keeps the upsert order equal to
 * the order the saves were started.
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
