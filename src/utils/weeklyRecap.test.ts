import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GameState, PlayerEntry } from "../../types";
import { calculatePlayerScore } from "./scoring";
import {
  activeRecapWeekId,
  applyRecapEditorChange,
  buildPublicRecapIndex,
  buildPublicWeeklyRecap,
  emptyPublicRecapIndex,
  formatRecapPublishedAt,
  isShortRecapWeek,
  publicRecapHasForbiddenKey,
  publicRecapHubUrl,
  publicRecapUrl,
  recapEditorWeeks,
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

describe("buildPublicRecapIndex", () => {
  it("lists published weeks in episode order and links to the week pages", () => {
    const game = state({
      weeklyRecaps: [
        { weekId: "week-10", intro: "Double digits.", published: true, publishedAt: "2026-11-20T00:00:00.000Z" },
        { weekId: "week-2", intro: "  Second episode.  ", published: true, publishedAt: "2026-09-25T00:00:00.000Z" },
        { weekId: "week-1", intro: "Premiere night.", published: true, publishedAt: "2026-09-18T00:00:00.000Z" },
        { weekId: "finale-night", intro: "Not a numbered week.", published: true },
      ],
    });
    const before = structuredClone(game.weeklyRecaps);
    const index = buildPublicRecapIndex(game, "traitors-new-blood-s1");

    expect(index?.seasonLabel).toBe("New Blood");
    expect(index?.leagueName).toBe("UPRV Fantasy League");
    expect(index?.weeks.map((week) => week.weekId)).toEqual([
      "week-1",
      "week-2",
      "week-10",
      "finale-night",
    ]);
    expect(index?.weeks[0]).toEqual({
      weekId: "week-1",
      weekLabel: "Premiere",
      href: "/recap/traitors-new-blood-s1/week-1",
      intro: "Premiere night.",
      publishedAt: "2026-09-18T00:00:00.000Z",
    });
    expect(index?.weeks[1]?.weekLabel).toBe("Week 2");
    expect(index?.weeks[1]?.intro).toBe("Second episode.");
    expect(index?.weeks[1]?.href).toBe("/recap/traitors-new-blood-s1/week-2");
    expect(formatRecapPublishedAt(index?.weeks[1]?.publishedAt)).toBe("Sep 25, 2026");
    expect(formatRecapPublishedAt("not-a-date")).toBeNull();
    expect(publicRecapHubUrl("traitors-new-blood-s1")).toBe(
      "https://traitorsfantasydraft.online/recap/traitors-new-blood-s1"
    );
    expect(publicRecapHasForbiddenKey(index)).toBe(false);
    expect(game.weeklyRecaps).toEqual(before);
  });

  it("omits unpublished and missing weeks, including their intros", () => {
    const index = buildPublicRecapIndex(
      state({
        weeklyRecaps: [
          { weekId: "week-1", intro: "Public premiere.", published: true },
          { weekId: "week-2", intro: "secret@example.com spoiler", published: false },
          { weekId: "week-3", intro: "Still drafting.", published: false, publishedAt: "2026-10-02T00:00:00.000Z" },
        ],
      }),
      "traitors-new-blood-s1"
    );

    expect(index?.weeks.map((week) => week.weekId)).toEqual(["week-1"]);
    expect(JSON.stringify(index)).not.toContain("secret@example.com");
    expect(JSON.stringify(index)).not.toContain("alex@example.com");
    expect(JSON.stringify(index)).not.toContain("Still drafting");
    expect(JSON.stringify(index)).not.toContain("Abbey Benjamin");
  });

  it("includes a newly published week without a fixed week list", () => {
    const hidden = buildPublicRecapIndex(
      state({ weeklyRecaps: [{ weekId: "week-4", intro: "Not yet.", published: false }] }),
      "traitors-new-blood-s1"
    );
    expect(hidden?.weeks).toEqual([]);

    const published = buildPublicRecapIndex(
      state({
        weeklyRecaps: [
          { weekId: "week-4", intro: "Now live.", published: true, publishedAt: "2026-10-16T00:00:00.000Z" },
        ],
      }),
      "traitors-new-blood-s1"
    );
    expect(published?.weeks).toEqual([
      {
        weekId: "week-4",
        weekLabel: "Week 4",
        href: "/recap/traitors-new-blood-s1/week-4",
        intro: "Now live.",
        publishedAt: "2026-10-16T00:00:00.000Z",
      },
    ]);
  });

  it("rejects a blank season id and the week short-link segment", () => {
    expect(buildPublicRecapIndex(state(), "  ")).toBeNull();
    expect(buildPublicRecapIndex(state(), "week-2")).toBeNull();
    expect(isShortRecapWeek("week-2")).toBe(true);
    expect(isShortRecapWeek("Week-12")).toBe(true);
    expect(isShortRecapWeek("traitors-new-blood-s1")).toBe(false);
    expect(emptyPublicRecapIndex("traitors-new-blood-s1", " New Blood ")).toEqual({
      seasonId: "traitors-new-blood-s1",
      seasonLabel: "New Blood",
      leagueName: "Round Table Draft",
      weeks: [],
    });
  });
});

describe("recap hub route", () => {
  const page = readFileSync(path.resolve(__dirname, "../app/recap/[seasonId]/page.tsx"), "utf8");

  it("keeps /recap/week-N as a short link and loads the season hub otherwise", () => {
    expect(page).toContain("isShortRecapWeek(segment)");
    expect(page).toContain("loadLiveSeasonId()");
    expect(page).toContain("redirect(recapPath(liveSeasonId, segment))");
    expect(page).toContain("loadPublicRecapIndex(segment)");
    expect(page).toContain("RecapHubView");
  });
});

describe("recap editor weeks", () => {
  it("lists archived snapshot weeks and the active week, defaulting to the active week", () => {
    const source = {
      activeWeekId: "week-3",
      weeklyResults: { weekId: "week-3", nextBanished: "Current" },
      weeklyScoreHistory: [
        {
          id: "snap-1",
          label: "Premiere",
          createdAt: "2026-09-18T00:00:00.000Z",
          weeklyResults: { weekId: "week-1", nextBanished: "Week One" },
          totals: {},
        },
        {
          id: "snap-2",
          label: "Week 2",
          createdAt: "2026-09-25T00:00:00.000Z",
          weeklyResults: { weekId: "week-2", nextBanished: "Week Two" },
          totals: {},
        },
        {
          id: "snap-blank",
          label: "No week",
          createdAt: "2026-09-26T00:00:00.000Z",
          weeklyResults: { nextBanished: "Missing id" },
          totals: {},
        },
      ],
    };

    expect(activeRecapWeekId(source)).toBe("week-3");
    expect(recapEditorWeeks(source)).toEqual([
      { weekId: "week-1", label: "Premiere (Week 1)" },
      { weekId: "week-2", label: "Week 2" },
      { weekId: "week-3", label: "Week 3" },
    ]);
  });

  it("does not list the active week twice when it is already archived", () => {
    const source = {
      weeklyResults: { weekId: "week-2" },
      weeklyScoreHistory: [
        {
          id: "snap-1",
          label: "Week 1",
          createdAt: "",
          weeklyResults: { weekId: "week-1" },
          totals: {},
        },
        {
          id: "snap-2",
          label: "Replay",
          createdAt: "",
          weeklyResults: { weekId: "week-1" },
          totals: {},
        },
        {
          id: "snap-3",
          label: "Week 2",
          createdAt: "",
          weeklyResults: { weekId: "week-2" },
          totals: {},
        },
      ],
    };

    expect(recapEditorWeeks(source).map((week) => week.weekId)).toEqual(["week-1", "week-2"]);
    expect(recapEditorWeeks(source)[0]?.label).toBe("Week 1");
  });

  it("falls back to the inferred active week when results have no week id", () => {
    const source = {
      activeWeekId: "week-4",
      weeklyScoreHistory: [
        {
          id: "snap-1",
          label: "Week 1",
          createdAt: "",
          weeklyResults: { weekId: "week-1" },
          totals: {},
        },
      ],
    };

    expect(activeRecapWeekId(source)).toBe("week-4");
    expect(recapEditorWeeks(source).map((week) => week.weekId)).toEqual(["week-1", "week-4"]);
  });
});

describe("applyRecapEditorChange", () => {
  it("publishes an archived week without changing the active week's record", () => {
    const active = {
      weekId: "week-3",
      intro: "Still drafting.",
      published: false as const,
      publishedAt: null,
    };
    const published = applyRecapEditorChange([active], {
      kind: "publish",
      weekId: "week-1",
      publishedAt: "2026-09-20T00:00:00.000Z",
    });

    expect(published).toEqual([
      active,
      {
        weekId: "week-1",
        intro: "",
        published: true,
        publishedAt: "2026-09-20T00:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(published[1])).toContain('"published":true');

    const withIntro = applyRecapEditorChange(published, {
      kind: "intro",
      weekId: "week-1",
      intro: "Premiere night.",
    });
    expect(withIntro.find((record) => record.weekId === "week-1")).toEqual({
      weekId: "week-1",
      intro: "Premiere night.",
      published: true,
      publishedAt: "2026-09-20T00:00:00.000Z",
    });
    expect(withIntro.find((record) => record.weekId === "week-3")).toEqual(active);

    const hidden = applyRecapEditorChange(withIntro, { kind: "unpublish", weekId: "week-1" });
    const weekOne = hidden.find((record) => record.weekId === "week-1");
    expect(weekOne?.published).toBe(false);
    expect(weekOne?.publishedAt).toBe("2026-09-20T00:00:00.000Z");
    expect(JSON.stringify(weekOne)).toContain('"published":false');

    const republished = applyRecapEditorChange(hidden, {
      kind: "publish",
      weekId: "week-1",
      publishedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(republished.find((record) => record.weekId === "week-1")?.publishedAt).toBe(
      "2026-09-20T00:00:00.000Z"
    );
  });

  it("still publishes the active week in place", () => {
    const next = applyRecapEditorChange(
      [{ weekId: "week-3", intro: "Hello", published: false }],
      { kind: "publish", weekId: "week-3", publishedAt: "2026-10-02T00:00:00.000Z" }
    );

    expect(next).toEqual([
      {
        weekId: "week-3",
        intro: "Hello",
        published: true,
        publishedAt: "2026-10-02T00:00:00.000Z",
      },
    ]);
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

describe("season save keeps weeklyRecaps", () => {
  const app = readFileSync(path.resolve(__dirname, "../../App.tsx"), "utf8");
  const types = readFileSync(path.resolve(__dirname, "../../types.ts"), "utf8");
  const supabaseClient = readFileSync(path.resolve(__dirname, "../../services/supabase.ts"), "utf8");

  const gameStateKeys = () => {
    const start = types.indexOf("export interface GameState {");
    const end = types.indexOf("\n}", start);
    const body = types.slice(start, end);
    return [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((match) => match[1]);
  };

  it("copies every GameState field, including weeklyRecaps, through normalize and save", () => {
    const keys = gameStateKeys();
    expect(keys).toEqual(
      expect.arrayContaining(["weeklyRecaps", "weeklyScoreHistory", "players", "castStatus"])
    );

    const normalizerStart = app.indexOf("const normalizeGameState = ");
    const normalizerEnd = app.indexOf("const App: React.FC", normalizerStart);
    const normalizer = app.slice(normalizerStart, normalizerEnd);
    for (const key of keys) {
      expect(normalizer, key).toContain(key);
    }
    expect(normalizer).toContain("weeklyRecaps: sanitizeWeeklyRecaps(input?.weeklyRecaps)");
    expect(supabaseClient).toContain("state: { ...state, seasonId }");
  });
});

describe("published_weekly_recap migration", () => {
  const sql = readFileSync(
    path.resolve(__dirname, "../../supabase/0006_published_weekly_recap.sql"),
    "utf8"
  );

  it("keeps the function off the anon key", () => {
    expect(sql).toContain("grant execute on function public.published_weekly_recap(text, text) to service_role");
    expect(sql).toContain("revoke all on function public.published_weekly_recap(text, text) from anon, authenticated");
    expect(sql).not.toMatch(/grant execute on function public\.published_weekly_recap\(text, text\) to anon/);
  });
});
