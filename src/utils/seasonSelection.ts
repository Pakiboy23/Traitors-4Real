import type { SeasonConfig } from "../../types";

/**
 * Chooses the season a device lands on.
 *
 * A remembered choice is honoured while that season is still current. Once it
 * is archived the memory would pin the device to a closed season forever — the
 * bundled iOS build has no address bar and no way to clear storage — so any
 * current season wins over it. The remembered archived season is still used
 * when nothing current exists, so a wholly archived league can be browsed.
 */
export const pickPreferredSeason = (
  records: SeasonConfig[],
  rememberedSeasonId: string | null | undefined
): SeasonConfig | null => {
  if (records.length === 0) return null;

  const remembered = rememberedSeasonId
    ? records.find((season) => season.seasonId === rememberedSeasonId)
    : undefined;
  const current = records.find((season) => season.status !== "archived");

  if (remembered && (remembered.status !== "archived" || !current)) {
    return remembered;
  }
  return current ?? records[0];
};
