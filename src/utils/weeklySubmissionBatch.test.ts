import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { BonusGamePredictions, PlayerEntry, WeeklySubmissionHistoryEntry } from "../../types";
import { mergeWeeklyBonusPredictions } from "./weeklySubmissionMerge";
import { mergeReadyWeeklySubmissions, weeklyVoteKey } from "./weeklySubmissionBatch";

const WEEK = "week-7";

type Row = {
  id: string;
  created: string;
  status: "new" | "merged" | "skipped_late" | "skipped_stale";
  playerId: string;
  email: string;
  name: string;
  bonus: BonusGamePredictions;
};

const player = (bonus: BonusGamePredictions, weekId = "week-6"): PlayerEntry => ({
  id: "jade",
  name: "Jade",
  email: "jade@example.com",
  picks: [{ member: "Abby Lee", rank: 1, role: "Faithful" }],
  predFirstOut: "First Out",
  predWinner: "Winner",
  predTraitors: ["Katie Fites"],
  weeklyPredictions: {
    weekId,
    nextBanished: "Week Six Banished",
    nextMurdered: "Week Six Murdered",
    bonusGames: bonus,
  },
});

const row = (overrides: Partial<Row> & Pick<Row, "id" | "created" | "bonus">): Row => ({
  status: "new",
  playerId: "jade",
  email: "jade@example.com",
  name: "Jade",
  ...overrides,
});

const readyItem = (submission: Row) => ({
  submission,
  playerKey: weeklyVoteKey({
    email: submission.email,
    name: submission.name,
    league: "main",
    weekId: WEEK,
  }),
  weekId: WEEK,
});

const applyBonus = (players: PlayerEntry[], submission: Row): PlayerEntry[] =>
  players.map((entry) => {
    if (entry.id !== submission.playerId) return entry;
    return {
      ...entry,
      weeklyPredictions: {
        weekId: WEEK,
        nextBanished: entry.weeklyPredictions?.nextBanished ?? "",
        nextMurdered: entry.weeklyPredictions?.nextMurdered ?? "",
        finalePredictions: entry.weeklyPredictions?.finalePredictions,
        bonusGames: mergeWeeklyBonusPredictions({
          activeWeekId: WEEK,
          existingWeekly: entry.weeklyPredictions,
          submittedBonus: submission.bonus,
        }),
      },
    };
  });

const run = (
  players: PlayerEntry[],
  pending: Row[],
  recorded: WeeklySubmissionHistoryEntry[] = []
) => {
  const beforePending = structuredClone(pending);
  const result = mergeReadyWeeklySubmissions({
    players,
    ready: pending.map(readyItem),
    recorded: recorded.map((entry) => ({
      id: entry.id,
      created: entry.created,
      weekId: entry.weekId ?? "",
      playerKey: weeklyVoteKey({
        email: entry.email,
        name: entry.name,
        league: entry.league,
        weekId: entry.weekId,
      }),
    })),
    apply: (current, submission) => ({
      players: applyBonus(current, submission),
      applied: true,
    }),
    historyFor: (submission) => ({ id: submission.id }),
  });
  return { ...result, beforePending, pending };
};

