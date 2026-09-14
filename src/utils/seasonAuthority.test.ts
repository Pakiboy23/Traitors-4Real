import { describe, expect, it } from "vitest";
import type { GameState, SeasonConfig } from "../../types";
import { NEW_BLOOD_CAST_NAMES } from "../config/newBloodCast";
import {
  applySeasonRecord,
  canPersistSeasonState,
  hasForeignSeasonGameplay,
  isolateSeasonGameplay,
  isFinaleResultsCertified,
  resetSeasonStateForClone,
  rosterForSeason,
} from "./seasonAuthority";

const liveNewBlood: SeasonConfig = {
  seasonId: "traitors-new-blood-s1",
  label: "The Traitors: New Blood",
  status: "live",
  timezone: "America/New_York",
  lockSchedule: { draftLockAt: "2026-09-18T00:00:00.000Z" },
  activeWeekId: "week-1",
  finaleConfig: {
    enabled: false,
    label: "Finale Gauntlet",
    lockAt: "2026-09-18T00:00:00.000Z",
  },
};

const archivedLegacy: SeasonConfig = {
  seasonId: "season-legacy",
  label: "Season Legacy",
  status: "archived",
  timezone: "America/New_York",
  lockSchedule: {},
  activeWeekId: "week-6",
  finaleConfig: {
    enabled: true,
    label: "Season 4 Finale Gauntlet",
    lockAt: "2026-02-26T21:00:00-05:00",
  },
};

const season4FinaleResults = {
  finalWinner: "Rob Rausch (Love Island USA)",
  lastFaithfulStanding: "Maura Higgins (Love Island UK)",
  lastTraitorStanding: "Rob Rausch (Love Island USA)",
  finalPotValue: 220800,
};

/** Snapshot that production New Blood actually held: live label, Season 4 finale. */
const poisonedNewBloodState = (): Partial<GameState> => ({
  seasonId: "traitors-new-blood-s1",
  players: [{ id: "1", name: "Serena Whitecotton", email: "serena@example.com", picks: [], predFirstOut: "", predWinner: "", predTraitors: [] }],
  castStatus: {},
  seasonConfig: liveNewBlood,
  finaleConfig: {
    enabled: true,
    label: "Season 4 Finale Gauntlet",
    lockAt: "2026-02-26T21:00:00-05:00",
  },
  weeklyResults: {
    weekId: "week-6",
    nextBanished: "",
    nextMurdered: "",
    bonusGames: { redemptionRoulette: "", shieldGambit: "", traitorTrio: [] },
    finaleResults: season4FinaleResults,
  },
});

describe("applySeasonRecord", () => {
  it("lets the seasons row disable a leftover finale so Home cannot show Season Complete", () => {
    const applied = applySeasonRecord(poisonedNewBloodState(), liveNewBlood);

    expect(applied.seasonId).toBe("traitors-new-blood-s1");
    expect(applied.seasonConfig).toEqual(liveNewBlood);
    expect(applied.finaleConfig?.enabled).toBe(false);
    expect(applied.finaleConfig?.label).toBe("Finale Gauntlet");
    expect(isFinaleResultsCertified(applied)).toBe(false);
  });

  it("keeps a completed archived season certifiable after the same overlay", () => {
    const applied = applySeasonRecord(
      {
        ...poisonedNewBloodState(),
        seasonId: "season-legacy",
        seasonConfig: archivedLegacy,
      },
      archivedLegacy
    );

    expect(applied.finaleConfig?.enabled).toBe(true);
    expect(isFinaleResultsCertified(applied)).toBe(true);
  });

  it("does not invent a finale config when the row omitted one", () => {
    const { finaleConfig: _ignored, ...row } = liveNewBlood;
    const applied = applySeasonRecord({ players: [] }, row);

    expect(applied.finaleConfig).toEqual({
      enabled: false,
      label: "Finale",
      lockAt: "",
    });
  });
});

describe("canPersistSeasonState", () => {
  it("blocks a write while the newly selected season has not loaded", () => {
    expect(
      canPersistSeasonState({
        activeSeasonId: "traitors-new-blood-s1",
        loadedSeasonId: null,
      })
    ).toBe(false);
  });

  it("blocks a write that still belongs to the previous season", () => {
    expect(
      canPersistSeasonState({
        activeSeasonId: "traitors-new-blood-s1",
        loadedSeasonId: "season-legacy",
      })
    ).toBe(false);
  });

  it("allows a write only after that season's snapshot is the one on screen", () => {
    expect(
      canPersistSeasonState({
        activeSeasonId: "traitors-new-blood-s1",
        loadedSeasonId: "traitors-new-blood-s1",
      })
    ).toBe(true);
  });
});

