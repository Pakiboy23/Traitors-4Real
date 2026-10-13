import { describe, expect, it } from "vitest";
import type { PublishedStandings } from "./publishedStandings";
import {
  applyStandingsFetchResult,
  selectPublishedStandings,
  standingsEditIsUnsaved,
  standingsRefreshKey,
  type StandingsHold,
} from "./standingsHold";

const board = (score: number, seasonId = "traitors-new-blood-s1"): PublishedStandings => ({
  seasonId,
  rows: [
    {
      playerId: "serena",
      name: "Serena",
      score,
      tieBreakDistance: null,
      weekDelta: 1,
      rank: 1,
      timeline: [{ label: "Week 2", total: score }],
    },
  ],
});

const hold = (
  score: number,
  refreshKey: string,
  seasonId = "traitors-new-blood-s1"
): StandingsHold => ({
  seasonId,
  refreshKey,
  board: board(score, seasonId),
});

describe("applyStandingsFetchResult", () => {
  it("keeps a successful board available for stale-while-revalidate", () => {
    const afterSuccess = applyStandingsFetchResult(null, {
      status: "success",
      seasonId: "traitors-new-blood-s1",
      refreshKey: "key-a",
      board: board(4.5),
    });
    expect(selectPublishedStandings(afterSuccess, "traitors-new-blood-s1", ["serena"])).toEqual(
      board(4.5)
    );
  });

  it("clears the hold on failure so the next refreshKey cannot resurface it", () => {
    const previous = hold(4.5, "key-a");
    const afterFailure = applyStandingsFetchResult(previous, {
      status: "failure",
      seasonId: "traitors-new-blood-s1",
    });
    expect(afterFailure).toBeNull();

    // The bug: failedKey only hid the board while it matched the current key.
    // After the next scoring-related gameState change, refreshKey moved on and
    // the stale hold would render again until the new request failed.
    expect(
      selectPublishedStandings(previous, "traitors-new-blood-s1", ["serena"])
    ).toEqual(board(4.5));
    expect(
      selectPublishedStandings(afterFailure, "traitors-new-blood-s1", ["serena"])
    ).toBeNull();
  });

  it("does not clear a hold for a different season on failure", () => {
    const other = hold(12, "key-other", "other-season");
    expect(
      applyStandingsFetchResult(other, {
        status: "failure",
        seasonId: "traitors-new-blood-s1",
      })
    ).toEqual(other);
  });

  it("replaces a previous hold on success", () => {
    const previous = hold(4.5, "key-a");
    const next = applyStandingsFetchResult(previous, {
      status: "success",
      seasonId: "traitors-new-blood-s1",
      refreshKey: "key-b",
      board: board(6.5),
    });
    expect(next).toEqual(hold(6.5, "key-b"));
  });
});

describe("selectPublishedStandings", () => {
  it("hides a board for the wrong season or roster", () => {
    const current = hold(4.5, "key-a");
    expect(selectPublishedStandings(current, "other-season", ["serena"])).toBeNull();
    expect(
      selectPublishedStandings(current, "traitors-new-blood-s1", ["serena", "connor"])
    ).toBeNull();
  });

  it("hides a board fetched for a different scoring snapshot", () => {
    const current = hold(4.5, "saved-key");
    expect(
      selectPublishedStandings(current, "traitors-new-blood-s1", ["serena"], "edited-key")
    ).toBeNull();
    expect(
      selectPublishedStandings(current, "traitors-new-blood-s1", ["serena"], "saved-key")
    ).toEqual(board(4.5));
  });
});

describe("standingsEditIsUnsaved", () => {
  it("keeps the local board only for the unsaved scoring snapshot", () => {
    expect(standingsEditIsUnsaved(null, "loaded")).toBe(false);
    expect(standingsEditIsUnsaved("edited", "loaded")).toBe(false);
    expect(standingsEditIsUnsaved("edited", "edited")).toBe(true);
  });
});

describe("standingsRefreshKey", () => {
  it("changes when a season-wide adjustment lands", () => {
    const base = {
      seasonId: "traitors-new-blood-s1",
      players: [
        {
          id: "serena",
          name: "Serena",
          email: "serena@example.com",
          picks: [],
          predFirstOut: "",
          predWinner: "",
          predTraitors: [],
        },
      ],
      castStatus: {},
      scoreAdjustments: [],
    };
    const withAdjustment = {
      ...base,
      scoreAdjustments: [
        {
          id: "adj-1",
          seasonId: "traitors-new-blood-s1",
          playerId: "serena",
          reason: "Manual correction",
          points: 5,
          createdBy: "admin",
          createdAt: "2026-10-08T00:00:00.000Z",
        },
      ],
    };
    expect(standingsRefreshKey(base)).not.toEqual(standingsRefreshKey(withAdjustment));
  });
});
