import { describe, expect, it } from "vitest";
import type {
  CastMemberStatus,
  PlayerEntry,
  ScoreAdjustment,
  SeasonState,
} from "../../types";
import { TRAITORS_CLASSIC_RULE_PACK } from "../config/rulePacks";
import {
  calculatePlayerScore,
  formatScore,
  getFinaleTieBreakDistance,
  resolveEffectiveWeeklyPredictionWeekId,
} from "./scoring";

const P = TRAITORS_CLASSIC_RULE_PACK.points;
const WEEK = "week-1";

/** Cast member with every flag off; override only what a test cares about. */
const cast = (overrides: Partial<CastMemberStatus> = {}): CastMemberStatus => ({
  isWinner: false,
  isFirstOut: false,
  isTraitor: false,
  isEliminated: false,
  ...overrides,
});

const castOf = (
  entries: Record<string, Partial<CastMemberStatus>>
): Record<string, CastMemberStatus> =>
  Object.fromEntries(
    Object.entries(entries).map(([name, flags]) => [name, cast(flags)])
  );

const player = (overrides: Partial<PlayerEntry> = {}): PlayerEntry => ({
  id: "p1",
  name: "Tester",
  email: "tester@example.com",
  picks: [],
  predFirstOut: "",
  predWinner: "",
  predTraitors: [],
  ...overrides,
});

const season = (overrides: Partial<SeasonState> = {}): SeasonState => ({
  seasonId: "season-test",
  activeWeekId: WEEK,
  players: [],
  castStatus: {},
  ...overrides,
});

const scoreOf = (
  seasonState: SeasonState,
  entry: PlayerEntry,
  adjustments?: ScoreAdjustment[]
) => calculatePlayerScore({ seasonState, player: entry, adjustments }).total;

// ---------------------------------------------------------------------------
// Draft and prophecy scoring
// ---------------------------------------------------------------------------

describe("draft and prophecy scoring", () => {
  it("awards DRAFT_WINNER for each drafted cast member who wins", () => {
    const state = season({
      castStatus: castOf({ Alice: { isWinner: true }, Bob: {} }),
    });
    const entry = player({
      picks: [
        { member: "Alice", rank: 1, role: "Faithful" },
        { member: "Bob", rank: 2, role: "Faithful" },
      ],
    });

    expect(scoreOf(state, entry)).toBe(P.DRAFT_WINNER);
  });

  it("counts a duplicated pick only once, matching case-insensitively", () => {
    const state = season({ castStatus: castOf({ Alice: { isWinner: true } }) });
    const entry = player({
      picks: [
        { member: "Alice", rank: 1, role: "Faithful" },
        { member: "alice", rank: 2, role: "Faithful" },
      ],
    });

    // Dedup is case-insensitive, but the castStatus lookup uses the raw name,
    // so only the exactly-cased "Alice" resolves to a winner.
    expect(scoreOf(state, entry)).toBe(P.DRAFT_WINNER);
  });

  it("awards PRED_WINNER and PRED_FIRST_OUT independently", () => {
    const state = season({
      castStatus: castOf({ Alice: { isWinner: true }, Bob: { isFirstOut: true } }),
    });

    expect(scoreOf(state, player({ predWinner: "Alice" }))).toBe(P.PRED_WINNER);
    expect(scoreOf(state, player({ predFirstOut: "Bob" }))).toBe(P.PRED_FIRST_OUT);
  });

  it("awards TRAITOR_BONUS per unique correct traitor guess", () => {
    const state = season({
      castStatus: castOf({
        Alice: { isTraitor: true },
        Bob: { isTraitor: true },
        Cara: {},
      }),
    });
    const entry = player({ predTraitors: ["Alice", "Bob", "Cara", "Alice"] });

    expect(scoreOf(state, entry)).toBe(P.TRAITOR_BONUS * 2);
  });

  it("applies the reversed-prophecy penalty when the predicted winner goes out first", () => {
    const state = season({ castStatus: castOf({ Alice: { isFirstOut: true } }) });

    expect(scoreOf(state, player({ predWinner: "Alice" }))).toBe(
      P.PROPHECY_REVERSED_PENALTY
    );
  });
});

// ---------------------------------------------------------------------------
// Weekly council
// ---------------------------------------------------------------------------

