import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GameState, PlayerEntry } from "../../types";
import { calculatePlayerScore } from "./scoring";
import {
  buildPublicWeeklyRecap,
  publicRecapHasForbiddenKey,
  publicRecapUrl,
  recapShareDescription,
  sanitizeWeeklyRecaps,
  upsertWeeklyRecap,
  weekResultsFor,
} from "./weeklyRecap";

const player = (overrides: Partial<PlayerEntry>): PlayerEntry => ({
  id: "p1",
  name: "Alex Rivera",
  email: "alex@example.com",
  picks: [{ member: "Abbey Benjamin", rank: 1, role: "Faithful" }],
  predFirstOut: "",
  predWinner: "Abbey Benjamin",
  predTraitors: ["Clyde Moser"],
  ...overrides,
});

const state = (overrides: Partial<GameState> = {}): GameState => ({
  seasonId: "traitors-new-blood-s1",
  activeWeekId: "week-2",
  players: [
    player({ id: "alex", name: "Alex Rivera", email: "alex@example.com" }),
    player({
      id: "blair",
      name: "Blair Chen",
      email: "blair@example.com",
      predWinner: "",
      picks: [],
    }),
  ],
  castStatus: {
    "Abbey Benjamin": {
      isWinner: true,
      isFirstOut: false,
      isTraitor: false,
      isEliminated: false,
    },
  },
  seasonConfig: {
    seasonId: "traitors-new-blood-s1",
    label: "New Blood",
    status: "live",
    timezone: "America/New_York",
    lockSchedule: {},
    activeWeekId: "week-1",
  },
  showConfig: {
    slug: "traitors",
    showName: "Round Table Draft",
    shortName: "Round Table",
    leagueName: "UPRV Fantasy League",
    branding: {},
    terminology: {
      weeklyCouncilLabel: "Weekly Council",
      jrCouncilLabel: "Jr. Council",
      draftLabel: "Draft",
      leaderboardLabel: "Leaderboard",
      adminLabel: "Admin",
      finaleLabelDefault: "Finale",
    },
    featureToggles: { draftEnabled: true },
    castNames: [],
  },
  weeklyResults: {
    weekId: "week-2",
    nextBanished: "Arisa Thomas",
    nextMurdered: "Xavier Scruggs",
    bonusGames: {
      shieldGambit: "Clyde Moser",
      traitorTrio: ["Lisa Rinna", ""],
    },
  },
  weeklyScoreHistory: [
    {
      id: "snap-1",
      label: "Premiere",
      createdAt: "2026-09-18T00:00:00.000Z",
      weeklyResults: {
        weekId: "week-1",
        nextBanished: "Someone Else",
        nextMurdered: "Hidden",
      },
      totals: { alex: 4, blair: 10 },
    },
  ],
  weeklyRecaps: [
    {
      weekId: "week-2",
      intro: "A short note for the group chat.",
      published: true,
      publishedAt: "2026-10-09T00:00:00.000Z",
    },
  ],
  weeklySubmissionHistory: [
    {
      id: "sub-1",
      name: "Alex Rivera",
      email: "alex@example.com",
      mergedAt: "2026-10-01T00:00:00.000Z",
    },
  ],
  ...overrides,
});

