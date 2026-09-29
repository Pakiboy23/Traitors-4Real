import type { RulePack, RulePackPoints } from "../../types";

export type RuleGroupId = "draft" | "weekly" | "bonus" | "finale";

/** Which optional module a rule belongs to, if any. Used to hide rules a pack disables. */
export type RuleModule = keyof RulePack["bonusModules"] | null;

export interface RuleExplanation {
  label: string;
  detail: string;
  group: RuleGroupId;
  module: RuleModule;
  /** Whether the value reads as points won or points lost. */
  tone: "gain" | "loss";
  /**
   * True when the stored constant is positive but subtracted from the score.
   * The weekly penalties do this; the bonus penalties store a negative and add
   * it. Without this the guide would print a miss as "+0.5".
   */
  subtracted?: boolean;
  /**
   * Documented so the total-record guarantee still applies, but kept out of the
   * player-facing list because it is an internal attribution detail rather than
   * a rule anyone plays to.
   */
  hidden?: boolean;
}

/**
 * Player-facing wording for every scoring constant.
 *
 * Typed as a total record over RulePackPoints on purpose: adding a point to the
 * rule pack fails to compile until it is explained here, so the guide cannot
 * silently fall behind the engine. This is the whole reason the rules screen is
 * generated rather than written.
 */
