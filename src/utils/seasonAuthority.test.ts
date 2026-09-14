import { describe, expect, it } from "vitest";
import type { GameState, SeasonConfig } from "../../types";
import {
  applySeasonRecord,
  canPersistSeasonState,
  isFinaleResultsCertified,
  resetSeasonStateForClone,
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