describe("buildPublicWeeklyRecap", () => {
  it("hides episode results and standings until the week is published", () => {
    const recap = buildPublicWeeklyRecap(
      state({
        weeklyRecaps: [{ weekId: "week-2", intro: "spoiler intro", published: false }],
      }),
      "week-2"
    );

    expect(recap?.published).toBe(false);
    expect(recap?.intro).toBe("");
    expect(recap?.standings).toEqual([]);
    expect(recap?.results).toEqual({
      banished: null,
      murdered: null,
      shield: null,
      newTraitors: [],
    });
    expect(JSON.stringify(recap)).not.toContain("Arisa Thomas");
    expect(JSON.stringify(recap)).not.toContain("alex@example.com");
  });

  it("reuses calculatePlayerScore for current standings and reads that week's results", () => {
    const game = state();
    const recap = buildPublicWeeklyRecap(game, "week-2");
    const alex = game.players[0];
    const blair = game.players[1];

    expect(recap?.published).toBe(true);
    expect(recap?.leagueName).toBe("UPRV Fantasy League");
    expect(recap?.results).toEqual({
      banished: "Arisa Thomas",
      murdered: "Xavier Scruggs",
      shield: "Clyde Moser",
      newTraitors: ["Lisa Rinna"],
    });
    expect(recap?.standings.map((row) => row.score)).toEqual([
      calculatePlayerScore(game, alex).total,
      calculatePlayerScore(game, blair).total,
    ]);
    expect(recap?.standings[0]?.name).toBe("Alex Rivera");
    expect(recap?.standings[0]?.weekDelta).toBe(
      calculatePlayerScore(game, alex).total - 4
    );
    expect(recap?.standings[1]?.weekDelta).toBe(
      calculatePlayerScore(game, blair).total - 10
    );
    expect(publicRecapHasForbiddenKey(recap)).toBe(false);
    expect(JSON.stringify(recap)).not.toContain("alex@example.com");
    expect(JSON.stringify(recap)).not.toContain("Abbey Benjamin");
  });

  it("uses an archived snapshot for an older week's movement without showing that week when unpublished", () => {
    const game = state({
      activeWeekId: "week-3",
      weeklyResults: {
        weekId: "week-3",
        nextBanished: "Current Week",
      },
      weeklyRecaps: [
        { weekId: "week-1", intro: "Premiere night.", published: true },
        { weekId: "week-2", intro: "Later.", published: true },
      ],
      weeklyScoreHistory: [
        {
          id: "snap-1",
          label: "Premiere",
          createdAt: "2026-09-18T00:00:00.000Z",
          weeklyResults: { weekId: "week-1", nextBanished: "Week One Banished" },
          totals: { alex: 4, blair: 10 },
        },
        {
          id: "snap-2",
          label: "Week 2",
          createdAt: "2026-09-25T00:00:00.000Z",
          weeklyResults: { weekId: "week-2", nextBanished: "Week Two Banished" },
          totals: { alex: 9, blair: 10 },
        },
      ],
    });

    const premiere = buildPublicWeeklyRecap(game, "week-1");
    expect(premiere?.weekLabel).toBe("Premiere");
    expect(premiere?.results.banished).toBe("Week One Banished");
    expect(premiere?.standings.find((row) => row.name === "Alex Rivera")?.weekDelta).toBe(4);

    const second = buildPublicWeeklyRecap(game, "week-2");
    expect(second?.results.banished).toBe("Week Two Banished");
    expect(second?.standings.find((row) => row.name === "Alex Rivera")?.weekDelta).toBe(5);
    expect(weekResultsFor(game, "week-1")?.nextBanished).toBe("Week One Banished");
  });

  it("writes a share description from the intro", () => {
    const recap = buildPublicWeeklyRecap(state(), "week-2");
    expect(recapShareDescription(recap!)).toBe("A short note for the group chat.");
    expect(publicRecapUrl("traitors-new-blood-s1", "week-2")).toBe(
      "https://traitorsfantasydraft.online/recap/traitors-new-blood-s1/week-2"
    );
  });
});

describe("weekly recap records", () => {
  it("keeps one record per week and ignores a blank week id", () => {
    const first = upsertWeeklyRecap([], {
      weekId: "week-2",
      intro: "Hello",
      published: false,
    });
    const published = upsertWeeklyRecap(first, {
      weekId: "week-2",
      intro: "Hello again",
      published: true,
      publishedAt: "2026-10-09T00:00:00.000Z",
    });

    expect(published).toEqual([
      {
        weekId: "week-2",
        intro: "Hello again",
        published: true,
        publishedAt: "2026-10-09T00:00:00.000Z",
      },
    ]);
    expect(sanitizeWeeklyRecaps([{ weekId: "  ", intro: "nope", published: true }])).toEqual([]);
  });
});

describe("published_weekly_recap migration", () => {
  const sql = readFileSync(
    path.resolve(__dirname, "../../supabase/0005_published_weekly_recap.sql"),
    "utf8"
  );

  it("keeps the function off the anon key", () => {
    expect(sql).toContain("grant execute on function public.published_weekly_recap(text, text) to service_role");
    expect(sql).toContain("revoke all on function public.published_weekly_recap(text, text) from anon, authenticated");
    expect(sql).not.toMatch(/grant execute on function public\.published_weekly_recap\(text, text\) to anon/);
  });
});