describe("isFinaleResultsCertified", () => {
  it("requires finale mode and all three outcome fields", () => {
    expect(
      isFinaleResultsCertified({
        finaleConfig: { enabled: true, label: "Finale", lockAt: "" },
        weeklyResults: { finaleResults: season4FinaleResults },
      })
    ).toBe(true);
    expect(
      isFinaleResultsCertified({
        finaleConfig: { enabled: false, label: "Finale", lockAt: "" },
        weeklyResults: { finaleResults: season4FinaleResults },
      })
    ).toBe(false);
    expect(
      isFinaleResultsCertified({
        finaleConfig: { enabled: true, label: "Finale", lockAt: "" },
        weeklyResults: {
          finaleResults: { ...season4FinaleResults, lastTraitorStanding: "" },
        },
      })
    ).toBe(false);
  });
});

describe("resetSeasonStateForClone", () => {
  it("does not carry the source season's enabled finale onto the target row", () => {
    const source: GameState = {
      players: [
        {
          id: "1",
          name: "Serena Whitecotton",
          email: "serena@example.com",
          picks: [],
          predFirstOut: "",
          predWinner: "",
          predTraitors: [],
        },
      ],
      castStatus: {
        "Rob Rausch (Love Island USA)": {
          isWinner: true,
          isFirstOut: false,
          isTraitor: true,
          isEliminated: false,
          portraitUrl: null,
        },
      },
      finaleConfig: archivedLegacy.finaleConfig,
      weeklyResults: { finaleResults: season4FinaleResults },
      weeklyScoreHistory: [{ id: "w1", label: "Week 1", createdAt: "", totals: {} }],
      weeklySubmissionHistory: [],
    };

    const cloned = resetSeasonStateForClone(source, liveNewBlood);

    expect(cloned.players).toEqual([]);
    expect(cloned.finaleConfig?.enabled).toBe(false);
    expect(cloned.finaleConfig?.label).toBe("Finale Gauntlet");
    expect(cloned.seasonConfig).toEqual(liveNewBlood);
    expect(cloned.weeklyResults?.finaleResults?.finalWinner).toBe("");
    expect(cloned.weeklyScoreHistory).toEqual([]);
    expect(cloned.castStatus["Rob Rausch (Love Island USA)"]?.isWinner).toBe(false);
    expect(isFinaleResultsCertified(cloned)).toBe(false);
  });
});