describe("weekly merge batch", () => {
  const week6 = {
    shieldGambit: "Victor Vollbrechthausen",
    redemptionRoulette: "Jay Vinnedge",
    traitorTrio: ["Abby Lee"],
    doubleOrNothing: true,
  };

  it("keeps the newest of two same-week rows, including when that newest vote is blank", () => {
    const newest = row({
      id: "newer",
      created: "2026-11-07T18:00:00.000Z",
      bonus: {
        shieldGambit: "",
        redemptionRoulette: "",
        traitorTrio: [],
        doubleOrNothing: false,
      },
    });
    const older = row({
      id: "older",
      created: "2026-11-06T18:00:00.000Z",
      bonus: {
        shieldGambit: "Katie Fites",
        redemptionRoulette: "Joe Vanella",
        traitorTrio: ["Michael Foote"],
        doubleOrNothing: true,
      },
    });
    const pending = [newest, older];
    const merged = run([player(week6)], pending);

    expect(merged.players[0]?.weeklyPredictions?.bonusGames).toEqual({
      shieldGambit: "",
      redemptionRoulette: "",
      traitorTrio: [],
      doubleOrNothing: false,
    });
    expect(merged.players[0]?.weeklyPredictions?.weekId).toBe(WEEK);
    expect(merged.mergedIds).toEqual(["newer"]);
    expect(merged.supersededIds).toEqual(["older"]);
    expect(merged.historyAdds).toEqual([{ id: "newer" }]);
    expect(merged.players[0]?.picks).toEqual(player(week6).picks);
    expect(merged.players[0]?.predWinner).toBe("Winner");
    expect(pending).toEqual(merged.beforePending);
    expect(older.status).toBe("new");

    const reversed = run([player(week6)], [older, newest]);
    expect(reversed.players[0]?.weeklyPredictions?.bonusGames?.shieldGambit).toBe("");
    expect(reversed.players[0]?.weeklyPredictions?.bonusGames?.doubleOrNothing).toBe(false);
    expect(reversed.mergedIds).toEqual(["newer"]);
    expect(reversed.historyAdds).toEqual([{ id: "newer" }]);
  });

  it("keeps a newer valid vote and Double or Nothing ahead of an older blank", () => {
    const newest = row({
      id: "newer-valid",
      created: "2026-11-07T18:00:00.000Z",
      bonus: {
        shieldGambit: "Michael Foote",
        redemptionRoulette: "Abby Lee",
        traitorTrio: ["Katie Fites", "Joe Vanella", "Jay Vinnedge"],
        doubleOrNothing: true,
      },
    });
    const older = row({
      id: "older-blank",
      created: "2026-11-06T18:00:00.000Z",
      bonus: {
        shieldGambit: "",
        redemptionRoulette: "",
        traitorTrio: [],
        doubleOrNothing: false,
      },
    });

    const merged = run([player(week6)], [newest, older]);
    expect(merged.players[0]?.weeklyPredictions?.bonusGames).toEqual(newest.bonus);
    expect(merged.supersededIds).toEqual(["older-blank"]);
    expect(merged.historyAdds).toEqual([{ id: "newer-valid" }]);
  });

  it("does not let an older row merged later overwrite a newer vote already in history", () => {
    const current = player(
      {
        shieldGambit: "",
        redemptionRoulette: "",
        traitorTrio: [],
        doubleOrNothing: true,
      },
      WEEK
    );
    const older = row({
      id: "older",
      created: "2026-11-06T18:00:00.000Z",
      bonus: {
        shieldGambit: "Katie Fites",
        redemptionRoulette: "Joe Vanella",
        doubleOrNothing: false,
      },
    });
    const history: WeeklySubmissionHistoryEntry[] = [
      {
        id: "newer",
        name: "Jade",
        email: "jade@example.com",
        weekId: WEEK,
        league: "main",
        created: "2026-11-07T18:00:00.000Z",
        mergedAt: "2026-11-07T19:00:00.000Z",
        bonusGames: {
          doubleOrNothing: true,
        },
      },
    ];
    const untouched = [
      { id: "yianz-duplicate", status: "new" as const, weekId: "week-6" },
      { id: "friday-nov6-1", status: "new" as const },
      { id: "friday-nov6-2", status: "new" as const },
      { id: "friday-nov6-3", status: "new" as const },
    ];
    const beforeUntouched = structuredClone(untouched);
    const merged = run([current], [older], history);

    expect(merged.players[0]?.weeklyPredictions).toEqual(current.weeklyPredictions);
    expect(merged.mergedIds).toEqual([]);
    expect(merged.historyAdds).toEqual([]);
    expect(merged.supersededIds).toEqual(["older"]);
    expect(older.status).toBe("new");
    expect(untouched).toEqual(beforeUntouched);
  });

  it("still applies a later resubmission when it is newer than history", () => {
    const current = player({ shieldGambit: "Katie Fites", doubleOrNothing: false }, WEEK);
    const newer = row({
      id: "resubmit",
      created: "2026-11-07T20:00:00.000Z",
      bonus: { shieldGambit: "", doubleOrNothing: true },
    });
    const history: WeeklySubmissionHistoryEntry[] = [
      {
        id: "first",
        name: "Jade",
        email: "jade@example.com",
        weekId: WEEK,
        league: "main",
        created: "2026-11-07T18:00:00.000Z",
        mergedAt: "2026-11-07T19:00:00.000Z",
      },
    ];

    const merged = run([current], [newer], history);
    expect(merged.mergedIds).toEqual(["resubmit"]);
    expect(merged.players[0]?.weeklyPredictions?.bonusGames?.shieldGambit).toBe("");
    expect(merged.players[0]?.weeklyPredictions?.bonusGames?.doubleOrNothing).toBe(true);
  });

  it("does not let a previous week's history block this week's vote", () => {
    const newer = row({
      id: "week7",
      created: "2026-11-07T18:00:00.000Z",
      bonus: { shieldGambit: "Michael Foote", doubleOrNothing: true },
    });
    const history: WeeklySubmissionHistoryEntry[] = [
      {
        id: "week6-row",
        name: "Jade",
        email: "jade@example.com",
        weekId: "week-6",
        league: "main",
        created: "2026-11-08T18:00:00.000Z",
        mergedAt: "2026-11-08T19:00:00.000Z",
      },
    ];

    const merged = run([player({ shieldGambit: "Victor Vollbrechthausen" })], [newer], history);
    expect(merged.mergedIds).toEqual(["week7"]);
    expect(merged.players[0]?.weeklyPredictions?.bonusGames?.shieldGambit).toBe("Michael Foote");
    expect(merged.players[0]?.weeklyPredictions?.bonusGames?.doubleOrNothing).toBe(true);
  });

  it("is the batch path the admin merge list uses", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../components/AdminPanel.tsx"),
      "utf8"
    );
    expect(source).toContain("mergeReadyWeeklySubmissions");
    expect(source).not.toContain("sortSubmissions");
  });
});
