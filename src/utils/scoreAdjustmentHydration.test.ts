import { beforeEach, describe, expect, it, vi } from "vitest";
import { listScoreAdjustments } from "../../services/supabase";
import type { ScoreAdjustment } from "../../types";
import {
  bumpSeasonScopedCounter,
  decideScoreAdjustmentHydration,
  isSameScoreAdjustmentSeason,
  readSeasonScopedCounter,
} from "./scoreAdjustmentHydration";

const from = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabase", () => ({
  supabase: { from },
  supabaseUrl: "https://example.supabase.co",
}));

type QueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

const responses = new Map<string, QueryResult>();

const query = (table: string) => {
  const result = responses.get(table) ?? {
    data: null,
    error: { message: "unmocked table" },
  };
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    then(onFulfilled: (value: QueryResult) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  return builder;
};

beforeEach(() => {
  responses.clear();
  from.mockReset();
  from.mockImplementation((table: string) => query(table));
});

const adjustment = (id: string): ScoreAdjustment => ({
  id,
  seasonId: "traitors-new-blood-s1",
  playerId: "player-1",
  reason: "scoring correction",
  points: 5,
  createdBy: "admin",
  createdAt: "2026-10-11T00:00:00.000Z",
});

const base = {
  isLatestFetch: true,
  writeRevisionAtFetchStart: 0,
  writeRevisionNow: 0,
  seasonIdAtStart: "traitors-new-blood-s1",
  seasonIdNow: "traitors-new-blood-s1",
  records: [adjustment("adj-1")],
};

describe("decideScoreAdjustmentHydration", () => {
  it("applies a successful list, including an empty one", () => {
    expect(decideScoreAdjustmentHydration(base)).toEqual({
      apply: true,
      records: base.records,
    });
    expect(
      decideScoreAdjustmentHydration({ ...base, records: [] })
    ).toEqual({ apply: true, records: [] });
  });

  it("does not empty the board when a late fetch is no longer the newest", () => {
    expect(
      decideScoreAdjustmentHydration({ ...base, isLatestFetch: false, records: [] })
    ).toEqual({ apply: false });
  });

  it("keeps a row the commissioner added while the list was in flight", () => {
    expect(
      decideScoreAdjustmentHydration({
        ...base,
        writeRevisionNow: 1,
        records: [],
      })
    ).toEqual({ apply: false });
  });

  it("ignores a non-array payload", () => {
    expect(
      decideScoreAdjustmentHydration({ ...base, records: null })
    ).toEqual({ apply: false });
  });

  it("does not apply a previous season's list after the board switched", () => {
    expect(
      decideScoreAdjustmentHydration({
        ...base,
        seasonIdNow: "traitors-us-s4",
        records: [],
      })
    ).toEqual({ apply: false });
  });
});

describe("season-scoped score adjustment counters", () => {
  it("bumps one season without invalidating another", () => {
    const writeRev: Record<string, number> = {};
    bumpSeasonScopedCounter(writeRev, "season-a");
    expect(readSeasonScopedCounter(writeRev, "season-a")).toBe(1);
    expect(readSeasonScopedCounter(writeRev, "season-b")).toBe(0);
    expect(
      isSameScoreAdjustmentSeason("season-a", "season-b")
    ).toBe(false);
  });
});

describe("listScoreAdjustments", () => {
  it("rejects when the query returns an error instead of an empty list", async () => {
    responses.set("score_adjustments", {
      data: null,
      error: { message: "permission denied" },
    });

    await expect(listScoreAdjustments("traitors-new-blood-s1")).rejects.toMatchObject({
      message: "permission denied",
    });
  });

  it("returns mapped rows when the query succeeds", async () => {
    responses.set("score_adjustments", {
      data: [
        {
          id: "adj-1",
          season_id: "traitors-new-blood-s1",
          player_id: "player-1",
          week_id: null,
          reason: "scoring correction",
          points: 5,
          created_by_label: "admin",
          created_at: "2026-10-11T00:00:00.000Z",
        },
      ],
      error: null,
    });

    await expect(listScoreAdjustments("traitors-new-blood-s1")).resolves.toEqual([
      adjustment("adj-1"),
    ]);
  });

  it("returns an empty array only when the query succeeds with no rows", async () => {
    responses.set("score_adjustments", { data: [], error: null });

    await expect(listScoreAdjustments("traitors-new-blood-s1")).resolves.toEqual([]);
  });
});
