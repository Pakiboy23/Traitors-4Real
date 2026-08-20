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
    label: "You drafted the winner",
    detail:
      "For each person on your ten-pick roster who wins the season. Rank does not matter.",
    group: "draft",
    module: null,
    tone: "gain",
  },
  PRED_WINNER: {
    label: "Called the winner",
    detail: "Your single winner prediction, made before the season starts.",
    group: "draft",
    module: null,
    tone: "gain",
  },
  PRED_FIRST_OUT: {
    label: "Called the first out",
    detail: "Your prediction for the first person to leave the game.",
    group: "draft",
    module: null,
    tone: "gain",
  },
  TRAITOR_BONUS: {
    label: "Unmasked a Traitor",
    detail:
      "For each of your three pre-season Traitor guesses who turns out to be a Traitor.",
    group: "draft",
    module: null,
    tone: "gain",
  },
  PROPHECY_REVERSED_PENALTY: {
    label: "Your winner went out first",
    detail:
      "The reversed prophecy. Applies when the person you picked to win is instead the first out.",
    group: "draft",
    module: null,
    tone: "loss",
  },
  WEEKLY_CORRECT_BASE: {
    label: "Correct weekly call",
    detail:
      "Each correct banishment or murder call. Doubled if you played Double or Nothing that week.",
    group: "weekly",
    module: null,
    tone: "gain",
  },
  WEEKLY_INCORRECT_BASE: {
    label: "Wrong weekly call",
    detail:
      "Each incorrect banishment or murder call. Also doubled under Double or Nothing, so the gamble cuts both ways.",
    group: "weekly",
    module: null,
    tone: "loss",
    subtracted: true,
  },
  FINALE_WEEKLY_CORRECT: {
    label: "Correct finale-week call",
    detail:
      "Weekly calls are worth more during the finale. Double or Nothing is switched off for this week.",
    group: "finale",
    module: "finaleGauntlet",
    tone: "gain",
  },
  FINALE_WEEKLY_INCORRECT: {
    label: "Wrong finale-week call",
    detail: "Finale-week misses cost more than an ordinary week.",
    group: "finale",
    module: "finaleGauntlet",
    tone: "loss",
    subtracted: true,
  },
  FINALE_FINAL_WINNER: {
    label: "Called the final winner",
    detail: "The single biggest award in the game. A miss costs nothing.",
    group: "finale",
    module: "finaleGauntlet",
    tone: "gain",
  },
  FINALE_LAST_FAITHFUL_STANDING: {
    label: "Called the last Faithful standing",
    detail: "A miss costs nothing.",
    group: "finale",
    module: "finaleGauntlet",
    tone: "gain",
  },
  FINALE_LAST_TRAITOR_STANDING: {
    label: "Called the last Traitor standing",
    detail: "A miss costs nothing.",
    group: "finale",
    module: "finaleGauntlet",
    tone: "gain",
  },
  REDEMPTION_ROULETTE_CORRECT: {
    label: "Redemption Roulette hit",
    detail: "Your Redemption Roulette pick was right.",
    group: "bonus",
    module: "redemptionRoulette",
    tone: "gain",
  },
  REDEMPTION_ROULETTE_CORRECT_NEGATIVE: {
    label: "Redemption Roulette hit from behind",
    detail:
      "The same pick pays more if your score was below zero when the week's bonuses were worked out.",
    group: "bonus",
    module: "redemptionRoulette",
    tone: "gain",
  },
  REDEMPTION_ROULETTE_INCORRECT: {
    label: "Redemption Roulette miss",
    detail: "The only bonus game that costs you points for guessing wrong.",
    group: "bonus",
    module: "redemptionRoulette",
    tone: "loss",
  },
  SHIELD_GAMBIT_CORRECT: {
    label: "Shield Gambit hit",
    detail: "Your Shield Gambit pick was right. A miss costs nothing.",
    group: "bonus",
    module: "shieldGambit",
    tone: "gain",
  },
  SHIELD_GAMBIT_CORRECT_NEGATIVE: {
    label: "Shield Gambit hit from behind",
    detail:
      "Pays more if your score was below zero when the week's bonuses were worked out.",
    group: "bonus",
    module: "shieldGambit",
    tone: "gain",
  },
  TRAITOR_TRIO_PARTIAL: {
    label: "Traitor Trio, per correct name",
    detail:
      "Awarded for each correct name when you do not get all three. Two right pays twice this.",
    group: "bonus",
    module: "traitorTrio",
    tone: "gain",
  },
  TRAITOR_TRIO_PERFECT: {
    label: "Traitor Trio, all three",
    detail:
      "A flat award that replaces the per-name rate, and only when exactly three names are correct.",
    group: "bonus",
    module: "traitorTrio",
    tone: "gain",
  },
  TRAITOR_TRIO_PERFECT_PER_MEMBER: {
    label: "Traitor Trio credit per name",
    detail:
      "How a perfect Trio is attributed across the three names on your scorecard. It does not add to your total.",
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
      "Set once, before the season starts: ten ranked picks, a winner, a first out, and three Traitor guesses. These score as the season plays out.",
  },
  {
    id: "weekly",
    title: "Every week",
    blurb:
      "Call who gets banished at the Round Table and who gets murdered overnight. A week with no murder is not scored either way.",
  },
  {
    id: "bonus",
    title: "Bonus games",
    blurb:
      "Optional side bets each week. Two of them pay extra if you are below zero when the week is worked out — that check is taken once, before any bonus is applied, so hitting one does not reduce the other.",
  },
  {
    id: "finale",
    title: "The finale",
    blurb:
      "The last week runs on its own scale. Weekly calls are worth more, Double or Nothing is switched off, and finale misses cost nothing.",
  },
];
