import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { BonusGamePredictions, PlayerEntry, WeeklyPredictions } from "../../types";
import {
  mergeWeeklyBonusPredictions,
  mergeWeeklyCouncilPicks,
} from "./weeklySubmissionMerge";

const week6 = (
  bonusGames: BonusGamePredictions
): WeeklyPredictions => ({
  weekId: "week-6",
  nextBanished: "Week Six Banished",
  nextMurdered: "Week Six Murdered",
  bonusGames,
});

const merge = (
  existingWeekly: WeeklyPredictions | undefined,
  submittedBonus: BonusGamePredictions | undefined,
  activeWeekId = "week-7"
) =>
  mergeWeeklyBonusPredictions({
    activeWeekId,
    existingWeekly,
    submittedBonus,
  });

describe("weekly bonus merge", () => {
  it("does not carry week-6 bonuses onto week-7 when the new submission omits them", () => {
    const merged = merge(
      week6({
        shieldGambit: "Victor Vollbrechthausen",
        redemptionRoulette: "Jay Vinnedge",
        traitorTrio: ["Abby Lee", "Kriste Lewis", "Michael Foote"],
        doubleOrNothing: true,
      }),
      { doubleOrNothing: false }
    );

    expect(merged).toEqual({
      shieldGambit: "",
      redemptionRoulette: "",
      traitorTrio: [],
      doubleOrNothing: false,
    });
  });

  it("clears Jade's explicit blank shield and roulette instead of keeping week 6", () => {
    const merged = merge(
      week6({
        shieldGambit: "Victor Vollbrechthausen",
        redemptionRoulette: "Jay Vinnedge",
        doubleOrNothing: true,
      }),
      {
        shieldGambit: "",
        redemptionRoulette: "",
        traitorTrio: [],
        doubleOrNothing: false,
      }
    );

    expect(merged.shieldGambit).toBe("");
    expect(merged.redemptionRoulette).toBe("");
    expect(merged.traitorTrio).toEqual([]);
    expect(merged.doubleOrNothing).toBe(false);
  });

  it("clears Kourtney's explicit blank shield and empty trio", () => {
    const merged = merge(
      week6({
        shieldGambit: "Jay Vinnedge",
        traitorTrio: ["Abby Lee", "Kriste Lewis", "Michael Foote"],
        redemptionRoulette: "Joe Vanella",
      }),
      {
        shieldGambit: "",
        traitorTrio: [],
        redemptionRoulette: "Katie Fites",
        doubleOrNothing: false,
      }
    );

    expect(merged.shieldGambit).toBe("");
    expect(merged.traitorTrio).toEqual([]);
    expect(merged.redemptionRoulette).toBe("Katie Fites");
    expect(merged.doubleOrNothing).toBe(false);
  });

  it("clears Yianz's explicit blank shield and roulette", () => {
    const merged = merge(
      week6({
        shieldGambit: "Katie Fites",
        redemptionRoulette: "Joe Vanella",
      }),
      {
        shieldGambit: "   ",
        redemptionRoulette: "",
        traitorTrio: ["", "  "],
        doubleOrNothing: false,
      }
    );

    expect(merged.shieldGambit).toBe("");
    expect(merged.redemptionRoulette).toBe("");
    expect(merged.traitorTrio).toEqual([]);
  });

  it("keeps a valid week-7 submission, including Double or Nothing", () => {
    const submitted: BonusGamePredictions = {
      shieldGambit: "Michael Foote",
      redemptionRoulette: "Abby Lee",
      traitorTrio: ["Katie Fites", "Joe Vanella", "Jay Vinnedge"],
      doubleOrNothing: true,
    };

    const merged = merge(
      week6({
        shieldGambit: "Someone Else",
        redemptionRoulette: "Not Abby",
        traitorTrio: ["Old One"],
        doubleOrNothing: false,
      }),
      submitted
    );

    expect(merged).toEqual(submitted);
    expect(merged.traitorTrio).not.toBe(submitted.traitorTrio);
  });

  it("does not treat an unscoped prior bonus as this week's pick", () => {
    const merged = merge(
      {
        nextBanished: "",
        nextMurdered: "",
        bonusGames: {
          shieldGambit: "Victor Vollbrechthausen",
          doubleOrNothing: true,
        },
      },
      { redemptionRoulette: "Abby Lee" }
    );

    expect(merged.shieldGambit).toBe("");
    expect(merged.doubleOrNothing).toBe(false);
    expect(merged.redemptionRoulette).toBe("Abby Lee");
    expect(merged.traitorTrio).toEqual([]);
  });

  it("keeps an omitted same-week bonus and still clears an explicit blank", () => {
    const existing: WeeklyPredictions = {
      weekId: "week-7",
      nextBanished: "Already Banished",
      nextMurdered: "Already Murdered",
      bonusGames: {
        shieldGambit: "Michael Foote",
        redemptionRoulette: "Abby Lee",
        traitorTrio: ["Katie Fites", "Joe Vanella", "Jay Vinnedge"],
        doubleOrNothing: true,
      },
    };

    const partial = merge(existing, {
      redemptionRoulette: "",
      traitorTrio: ["Joe Vanella"],
    });

    expect(partial.shieldGambit).toBe("Michael Foote");
    expect(partial.redemptionRoulette).toBe("");
    expect(partial.traitorTrio).toEqual(["Joe Vanella"]);
    expect(partial.doubleOrNothing).toBe(true);

    const replaced = merge(existing, { doubleOrNothing: false });
    expect(replaced.doubleOrNothing).toBe(false);
    expect(replaced.shieldGambit).toBe("Michael Foote");
  });

  it("leaves draft forecasts and raw pending submissions untouched", () => {
    const player: PlayerEntry = {
      id: "jade",
      name: "Jade",
      email: "jade@example.com",
      picks: [{ member: "Abby Lee", rank: 1, role: "Faithful" }],
      predFirstOut: "First Out",
      predWinner: "Winner",
      predTraitors: ["Katie Fites"],
      weeklyPredictions: week6({
        shieldGambit: "Victor Vollbrechthausen",
        redemptionRoulette: "Jay Vinnedge",
      }),
    };
    const active: { id: string; status: string; bonusGames: BonusGamePredictions } = {
      id: "2e4a366a",
      status: "new",
      bonusGames: {
        shieldGambit: "",
        redemptionRoulette: "",
        traitorTrio: [],
        doubleOrNothing: true,
      },
    };
    const pending = [
      {
        id: "yianz-duplicate",
        status: "new",
        weekId: "week-6",
        bonusGames: { shieldGambit: "Katie Fites", redemptionRoulette: "Joe Vanella" },
      },
      { id: "friday-nov6-1", status: "new", weekId: "week-6", bonusGames: { shieldGambit: "A" } },
      { id: "friday-nov6-2", status: "new", weekId: "week-5", bonusGames: { shieldGambit: "B" } },
      { id: "friday-nov6-3", status: "new", weekId: "week-6", bonusGames: { traitorTrio: ["C"] } },
    ];
    const beforePlayer = structuredClone(player);
    const beforeActive = structuredClone(active);
    const beforePending = structuredClone(pending);

    const bonusGames = merge(player.weeklyPredictions, active.bonusGames);
    const councilPicks = mergeWeeklyCouncilPicks({
      activeWeekId: "week-7",
      existingWeekly: player.weeklyPredictions,
      submittedBanished: "",
      submittedMurdered: "",
    });
    const updated: PlayerEntry = {
      ...player,
      weeklyPredictions: {
        weekId: "week-7",
        ...councilPicks,
        bonusGames,
        finalePredictions: player.weeklyPredictions?.finalePredictions,
      },
    };

    expect(updated.weeklyPredictions?.weekId).toBe("week-7");
    expect(updated.weeklyPredictions?.bonusGames).toEqual({
      shieldGambit: "",
      redemptionRoulette: "",
      traitorTrio: [],
      doubleOrNothing: true,
    });
    expect(updated.picks).toBe(player.picks);
    expect(updated.predFirstOut).toBe(player.predFirstOut);
    expect(updated.predWinner).toBe(player.predWinner);
    expect(updated.predTraitors).toBe(player.predTraitors);
    expect(updated.weeklyPredictions?.nextBanished).toBe("");
    expect(updated.weeklyPredictions?.nextMurdered).toBe("");
    expect(player).toEqual(beforePlayer);
    expect(active).toEqual(beforeActive);
    expect(pending).toEqual(beforePending);
    expect(pending.map((entry) => entry.status)).toEqual(["new", "new", "new", "new"]);
  });

  it("is the bonus merge used by the admin submission merge", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../components/AdminPanel.tsx"),
      "utf8"
    );

    expect(source).toContain("mergeWeeklyBonusPredictions");
    expect(source).not.toContain("existingBonus.shieldGambit");
    expect(source).not.toContain("existingBonus.redemptionRoulette");
    expect(source).not.toContain("existingBonus.traitorTrio");
    expect(source).not.toContain("existingBonus.doubleOrNothing");
  });
});