export const RULE_EXPLANATIONS: Record<keyof RulePackPoints, RuleExplanation> = {
  DRAFT_WINNER: {
    label: "Winner on your roster",
    detail:
      "Each person on your ten-name list who wins the season. List order does not change this.",
    group: "draft",
    module: null,
    tone: "gain",
  },
  PRED_WINNER: {
    label: "Your winner pick",
    detail:
      "The one name you locked as the season winner before play started. Separate from the ten-name list.",
    group: "draft",
    module: null,
    tone: "gain",
  },
  PRED_FIRST_OUT: {
    label: "Your first-out pick",
    detail: "The one name you locked as the first person to leave.",
    group: "draft",
    module: null,
    tone: "gain",
  },
  TRAITOR_BONUS: {
    label: "A Traitor you named before the season",
    detail:
      "You name three people at draft. Each one who really is a Traitor pays this. Misses cost nothing.",
    group: "draft",
    module: null,
    tone: "gain",
  },
  PROPHECY_REVERSED_PENALTY: {
    label: "Your winner went out first",
    detail:
      "Only if the person you picked to win is also the first person out.",
    group: "draft",
    module: null,
    tone: "loss",
  },
  WEEKLY_CORRECT_BASE: {
    label: "Right weekly call",
    detail:
      "Each banished or murdered name you get right. Double or Nothing doubles this. Leave a line blank and it is skipped.",
    group: "weekly",
    module: null,
    tone: "gain",
  },
  WEEKLY_INCORRECT_BASE: {
    label: "Wrong weekly call",
    detail:
      "Each banished or murdered name you get wrong. Double or Nothing doubles this hit too. A week with no murder skips that line.",
    group: "weekly",
    module: null,
    tone: "loss",
    subtracted: true,
  },
  FINALE_WEEKLY_CORRECT: {
    label: "Right finale-week call",
    detail:
      "Banished and murdered pay this instead of the normal weekly rate. Double or Nothing is off.",
    group: "finale",
    module: "finaleGauntlet",
    tone: "gain",
  },
  FINALE_WEEKLY_INCORRECT: {
    label: "Wrong finale-week call",
    detail: "Finale-week misses on banished or murdered cost this. Bigger than a normal week.",
    group: "finale",
    module: "finaleGauntlet",
    tone: "loss",
    subtracted: true,
  },
  FINALE_FINAL_WINNER: {
    label: "Final winner",
    detail: "Biggest single payday in the game. Wrong costs nothing.",
    group: "finale",
    module: "finaleGauntlet",
    tone: "gain",
  },
  FINALE_LAST_FAITHFUL_STANDING: {
    label: "Last Faithful standing",
    detail: "Wrong costs nothing.",
    group: "finale",
    module: "finaleGauntlet",
    tone: "gain",
  },
  FINALE_LAST_TRAITOR_STANDING: {
    label: "Last Traitor standing",
    detail: "Wrong costs nothing.",
    group: "finale",
    module: "finaleGauntlet",
    tone: "gain",
  },
  REDEMPTION_ROULETTE_CORRECT: {
    label: "Redemption Roulette hit",
    detail:
      "Optional. Pick one name still in the game. Pays this when it matches the official Roulette result. Not the same as your banished pick.",
    group: "bonus",
    module: "redemptionRoulette",
    tone: "gain",
  },
  REDEMPTION_ROULETTE_CORRECT_NEGATIVE: {
    label: "Redemption Roulette hit from behind",
    detail:
      "Same pick, bigger payday if your score was below zero before any bonus was added. Hitting Roulette does not change Shield's rate.",
    group: "bonus",
    module: "redemptionRoulette",
    tone: "gain",
  },
  REDEMPTION_ROULETTE_INCORRECT: {
    label: "Redemption Roulette miss",
    detail:
      "You played Roulette and the name was wrong. This is the only bonus that costs points on a miss. Leave it blank and you get nothing either way.",
    group: "bonus",
    module: "redemptionRoulette",
    tone: "loss",
  },
  SHIELD_GAMBIT_CORRECT: {
    label: "Shield Gambit hit",
    detail: "Optional. Right name pays this. Wrong name costs nothing.",
    group: "bonus",
    module: "shieldGambit",
    tone: "gain",
  },
  SHIELD_GAMBIT_CORRECT_NEGATIVE: {
    label: "Shield Gambit hit from behind",
    detail:
      "Pays this instead if your score was below zero before bonuses. That check is shared with Roulette and is taken once.",
    group: "bonus",
    module: "shieldGambit",
    tone: "gain",
  },
  TRAITOR_TRIO_PARTIAL: {
    label: "Traitor Trio, each correct name",
    detail:
      "Optional. Paid once per correct name when you do not hit all three. Two right pays this twice. Zero right costs nothing.",
    group: "bonus",
    module: "traitorTrio",
    tone: "gain",
  },
  TRAITOR_TRIO_PERFECT: {
    label: "Traitor Trio, all three",
    detail:
      "Flat payout when all three names match. Replaces the per-name rate — you do not get both.",
    group: "bonus",
    module: "traitorTrio",
    tone: "gain",
  },
  TRAITOR_TRIO_PERFECT_PER_MEMBER: {
    label: "Traitor Trio credit per name",
    detail:
      "How a perfect Trio is split across the three names on your scorecard. It does not add to your total.",
    group: "bonus",
    module: "traitorTrio",
    tone: "gain",
    hidden: true,
  },
};

export const RULE_GROUPS: Array<{
  id: RuleGroupId;
  title: string;
  blurb: string;
}> = [
  {
    id: "draft",
    title: "Your draft",
    blurb:
      "Main Council only. Set once before the season: ten names, one winner, one first-out, three Traitor guesses. These pay as the show confirms them. Jr Council skips this section.",
  },
  {
    id: "weekly",
    title: "Every week",
    blurb:
      "Before lock, name who gets banished and who gets murdered. Right pays. Wrong costs a little. No murder that week means the murder line is skipped. Blank is skipped.",
  },
  {
    id: "bonus",
    title: "Side bets",
    blurb:
      "Optional. Skip all of them if you want. Roulette and Shield pay extra if you are below zero after the weekly calls — that check happens once, before any bonus is added, so one hit does not shrink the other.",
  },
  {
    id: "finale",
    title: "The finale",
    blurb:
      "Last week only. Weekly calls pay more. Double or Nothing and the side bets are off. Extra finale questions pay if you are right and cost nothing if you are wrong.",
  },
];
