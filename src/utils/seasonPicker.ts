import { normalizeWeekId, type SeasonConfig } from "../../types";

type SeasonRef = Pick<SeasonConfig, "seasonId" | "status">;

/**
 * Which season a player lands on.
 *
 * A stored id is honoured only when that season is live. Otherwise a leftover
 * draft clone or an archived row would beat the real league — which is how the
 * App Store build opened onto an empty "New blood" season the day after the
 * live New Blood row was archived.
 */
export const pickPreferredSeasonId = (
  records: SeasonRef[],
  storedId?: string | null
): string | null => {
  if (records.length === 0) return null;

  const stored = normalizeWeekId(storedId);
  const storedLive = stored
    ? records.find((season) => season.seasonId === stored && season.status === "live")
    : undefined;
  const live = records.find((season) => season.status === "live");
  const notArchived = records.find((season) => season.status !== "archived");

  return (storedLive ?? live ?? notArchived ?? records[0]).seasonId;
};