describe("weekly council merge", () => {
  const council = (
    existingWeekly: WeeklyPredictions | undefined,
    submittedBanished?: string | null,
    submittedMurdered?: string | null,
    activeWeekId = "week-7"
  ) =>
    mergeWeeklyCouncilPicks({
      activeWeekId,
      existingWeekly,
      submittedBanished,
      submittedMurdered,
    });

  it("does not copy week-6 banished or murdered onto week-7 when the vote omits them", () => {
    expect(
      council(week6({ shieldGambit: "Victor Vollbrechthausen" }), null, undefined)
    ).toEqual({
      nextBanished: "",
      nextMurdered: "",
    });
  });

  it("clears blank council fields on a new week instead of keeping week 6", () => {
    expect(council(week6({}), "", "   ")).toEqual({
      nextBanished: "",
      nextMurdered: "",
    });
  });

  it("keeps submitted week-7 council names", () => {
    expect(
      council(
        week6({}),
        "Michael Foote",
        "Abby Lee"
      )
    ).toEqual({
      nextBanished: "Michael Foote",
      nextMurdered: "Abby Lee",
    });
  });

  it("does not treat an unscoped prior council pick as this week's call", () => {
    expect(
      council(
        {
          nextBanished: "Week Six Banished",
          nextMurdered: "Week Six Murdered",
          bonusGames: {},
        },
        null,
        null
      )
    ).toEqual({
      nextBanished: "",
      nextMurdered: "",
    });
  });

  it("keeps an omitted same-week council pick and still replaces a submitted name", () => {
    const existing: WeeklyPredictions = {
      weekId: "week-7",
      nextBanished: "Already Banished",
      nextMurdered: "Already Murdered",
      bonusGames: {},
    };

    expect(council(existing, null, "Katie Fites", "week-7")).toEqual({
      nextBanished: "Already Banished",
      nextMurdered: "Katie Fites",
    });
  });

  it("is the council merge used by the admin submission merge", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../components/AdminPanel.tsx"),
      "utf8"
    );

    expect(source).toContain("mergeWeeklyCouncilPicks");
    expect(source).not.toContain("existingWeekly.nextBanished || \"\"");
    expect(source).not.toContain("existingWeekly.nextMurdered || \"\"");
  });
});
