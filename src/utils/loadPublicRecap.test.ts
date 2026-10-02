import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabase", () => ({
  supabase: { from },
  supabaseUrl: "https://example.supabase.co",
}));

import { loadPublicRecapIndex } from "./loadPublicRecap";

type QueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

const responses = new Map<string, QueryResult>();
const calls: { table: string; columns: string }[] = [];

const query = (table: string) => {
  const result = responses.get(table) ?? { data: null, error: null };
  const builder = {
    select(columns: string) {
      calls.push({ table, columns });
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
    maybeSingle() {
      return Promise.resolve(result);
    },
  };
  return builder;
};

const seasonState = {
  seasonId: "traitors-new-blood-s1",
  seasonConfig: { label: "New Blood" },
  showConfig: { leagueName: "UPRV Fantasy League" },
  players: [
    {
      id: "alex",
      name: "Alex Rivera",
      email: "alex@example.com",
      picks: [{ member: "Abbey Benjamin", rank: 1 }],
    },
  ],
  weeklyScoreHistory: [
    {
      id: "snap-1",
      label: "Premiere",
      weeklyResults: { weekId: "week-1" },
      totals: {},
    },
  ],
  weeklyRecaps: [
    { weekId: "week-2", intro: "Second week.", published: true, publishedAt: "2026-09-25T00:00:00.000Z" },
    { weekId: "week-1", intro: "Premiere night.", published: true, publishedAt: "2026-09-18T00:00:00.000Z" },
    { weekId: "week-3", intro: "secret@example.com", published: false },
  ],
};

beforeEach(() => {
  responses.clear();
  calls.length = 0;
  from.mockReset();
  from.mockImplementation((table: string) => query(table));
});

describe("loadPublicRecapIndex", () => {
  it("reads the public season view and returns only published weeks", async () => {
    responses.set("season_states_public", {
      data: { state: seasonState },
      error: null,
    });

    const loaded = await loadPublicRecapIndex("traitors-new-blood-s1");

    expect(calls).toEqual([{ table: "season_states_public", columns: "state" }]);
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(loaded.index.weeks.map((week) => week.weekId)).toEqual(["week-1", "week-2"]);
    expect(loaded.index.weeks[0]?.weekLabel).toBe("Premiere");
    expect(loaded.index.weeks[0]?.href).toBe("/recap/traitors-new-blood-s1/week-1");
    expect(loaded.index.seasonLabel).toBe("New Blood");
    expect(JSON.stringify(loaded.index)).not.toContain("alex@example.com");
    expect(JSON.stringify(loaded.index)).not.toContain("secret@example.com");
    expect(JSON.stringify(loaded.index)).not.toContain("Abbey Benjamin");
  });

  it("falls back to season_states when the public view is missing", async () => {
    responses.set("season_states_public", {
      data: null,
      error: { code: "PGRST205", message: "Could not find the table in the schema cache" },
    });
    responses.set("season_states", {
      data: { state: seasonState },
      error: null,
    });

    const loaded = await loadPublicRecapIndex(" traitors-new-blood-s1 ");

    expect(calls.map((call) => call.table)).toEqual(["season_states_public", "season_states"]);
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(loaded.index.seasonId).toBe("traitors-new-blood-s1");
    expect(loaded.index.weeks).toHaveLength(2);
  });

  it("returns an empty hub when the season exists but has no state", async () => {
    responses.set("season_states_public", { data: null, error: null });
    responses.set("seasons", { data: { label: "New Blood" }, error: null });

    const loaded = await loadPublicRecapIndex("traitors-new-blood-s1");

    expect(loaded).toEqual({
      status: "ready",
      index: {
        seasonId: "traitors-new-blood-s1",
        seasonLabel: "New Blood",
        leagueName: "Round Table Draft",
        weeks: [],
      },
    });
  });

  it("is missing when neither the state nor the season row exists", async () => {
    responses.set("season_states_public", { data: null, error: null });
    responses.set("seasons", { data: null, error: null });

    await expect(loadPublicRecapIndex("missing-season")).resolves.toEqual({ status: "missing" });
    await expect(loadPublicRecapIndex("week-2")).resolves.toEqual({ status: "missing" });
  });

  it("reports an error without reading another table", async () => {
    responses.set("season_states_public", {
      data: null,
      error: { code: "XX000", message: "timeout" },
    });

    await expect(loadPublicRecapIndex("traitors-new-blood-s1")).resolves.toEqual({ status: "error" });
    expect(calls.map((call) => call.table)).toEqual(["season_states_public"]);
  });
});
