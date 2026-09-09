import { describe, expect, it } from "vitest";
import type { SeasonConfig } from "../../types";
import { pickPreferredSeasonId } from "./seasonPicker";

const season = (
  seasonId: string,
  status: SeasonConfig["status"]
): Pick<SeasonConfig, "seasonId" | "status"> => ({ seasonId, status });

describe("pickPreferredSeasonId", () => {
  const live = season("traitors-new-blood-s1", "live");
  const clone = season("traitors new blood", "draft");
  const legacy = season("season-legacy", "finalized");
  const archived = season("old-season", "archived");

  it("prefers the live season over a newer draft clone", () => {
    expect(pickPreferredSeasonId([clone, live, legacy])).toBe(live.seasonId);
  });

  it("ignores a stored draft or archived id when a live season exists", () => {
    expect(pickPreferredSeasonId([clone, live, archived], clone.seasonId)).toBe(
      live.seasonId
    );
    expect(pickPreferredSeasonId([archived, live], archived.seasonId)).toBe(
      live.seasonId
    );
  });

  it("keeps a stored live season", () => {
    const otherLive = season("other-live", "live");
    expect(pickPreferredSeasonId([clone, live, otherLive], live.seasonId)).toBe(
      live.seasonId
    );
  });

  it("falls back to the first non-archived season when none are live", () => {
    expect(pickPreferredSeasonId([archived, clone, legacy])).toBe(clone.seasonId);
  });

  it("returns null when there are no seasons", () => {
    expect(pickPreferredSeasonId([])).toBeNull();
  });
});