describe("isolateSeasonGameplay", () => {
  const roster = rosterForSeason("traitors-new-blood-s1");

  const poisonedBoard = (): GameState => ({
    seasonId: "traitors-new-blood-s1",
    players: [
      {
        id: "1768254430231",
        name: "Robyn Taylor",
        email: "robyn.taylor@universalorlando.com",
        league: "main",
        picks: [
          { member: "Mark Ballas (DWTS)", rank: 1, role: "Faithful" },
          { member: "Rob Rausch (Love Island USA)", rank: 2, role: "Traitor" },
        ],
        predFirstOut: "Michael Rapaport (Actor)",
        predWinner: "Johnny Weir (Olympian)",
        predTraitors: ["Lisa Rinna (RHOBH)"],
        weeklyPredictions: {
          nextBanished: "Rob Rausch (Love Island USA)",
          nextMurdered: "Mark Ballas (DWTS)",
          finalePredictions: {
            finalWinner: "Johnny Weir (Olympian)",
            lastFaithfulStanding: "Johnny Weir (Olympian)",
            lastTraitorStanding: "Eric Nam (Singer/Host)",
            finalPotEstimate: 215000,
          },
        },
      },
    ],
    castStatus: {
      "Abbey Benjamin": {
        isWinner: false,
        isFirstOut: false,
        isTraitor: false,
        isEliminated: false,
        portraitUrl: null,
      },
      "Lisa Rinna (RHOBH)": {
        isWinner: false,
        isFirstOut: false,
        isTraitor: true,
        isEliminated: true,
        portraitUrl: null,
      },
      "Rob Rausch (Love Island USA)": {
        isWinner: true,
        isFirstOut: false,
        isTraitor: true,
        isEliminated: false,
        portraitUrl: null,
      },
    },
    weeklyResults: {
      weekId: "week-6",
      finaleResults: season4FinaleResults,
    },
    weeklyScoreHistory: [
      {
        id: "week-11",
        label: "Week 11",
        createdAt: "2026-02-01T00:00:00.000Z",
        totals: { "1768254430231": 6 },
        weeklyResults: { nextBanished: "Lisa Rinna (RHOBH)" },
      },
    ],
    weeklySubmissionHistory: [
      {
        id: "s1",
        name: "Robyn Taylor",
        email: "robyn.taylor@universalorlando.com",
        mergedAt: "2026-02-01T00:00:00.000Z",
      },
    ],
    scoreAdjustments: [],
    finaleConfig: liveNewBlood.finaleConfig,
    seasonConfig: liveNewBlood,
  });

  it("strips Season 4 archives, celebrity cast, and leftover picks from a live New Blood board", () => {
    const isolated = isolateSeasonGameplay(poisonedBoard(), liveNewBlood, roster);

    expect(hasForeignSeasonGameplay(poisonedBoard(), roster)).toBe(true);
    expect(isolated.players).toHaveLength(1);
    expect(isolated.players[0].name).toBe("Robyn Taylor");
    expect(isolated.players[0].email).toBe("robyn.taylor@universalorlando.com");
    expect(isolated.players[0].picks).toEqual([]);
    expect(isolated.players[0].predWinner).toBe("");
    expect(isolated.weeklyScoreHistory).toEqual([]);
    expect(isolated.weeklySubmissionHistory).toEqual([]);
    expect(isolated.weeklyResults?.weekId).toBe("week-1");
    expect(isolated.weeklyResults?.finaleResults?.finalWinner).toBe("");
    expect(Object.keys(isolated.castStatus)).toEqual([...NEW_BLOOD_CAST_NAMES]);
    expect(isolated.castStatus["Lisa Rinna (RHOBH)"]).toBeUndefined();
    expect(isolated.castStatus["Abbey Benjamin"]?.isEliminated).toBe(false);
    expect(hasForeignSeasonGameplay(isolated, roster)).toBe(false);
  });

  it("leaves an archived Season 4 board intact so the old finale still reads", () => {
    const isolated = isolateSeasonGameplay(poisonedBoard(), archivedLegacy, roster);

    expect(isolated.weeklyScoreHistory?.[0]?.label).toBe("Week 11");
    expect(isolated.players[0].predWinner).toBe("Johnny Weir (Olympian)");
    expect(isolated.castStatus["Lisa Rinna (RHOBH)"]?.isTraitor).toBe(true);
    expect(isolated.finaleConfig?.enabled).toBe(true);
  });

  it("does not wipe a clean New Blood week once the season is actually scoring", () => {
    const clean: GameState = {
      seasonId: "traitors-new-blood-s1",
      players: [
        {
          id: "1",
          name: "Robyn Taylor",
          email: "robyn@example.com",
          picks: [{ member: "Abbey Benjamin", rank: 1, role: "Faithful" }],
          predFirstOut: "Abby Lee",
          predWinner: "Xavier Scruggs",
          predTraitors: ["Joe Vanella"],
        },
      ],
      castStatus: Object.fromEntries(
        NEW_BLOOD_CAST_NAMES.map((name) => [
          name,
          {
            isWinner: false,
            isFirstOut: false,
            isTraitor: false,
            isEliminated: name === "Abby Lee",
            portraitUrl: null,
          },
        ])
      ),
      weeklyResults: { weekId: "week-1", nextBanished: "Abby Lee" },
      weeklyScoreHistory: [
        {
          id: "nb-w1",
          label: "Week 1",
          createdAt: "2026-09-18T00:00:00.000Z",
          totals: { "1": 3 },
          weeklyResults: { nextBanished: "Abby Lee" },
        },
      ],
    };

    const isolated = isolateSeasonGameplay(clean, liveNewBlood, roster);

    expect(isolated.weeklyScoreHistory?.[0]?.label).toBe("Week 1");
    expect(isolated.players[0].picks[0]?.member).toBe("Abbey Benjamin");
    expect(isolated.castStatus["Abby Lee"]?.isEliminated).toBe(true);
  });
});
