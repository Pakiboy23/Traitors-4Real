import type { RulePack } from "../../types";

export const TRAITORS_CLASSIC_RULE_PACK: RulePack = {
  id: "traitors-classic",
  name: "Traitors Classic",
  description:
    "Winner/traitor forecasts, weekly banished+murdered calls, finale gauntlet, and finale pot tie-break.",
  supportedEvents: [
    "draft_winner",
    "pred_winner",
    "pred_first_out",
    "pred_traitor",
    "weekly_banished",
    "weekly_murdered",
    "bonus_redemption_roulette",
    "bonus_shield_gambit",
    "bonus_traitor_trio",
    "finale_final_winner",
    "finale_last_faithful",
    "finale_last_traitor",
    "finale_pot_tiebreak",
  ],
  points: {
    DRAFT_WINNER: 10,
    PRED_WINNER: 10,
    PRED_FIRST_OUT: 5,
    TRAITOR_BONUS: 3,
    PROPHECY_REVERSED_PENALTY: -2,
    WEEKLY_CORRECT_BASE: 1,
    WEEKLY_INCORRECT_BASE: 0.5,
    FINALE_WEEKLY_CORRECT: 4,
    FINALE_WEEKLY_INCORRECT: 1,
    FINALE_FINAL_WINNER: 15,
    FINALE_LAST_FAITHFUL_STANDING: 8,
    FINALE_LAST_TRAITOR_STANDING: 8,
    REDEMPTION_ROULETTE_CORRECT: 8,
    REDEMPTION_ROULETTE_CORRECT_NEGATIVE: 16,
    REDEMPTION_ROULETTE_INCORRECT: -1,
    SHIELD_GAMBIT_CORRECT: 5,
    SHIELD_GAMBIT_CORRECT_NEGATIVE: 8,
    TRAITOR_TRIO_PARTIAL: 3,
    TRAITOR_TRIO_PERFECT: 15,
    TRAITOR_TRIO_PERFECT_PER_MEMBER: 5,
  },
  tieBreakStrategy: "final_pot_distance",
  bonusModules: {
    redemptionRoulette: true,
    shieldGambit: true,
    traitorTrio: true,
    doubleOrNothing: true,
    finaleGauntlet: true,
  },
};

export const SURVIVOR_STYLE_RULE_PACK: RulePack = {
  ...TRAITORS_CLASSIC_RULE_PACK,
  id: "survivor-style",
  name: "Survivor Style",
  description:
    "Survivor-like elimination predictions with no murdered call semantics and reduced bonus influence.",
  points: {
    ...TRAITORS_CLASSIC_RULE_PACK.points,
    FINALE_WEEKLY_CORRECT: 2,
    FINALE_WEEKLY_INCORRECT: 0.5,
    REDEMPTION_ROULETTE_CORRECT: 5,
    REDEMPTION_ROULETTE_CORRECT_NEGATIVE: 8,
    SHIELD_GAMBIT_CORRECT: 4,
    SHIELD_GAMBIT_CORRECT_NEGATIVE: 6,
  },
};

export const GENERIC_ELIMINATION_RULE_PACK: RulePack = {
  ...TRAITORS_CLASSIC_RULE_PACK,
  id: "generic-elimination",
  name: "Generic Elimination",
  description:
    "Balanced elimination format for repurposing outside Traitors-specific season language.",
  points: {
    ...TRAITORS_CLASSIC_RULE_PACK.points,
    PRED_WINNER: 8,
    TRAITOR_BONUS: 0,
    FINALE_FINAL_WINNER: 12,
    FINALE_LAST_FAITHFUL_STANDING: 6,
    FINALE_LAST_TRAITOR_STANDING: 0,
  },
};

export const RULE_PACKS: RulePack[] = [
  TRAITORS_CLASSIC_RULE_PACK,
  SURVIVOR_STYLE_RULE_PACK,
  GENERIC_ELIMINATION_RULE_PACK,
];

export const RULE_PACKS_BY_ID = Object.fromEntries(
  RULE_PACKS.map((pack) => [pack.id, pack])
) as Record<string, RulePack>;

export const getRulePackById = (id?: string | null): RulePack => {
  if (!id) return TRAITORS_CLASSIC_RULE_PACK;
  return RULE_PACKS_BY_ID[id] ?? TRAITORS_CLASSIC_RULE_PACK;
};