describe("weekly council scoring", () => {
  const weeklyState = (
    results: SeasonState["weeklyResults"],
    finaleEnabled = false
  ) =>
    season({
      weeklyResults: { weekId: WEEK, ...results },
      ...(finaleEnabled
        ? { finaleConfig: { enabled: true, label: "Finale", lockAt: "" } }
        : {}),
    });

  it("adds WEEKLY_CORRECT_BASE for a correct banished call", () => {
    const state = weeklyState({ nextBanished: "Alice" });
    const entry = player({
      weeklyPredictions: { weekId: WEEK, nextBanished: "Alice", nextMurdered: "" },
    });

    expect(scoreOf(state, entry)).toBe(P.WEEKLY_CORRECT_BASE);
  });

  it("subtracts WEEKLY_INCORRECT_BASE for a wrong banished call", () => {
    const state = weeklyState({ nextBanished: "Alice" });
    const entry = player({
      weeklyPredictions: { weekId: WEEK, nextBanished: "Bob", nextMurdered: "" },
    });

    expect(scoreOf(state, entry)).toBe(-P.WEEKLY_INCORRECT_BASE);
  });

  it("doubles both the reward and the penalty under Double or Nothing", () => {
    const state = weeklyState({ nextBanished: "Alice" });

    const right = player({
      weeklyPredictions: {
        weekId: WEEK,
        nextBanished: "Alice",
        nextMurdered: "",
        bonusGames: { doubleOrNothing: true },
      },
    });
    const wrong = player({
      weeklyPredictions: {
        weekId: WEEK,
        nextBanished: "Bob",
        nextMurdered: "",
        bonusGames: { doubleOrNothing: true },
      },
    });

    expect(scoreOf(state, right)).toBe(P.WEEKLY_CORRECT_BASE * 2);
    expect(scoreOf(state, wrong)).toBe(-P.WEEKLY_INCORRECT_BASE * 2);
  });

  it('ignores the murdered call entirely when the result is "No Murder"', () => {
    const state = weeklyState({ nextMurdered: "No Murder" });
    const entry = player({
      weeklyPredictions: { weekId: WEEK, nextBanished: "", nextMurdered: "Alice" },
    });

    // Neither rewarded nor penalised — a no-murder week is a no-op.
    expect(scoreOf(state, entry)).toBe(0);
  });

  it("scores nothing when the prediction week does not match the result week", () => {
    const state = weeklyState({ nextBanished: "Alice" });
    const entry = player({
      weeklyPredictions: {
        weekId: "week-9",
        nextBanished: "Alice",
        nextMurdered: "",
      },
    });

    expect(scoreOf(state, entry)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Finale
// ---------------------------------------------------------------------------

describe("finale gauntlet", () => {
  const finaleState = (overrides: Partial<SeasonState> = {}) =>
    season({
      finaleConfig: { enabled: true, label: "Finale", lockAt: "" },
      weeklyResults: { weekId: WEEK },
      ...overrides,
    });

  it("uses finale weekly values and ignores Double or Nothing", () => {
    const state = finaleState({
      weeklyResults: { weekId: WEEK, nextBanished: "Alice" },
    });
    const entry = player({
      weeklyPredictions: {
        weekId: WEEK,
        nextBanished: "Alice",
        nextMurdered: "",
        bonusGames: { doubleOrNothing: true },
      },
    });

    // Double or Nothing is deliberately disabled during the finale.
    expect(scoreOf(state, entry)).toBe(P.FINALE_WEEKLY_CORRECT);
  });

  it("awards each finale prediction separately", () => {
    const state = finaleState({
      weeklyResults: {
        weekId: WEEK,
        finaleResults: {
          finalWinner: "Alice",
          lastFaithfulStanding: "Bob",
          lastTraitorStanding: "Cara",
        },
      },
    });
    const entry = player({
      weeklyPredictions: {
        weekId: WEEK,
        nextBanished: "",
        nextMurdered: "",
        finalePredictions: {
          finalWinner: "Alice",
          lastFaithfulStanding: "Bob",
          lastTraitorStanding: "Cara",
          finalPotEstimate: null,
        },
      },
    });

    expect(scoreOf(state, entry)).toBe(
      P.FINALE_FINAL_WINNER +
        P.FINALE_LAST_FAITHFUL_STANDING +
        P.FINALE_LAST_TRAITOR_STANDING
    );
  });

  it("costs nothing for a wrong finale prediction", () => {
    const state = finaleState({
      weeklyResults: { weekId: WEEK, finaleResults: { finalWinner: "Alice" } },
    });
    const entry = player({
      weeklyPredictions: {
        weekId: WEEK,
        nextBanished: "",
        nextMurdered: "",
        finalePredictions: {
          finalWinner: "Bob",
          lastFaithfulStanding: "",
          lastTraitorStanding: "",
          finalPotEstimate: null,
        },
      },
    });

    // Finale gauntlet misses are scored at zero, not as a deduction.
    expect(scoreOf(state, entry)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bonus games
// ---------------------------------------------------------------------------

describe("bonus games", () => {
  const bonusState = (results: NonNullable<SeasonState["weeklyResults"]>["bonusGames"]) =>
    season({ weeklyResults: { weekId: WEEK, bonusGames: results } });

  const bonusPlayer = (
    predictions: NonNullable<PlayerEntry["weeklyPredictions"]>["bonusGames"],
    extra: Partial<PlayerEntry> = {}
  ) =>
    player({
      weeklyPredictions: {
        weekId: WEEK,
        nextBanished: "",
        nextMurdered: "",
        bonusGames: predictions,
      },
      ...extra,
    });

  it("pays the standard Redemption Roulette rate from a non-negative score", () => {
    const state = bonusState({ redemptionRoulette: "Alice" });

    expect(scoreOf(state, bonusPlayer({ redemptionRoulette: "Alice" }))).toBe(
      P.REDEMPTION_ROULETTE_CORRECT
    );
  });

  it("applies REDEMPTION_ROULETTE_INCORRECT as a negative constant, not a subtraction", () => {
    const state = bonusState({ redemptionRoulette: "Alice" });

    // The constant is itself negative and is added, unlike the weekly penalties
    // which are positive constants that get subtracted.
    expect(scoreOf(state, bonusPlayer({ redemptionRoulette: "Bob" }))).toBe(
      P.REDEMPTION_ROULETTE_INCORRECT
    );
    expect(P.REDEMPTION_ROULETTE_INCORRECT).toBeLessThan(0);
  });

  it("costs nothing for a wrong Shield Gambit", () => {
    const state = bonusState({ shieldGambit: "Alice" });

    expect(scoreOf(state, bonusPlayer({ shieldGambit: "Bob" }))).toBe(0);
  });

  it("pays the boosted rate when the running score is negative", () => {
    const state = season({
      castStatus: castOf({ Alice: { isFirstOut: true } }),
      weeklyResults: { weekId: WEEK, bonusGames: { redemptionRoulette: "Zed" } },
    });
    // The reversed-prophecy penalty puts the score below zero first.
    const entry = bonusPlayer({ redemptionRoulette: "Zed" }, { predWinner: "Alice" });

    expect(scoreOf(state, entry)).toBe(
      P.PROPHECY_REVERSED_PENALTY + P.REDEMPTION_ROULETTE_CORRECT_NEGATIVE
    );
  });

  it("snapshots the negative-score check once, so both bonus games see the same value", () => {
    const state = season({
      castStatus: castOf({ Alice: { isFirstOut: true } }),
      weeklyResults: {
        weekId: WEEK,
        bonusGames: { redemptionRoulette: "Zed", shieldGambit: "Yani" },
      },
    });
    const entry = bonusPlayer(
      { redemptionRoulette: "Zed", shieldGambit: "Yani" },
      { predWinner: "Alice" }
    );

    // Redemption Roulette pays first and lifts the total back above zero, but
    // Shield Gambit still uses the boosted rate because the flag was captured
    // before either game was evaluated. This makes the pair order-independent.
    expect(scoreOf(state, entry)).toBe(
      P.PROPHECY_REVERSED_PENALTY +
        P.REDEMPTION_ROULETTE_CORRECT_NEGATIVE +
        P.SHIELD_GAMBIT_CORRECT_NEGATIVE
    );
  });

  it("pays per-name for a partial Traitor Trio", () => {
    const state = bonusState({ traitorTrio: ["Alice", "Bob", "Cara"] });
    const entry = bonusPlayer({ traitorTrio: ["Alice", "Bob", "Zed"] });

    expect(scoreOf(state, entry)).toBe(P.TRAITOR_TRIO_PARTIAL * 2);
  });

  it("pays the flat perfect bonus for all three", () => {
    const state = bonusState({ traitorTrio: ["Alice", "Bob", "Cara"] });
    const entry = bonusPlayer({ traitorTrio: ["Alice", "Bob", "Cara"] });

    expect(scoreOf(state, entry)).toBe(P.TRAITOR_TRIO_PERFECT);
  });

  it("requires exactly three correct names for the perfect bonus", () => {
    // A two-name result set can never reach the perfect tier, because the check
    // is against a literal 3 rather than the size of the result set.
    const state = bonusState({ traitorTrio: ["Alice", "Bob"] });
    const entry = bonusPlayer({ traitorTrio: ["Alice", "Bob"] });

    expect(scoreOf(state, entry)).toBe(P.TRAITOR_TRIO_PARTIAL * 2);
  });

  it("ignores duplicates on both sides of the Traitor Trio comparison", () => {
    const state = bonusState({ traitorTrio: ["Alice", "Alice", "Bob"] });
    const entry = bonusPlayer({ traitorTrio: ["Alice", "Alice"] });

    expect(scoreOf(state, entry)).toBe(P.TRAITOR_TRIO_PARTIAL);
  });
});

// ---------------------------------------------------------------------------
// Manual score adjustments
// ---------------------------------------------------------------------------

describe("score adjustments", () => {
  const adjustment = (overrides: Partial<ScoreAdjustment> = {}): ScoreAdjustment => ({
    id: "adj-1",
    seasonId: "season-test",
    playerId: "p1",
    reason: "Manual correction",
    points: 5,
    createdBy: "admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });

  it("applies an adjustment addressed to the player", () => {
    expect(scoreOf(season(), player(), [adjustment()])).toBe(5);
  });

  it("ignores adjustments belonging to another player", () => {
    expect(scoreOf(season(), player(), [adjustment({ playerId: "p2" })])).toBe(0);
  });

  it("ignores adjustments from another season", () => {
    expect(scoreOf(season(), player(), [adjustment({ seasonId: "other" })])).toBe(0);
  });

  it("applies a week-scoped adjustment only in its own week", () => {
    const state = season({ weeklyResults: { weekId: WEEK } });

    expect(scoreOf(state, player(), [adjustment({ weekId: WEEK })])).toBe(5);
    expect(scoreOf(state, player(), [adjustment({ weekId: "week-9" })])).toBe(0);
  });

  it("carries negative adjustments through", () => {
    expect(scoreOf(season(), player(), [adjustment({ points: -3 })])).toBe(-3);
  });
});

// ---------------------------------------------------------------------------
// Rule packs
// ---------------------------------------------------------------------------

describe("rule packs", () => {
  it("scores with the season's configured rule pack", () => {
    const state = season({
      rulePackId: "generic-elimination",
      castStatus: castOf({ Alice: { isTraitor: true } }),
    });
    const entry = player({ predTraitors: ["Alice"] });

    // Generic Elimination zeroes the traitor bonus.
    expect(scoreOf(state, entry)).toBe(0);
  });

  it("falls back to Traitors Classic for an unknown rule pack id", () => {
    const state = season({
      rulePackId: "does-not-exist",
      castStatus: castOf({ Alice: { isTraitor: true } }),
    });

    expect(scoreOf(state, player({ predTraitors: ["Alice"] }))).toBe(P.TRAITOR_BONUS);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("formatScore", () => {
  it("renders whole numbers without a decimal", () => {
    expect(formatScore(12)).toBe("12");
    expect(formatScore(-3)).toBe("-3");
  });

  it("renders fractional scores to one decimal place", () => {
    expect(formatScore(12.5)).toBe("12.5");
    expect(formatScore(-0.5)).toBe("-0.5");
  });
});

describe("getFinaleTieBreakDistance", () => {
  it("returns the absolute distance from the final pot", () => {
    const entry = player({
      weeklyPredictions: {
        weekId: WEEK,
        nextBanished: "",
        nextMurdered: "",
        finalePredictions: {
          finalWinner: "",
          lastFaithfulStanding: "",
          lastTraitorStanding: "",
          finalPotEstimate: 90,
        },
      },
    });

    expect(getFinaleTieBreakDistance(entry, 100)).toBe(10);
    expect(getFinaleTieBreakDistance(entry, 80)).toBe(10);
  });

  it("returns null when either side is missing or not finite", () => {
    const withEstimate = player({
      weeklyPredictions: {
        weekId: WEEK,
        nextBanished: "",
        nextMurdered: "",
        finalePredictions: {
          finalWinner: "",
          lastFaithfulStanding: "",
          lastTraitorStanding: "",
          finalPotEstimate: 90,
        },
      },
    });

    expect(getFinaleTieBreakDistance(withEstimate, null)).toBeNull();
    expect(getFinaleTieBreakDistance(withEstimate, Number.NaN)).toBeNull();
    expect(getFinaleTieBreakDistance(player(), 100)).toBeNull();
  });
});

describe("resolveEffectiveWeeklyPredictionWeekId", () => {
  it("uses the week stamped on the player's predictions", () => {
    const entry = player({
      weeklyPredictions: { weekId: "week-3", nextBanished: "Alice", nextMurdered: "" },
    });

    expect(
      resolveEffectiveWeeklyPredictionWeekId(season(), entry, "week-3")
    ).toBe("week-3");
  });
});
