import { describe, expect, it } from "vitest";
import type { SeasonConfig, SeasonStatus } from "../../types";
import { pickPreferredSeason } from "./seasonSelection";

const season = (seasonId: string, status: SeasonStatus): SeasonConfig => ({
  seasonId,
  label: seasonId,
  status,
  timezone: "America/New_York",
  lockSchedule: {},
});

// Newest first, matching the listSeasons ordering.
const live = season("traitors-new-blood-s1", "live");
const archivedClone = season("traitors new blood", "archived");
const legacy = season("season-legacy", "finalized");

describe("pickPreferredSeason", () => {
  it("returns null with no seasons", () => {
    expect(pickPreferredSeason([], "anything")).toBeNull();
  });

  it("honours a remembered season that is still current", () => {
    expect(pickPreferredSeason([archivedClone, live, legacy], "season-legacy")).toBe(
      legacy
    );
  });

  it("falls through to the first current season when nothing is remembered", () => {
    expect(pickPreferredSeason([archivedClone, live, legacy], null)).toBe(live);
  });

  it("falls through when the remembered id no longer exists", () => {
    expect(pickPreferredSeason([live, legacy], "traitors new blood")).toBe(live);
  });

  it("does not pin a device to a remembered season that has since been archived", () => {
    // A player who opened the app while the wrong season was selected must
    // land on the live one after the admin fixes it, without clearing storage.
    expect(
      pickPreferredSeason([archivedClone, live, legacy], "traitors new blood")
    ).toBe(live);
  });

  it("still shows a remembered archived season when nothing current exists", () => {
    const olderArchive = season("season-3", "archived");

    expect(pickPreferredSeason([archivedClone, olderArchive], "season-3")).toBe(
      olderArchive
    );
  });

  it("falls back to the newest season when every season is archived", () => {
    const olderArchive = season("season-3", "archived");

    expect(pickPreferredSeason([archivedClone, olderArchive], null)).toBe(
      archivedClone
    );
  });
});
