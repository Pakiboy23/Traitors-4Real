import type {
  GameState,
  PlayerEntry,
  RulePack,
  ScoreAdjustment,
  SeasonState,
} from "../../types";
import { normalizeWeekId } from "../../types";
import { TRAITORS_CLASSIC_RULE_PACK, getRulePackById } from "../config/rulePacks";
import { MULTIPLIERS } from "./scoringConstants";

export interface ScoreAchievement {
  member: string;
  type: string;
  points: number;
  icon: string;
}

export interface ScoreBreakdown {
  draftWinners: string[];
  predWinner: boolean;
  predFirstOut: boolean;
  traitorBonus: string[];
  penalty: boolean;
  weeklyCouncil: { label: string; result: "correct" | "incorrect" }[];
  bonusGames: { label: string; result: "correct" | "incorrect" | "partial"; points: number }[];
  finaleGauntlet: { label: string; result: "correct" | "incorrect"; points: number }[];
  adjustments: { reason: string; points: number; weekId?: string }[];
}

export interface PlayerScore {
  total: number;
  breakdown: ScoreBreakdown;
  achievements: ScoreAchievement[];
}

export interface CalculatePlayerScoreInput {
  seasonState: SeasonState;
  player: PlayerEntry;
  rulePack?: RulePack;
  adjustments?: ScoreAdjustment[];
}

export const formatScore = (value: number) =>
  Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);

export const getFinaleTieBreakDistance = (
  player: PlayerEntry,
  finalPotValue?: number | null
) => {
  if (typeof finalPotValue !== "number" || !Number.isFinite(finalPotValue)) {
    return null;
  }
  const estimate = player.weeklyPredictions?.finalePredictions?.finalPotEstimate;
  if (typeof estimate !== "number" || !Number.isFinite(estimate)) {
    return null;
  }
  return Math.abs(estimate - finalPotValue);
};

const hasWeeklyPredictionContent = (
  weeklyPredictions?: PlayerEntry["weeklyPredictions"] | null
) => {
  if (!weeklyPredictions) return false;
  if (
    typeof weeklyPredictions.nextBanished === "string" &&
    weeklyPredictions.nextBanished.trim()
  ) {
    return true;
  }
  if (
    typeof weeklyPredictions.nextMurdered === "string" &&
    weeklyPredictions.nextMurdered.trim()
  ) {
    return true;
  }
  const finale = weeklyPredictions.finalePredictions;
  if (typeof finale?.finalWinner === "string" && finale.finalWinner.trim()) {
    return true;
  }
  if (
    typeof finale?.lastFaithfulStanding === "string" &&
    finale.lastFaithfulStanding.trim()
  ) {
    return true;
  }
  if (
    typeof finale?.lastTraitorStanding === "string" &&
    finale.lastTraitorStanding.trim()
  ) {
    return true;
  }
  if (typeof finale?.finalPotEstimate === "number" && Number.isFinite(finale.finalPotEstimate)) {
    return true;
  }
  const bonus = weeklyPredictions.bonusGames;
  if (!bonus) return false;
  if (typeof bonus.redemptionRoulette === "string" && bonus.redemptionRoulette.trim()) {
    return true;
  }
  if (typeof bonus.shieldGambit === "string" && bonus.shieldGambit.trim()) {
    return true;
  }
  if (
    Array.isArray(bonus.traitorTrio) &&
    bonus.traitorTrio.some((pick) => typeof pick === "string" && pick.trim())
  ) {
    return true;
  }
  return Boolean(bonus.doubleOrNothing);
};

const hasAnyScopedWeeklyPredictions = (gameState: GameState) =>
  gameState.players.some((entry) =>
    Boolean(normalizeWeekId(entry.weeklyPredictions?.weekId))
  );

const isLikelyCurrentWeekLegacyPrediction = (
  gameState: GameState,
  player: PlayerEntry
) => {
  const weeklyPredictions = player.weeklyPredictions;
  if (!weeklyPredictions) return false;

  const weeklyResults = gameState.weeklyResults;
  const bonusResults = weeklyResults?.bonusGames;
  const isValidCurrentWeekPick = (pick?: string) => {
    if (typeof pick !== "string" || !pick.trim()) return true;
    const status = gameState.castStatus[pick];
    if (!status) return true;
    if (!status.isEliminated) return true;
    if (weeklyResults?.nextBanished === pick) return true;
    if (weeklyResults?.nextMurdered === pick) return true;
    return false;
  };

  if (!isValidCurrentWeekPick(weeklyPredictions.nextBanished)) return false;
  if (!isValidCurrentWeekPick(weeklyPredictions.nextMurdered)) return false;

  const bonus = weeklyPredictions.bonusGames;
  if (!bonus) return true;
  if (bonusResults?.redemptionRoulette && !isValidCurrentWeekPick(bonus.redemptionRoulette)) {
    return false;
  }
  if (bonusResults?.shieldGambit && !isValidCurrentWeekPick(bonus.shieldGambit)) {
    return false;
  }
  if (
    bonusResults?.traitorTrio?.length &&
    Array.isArray(bonus.traitorTrio) &&
    bonus.traitorTrio.some((pick) => !isValidCurrentWeekPick(pick))
  ) {
    return false;
  }
  return true;
};

export const resolveEffectiveWeeklyPredictionWeekId = (
  gameState: GameState,
  player: PlayerEntry,
  weeklyResultWeekId?: string | null
) => {
  const explicitWeekId = normalizeWeekId(player.weeklyPredictions?.weekId);
  if (explicitWeekId) return explicitWeekId;
  if (!hasWeeklyPredictionContent(player.weeklyPredictions)) return null;

  // Backward-compatibility: if no player has scoped week IDs yet,
  // only treat legacy predictions as current-week when the picks are
  // still plausible for the current cast/week state.
  if (
    !hasAnyScopedWeeklyPredictions(gameState) &&
    isLikelyCurrentWeekLegacyPrediction(gameState, player)
  ) {
    return (
      normalizeWeekId(weeklyResultWeekId) ??
      normalizeWeekId(gameState.activeWeekId)
    );
  }
  return null;
};

const isCalculatePlayerScoreInput = (
  value: GameState | CalculatePlayerScoreInput,
  maybePlayer?: PlayerEntry
): value is CalculatePlayerScoreInput =>
  Boolean(
    !maybePlayer &&
      value &&
      typeof value === "object" &&
      "seasonState" in value &&
      "player" in value
  );

export const calculatePlayerScore = (
  stateOrInput: GameState | CalculatePlayerScoreInput,
  maybePlayer?: PlayerEntry
): PlayerScore => {
  const seasonState: SeasonState = isCalculatePlayerScoreInput(
    stateOrInput,
    maybePlayer
  )
    ? stateOrInput.seasonState
    : (stateOrInput as SeasonState);
  const player: PlayerEntry = isCalculatePlayerScoreInput(
    stateOrInput,
    maybePlayer
  )
    ? stateOrInput.player
    : (maybePlayer as PlayerEntry);
  const effectiveRulePack = isCalculatePlayerScoreInput(
    stateOrInput,
    maybePlayer
  )
    ? stateOrInput.rulePack ??
      getRulePackById(
        stateOrInput.seasonState.rulePackId ??
          stateOrInput.seasonState.seasonConfig?.rulePackId
      )
    : getRulePackById(
        seasonState.rulePackId ?? seasonState.seasonConfig?.rulePackId
      );
  const scoreAdjustments =
    (isCalculatePlayerScoreInput(stateOrInput, maybePlayer)
      ? stateOrInput.adjustments
      : undefined) ??
    seasonState.scoreAdjustments ??
    [];
  const scoringPoints = effectiveRulePack.points ?? TRAITORS_CLASSIC_RULE_PACK.points;

  const getWeeklyMultiplier = (entry: PlayerEntry) =>
    entry.weeklyPredictions?.bonusGames?.doubleOrNothing
      ? MULTIPLIERS.DOUBLE_OR_NOTHING
      : MULTIPLIERS.NORMAL;

  let score = 0;
  const achievements: ScoreAchievement[] = [];
  const breakdown: ScoreBreakdown = {
    draftWinners: [],
    predWinner: false,
    predFirstOut: false,
    traitorBonus: [],
    penalty: false,
    weeklyCouncil: [],
    bonusGames: [],
    finaleGauntlet: [],
    adjustments: [],
  };

  const normalizeMemberKey = (name?: string | null) =>
    typeof name === "string" ? name.trim().toLowerCase() : "";

  const countedWinnerPickKeys = new Set<string>();
  player.picks.forEach((pick) => {
    const memberKey = normalizeMemberKey(pick.member);
    if (!memberKey || countedWinnerPickKeys.has(memberKey)) return;
    countedWinnerPickKeys.add(memberKey);
    const status = seasonState.castStatus[pick.member];
    if (status?.isWinner) {
      score += scoringPoints.DRAFT_WINNER;
      breakdown.draftWinners.push(pick.member);
      achievements.push({
        member: pick.member,
        type: "Winner",
        points: scoringPoints.DRAFT_WINNER,
        icon: "🏆",
      });
    }
  });

  if (seasonState.castStatus[player.predWinner]?.isWinner) {
    score += scoringPoints.PRED_WINNER;
    breakdown.predWinner = true;
    achievements.push({
      member: player.predWinner,
      type: "Prophecy: Winner",
      points: scoringPoints.PRED_WINNER,
      icon: "✨",
    });
  }

  if (seasonState.castStatus[player.predFirstOut]?.isFirstOut) {
    score += scoringPoints.PRED_FIRST_OUT;
    breakdown.predFirstOut = true;
    achievements.push({
      member: player.predFirstOut,
      type: "Prophecy: 1st Out",
      points: scoringPoints.PRED_FIRST_OUT,
      icon: "💀",
    });
  }

  const countedTraitorGuessKeys = new Set<string>();
  player.predTraitors.forEach((guess) => {
    const guessKey = normalizeMemberKey(guess);
    if (!guessKey || countedTraitorGuessKeys.has(guessKey)) return;
    countedTraitorGuessKeys.add(guessKey);
    if (seasonState.castStatus[guess]?.isTraitor) {
      score += scoringPoints.TRAITOR_BONUS;
      breakdown.traitorBonus.push(guess);
      achievements.push({
        member: guess,
        type: "Unmasked Traitor",
        points: scoringPoints.TRAITOR_BONUS,
        icon: "🎭",
      });
    }
  });

  if (seasonState.castStatus[player.predWinner]?.isFirstOut) {
    score += scoringPoints.PROPHECY_REVERSED_PENALTY;
    breakdown.penalty = true;
  }

  const weeklyResults = seasonState.weeklyResults;
  const weeklyPredictions = player.weeklyPredictions;
  const currentWeekId =
    normalizeWeekId(seasonState.activeWeekId) ??
    normalizeWeekId(weeklyResults?.weekId);
  const weeklyResultWeekId =
    normalizeWeekId(weeklyResults?.weekId) ?? currentWeekId;
  const weeklyPredictionWeekId = resolveEffectiveWeeklyPredictionWeekId(
    seasonState,
    player,
    weeklyResultWeekId
  );
  const hasMatchingWeeklyWeek = Boolean(
    weeklyPredictionWeekId &&
      weeklyResultWeekId &&
      weeklyPredictionWeekId === weeklyResultWeekId
  );
  const isFinaleWeek = Boolean(seasonState.finaleConfig?.enabled);
  const weeklyMultiplier = isFinaleWeek ? MULTIPLIERS.NORMAL : getWeeklyMultiplier(player);
  const weeklyCorrectPoints = isFinaleWeek
    ? scoringPoints.FINALE_WEEKLY_CORRECT
    : scoringPoints.WEEKLY_CORRECT_BASE * weeklyMultiplier;
  const weeklyIncorrectPoints = isFinaleWeek
    ? scoringPoints.FINALE_WEEKLY_INCORRECT
    : scoringPoints.WEEKLY_INCORRECT_BASE * weeklyMultiplier;

  if (
    hasMatchingWeeklyWeek &&
    weeklyResults?.nextBanished &&
    weeklyPredictions?.nextBanished
  ) {
    if (weeklyResults.nextBanished === weeklyPredictions.nextBanished) {
      score += weeklyCorrectPoints;
      breakdown.weeklyCouncil.push({ label: "Next Banished", result: "correct" });
      achievements.push({
        member: weeklyPredictions.nextBanished,
        type: "Weekly: Banished",
        points: weeklyCorrectPoints,
        icon: "⚖️",
      });
    } else {
      score -= weeklyIncorrectPoints;
      breakdown.weeklyCouncil.push({ label: "Next Banished", result: "incorrect" });
    }
  }

  if (
    hasMatchingWeeklyWeek &&
    weeklyResults?.nextMurdered &&
    weeklyPredictions?.nextMurdered &&
    weeklyResults.nextMurdered !== "No Murder"
  ) {
    if (weeklyResults.nextMurdered === weeklyPredictions.nextMurdered) {
      score += weeklyCorrectPoints;
      breakdown.weeklyCouncil.push({ label: "Next Murdered", result: "correct" });
      achievements.push({
        member: weeklyPredictions.nextMurdered,
        type: "Weekly: Murdered",
        points: weeklyCorrectPoints,
        icon: "🗡️",
      });
    } else {
      score -= weeklyIncorrectPoints;
      breakdown.weeklyCouncil.push({ label: "Next Murdered", result: "incorrect" });
    }
  }

  const finaleResults = weeklyResults?.finaleResults;
  const finalePredictions = weeklyPredictions?.finalePredictions;

  if (
    hasMatchingWeeklyWeek &&
    isFinaleWeek &&
    finaleResults?.finalWinner &&
    finalePredictions?.finalWinner
  ) {
    if (finaleResults.finalWinner === finalePredictions.finalWinner) {
      score += scoringPoints.FINALE_FINAL_WINNER;
      breakdown.finaleGauntlet.push({
        label: "Final Winner",
        result: "correct",
        points: scoringPoints.FINALE_FINAL_WINNER,
      });
      achievements.push({
        member: finalePredictions.finalWinner,
        type: "Finale: Final Winner",
        points: scoringPoints.FINALE_FINAL_WINNER,
        icon: "👑",
      });
    } else {
      breakdown.finaleGauntlet.push({
        label: "Final Winner",
        result: "incorrect",
        points: 0,
      });
    }
  }

  if (
    hasMatchingWeeklyWeek &&
    isFinaleWeek &&
    finaleResults?.lastFaithfulStanding &&
    finalePredictions?.lastFaithfulStanding
  ) {
    if (finaleResults.lastFaithfulStanding === finalePredictions.lastFaithfulStanding) {
      score += scoringPoints.FINALE_LAST_FAITHFUL_STANDING;
      breakdown.finaleGauntlet.push({
        label: "Last Faithful Standing",
        result: "correct",
        points: scoringPoints.FINALE_LAST_FAITHFUL_STANDING,
      });
      achievements.push({
        member: finalePredictions.lastFaithfulStanding,
        type: "Finale: Last Faithful Standing",
        points: scoringPoints.FINALE_LAST_FAITHFUL_STANDING,
        icon: "🕯️",
      });
    } else {
      breakdown.finaleGauntlet.push({
        label: "Last Faithful Standing",
        result: "incorrect",
        points: 0,
      });
    }
  }

  if (
    hasMatchingWeeklyWeek &&
    isFinaleWeek &&
    finaleResults?.lastTraitorStanding &&
    finalePredictions?.lastTraitorStanding
  ) {
    if (finaleResults.lastTraitorStanding === finalePredictions.lastTraitorStanding) {
      score += scoringPoints.FINALE_LAST_TRAITOR_STANDING;
      breakdown.finaleGauntlet.push({
        label: "Last Traitor Standing",
        result: "correct",
        points: scoringPoints.FINALE_LAST_TRAITOR_STANDING,
      });
      achievements.push({
        member: finalePredictions.lastTraitorStanding,
        type: "Finale: Last Traitor Standing",
        points: scoringPoints.FINALE_LAST_TRAITOR_STANDING,
        icon: "🎭",
      });
    } else {
      breakdown.finaleGauntlet.push({
        label: "Last Traitor Standing",
        result: "incorrect",
        points: 0,
      });
    }
  }

  const bonusResults = weeklyResults?.bonusGames;
  const bonusPredictions = weeklyPredictions?.bonusGames;
  const isNegativeForBonus = score < 0;

  if (
    hasMatchingWeeklyWeek &&
    bonusResults?.redemptionRoulette &&
    bonusPredictions?.redemptionRoulette
  ) {
    if (bonusResults.redemptionRoulette === bonusPredictions.redemptionRoulette) {
      const points = isNegativeForBonus
        ? scoringPoints.REDEMPTION_ROULETTE_CORRECT_NEGATIVE
        : scoringPoints.REDEMPTION_ROULETTE_CORRECT;
      score += points;
      breakdown.bonusGames.push({
        label: "Redemption Roulette",
        result: "correct",
        points,
      });
      achievements.push({
        member: bonusPredictions.redemptionRoulette,
        type: "Bonus: Redemption Roulette",
        points,
        icon: "🎲",
      });
    } else {
      score += scoringPoints.REDEMPTION_ROULETTE_INCORRECT;
      breakdown.bonusGames.push({
        label: "Redemption Roulette",
        result: "incorrect",
        points: scoringPoints.REDEMPTION_ROULETTE_INCORRECT,
      });
    }
  }

  if (
    hasMatchingWeeklyWeek &&
    bonusResults?.shieldGambit &&
    bonusPredictions?.shieldGambit
  ) {
    if (bonusResults.shieldGambit === bonusPredictions.shieldGambit) {
      const points = isNegativeForBonus
        ? scoringPoints.SHIELD_GAMBIT_CORRECT_NEGATIVE
        : scoringPoints.SHIELD_GAMBIT_CORRECT;
      score += points;
      breakdown.bonusGames.push({
        label: "Shield Gambit",
        result: "correct",
        points,
      });
      achievements.push({
        member: bonusPredictions.shieldGambit,
        type: "Bonus: Shield Gambit",
        points,
        icon: "🛡️",
      });
    } else {
      breakdown.bonusGames.push({
        label: "Shield Gambit",
        result: "incorrect",
        points: 0,
      });
    }
  }

  if (
    hasMatchingWeeklyWeek &&
    bonusResults?.traitorTrio?.length &&
    bonusPredictions?.traitorTrio?.length
  ) {
    const resultSet = Array.from(
      new Set(bonusResults.traitorTrio.filter(Boolean))
    );
    const predictionSet = Array.from(
      new Set(bonusPredictions.traitorTrio.filter(Boolean))
    );
    const correctCount = predictionSet.filter((name) =>
      resultSet.includes(name)
    ).length;
    if (correctCount > 0) {
      const points =
        correctCount === 3
          ? scoringPoints.TRAITOR_TRIO_PERFECT
          : correctCount * scoringPoints.TRAITOR_TRIO_PARTIAL;
      const perNamePoints =
        correctCount === 3
          ? scoringPoints.TRAITOR_TRIO_PERFECT_PER_MEMBER
          : scoringPoints.TRAITOR_TRIO_PARTIAL;
      score += points;
      breakdown.bonusGames.push({
        label: "Traitor Trio Challenge",
        result: correctCount === 3 ? "correct" : "partial",
        points,
      });
      predictionSet.forEach((name) => {
        if (!resultSet.includes(name)) return;
        achievements.push({
          member: name,
          type: "Bonus: Traitor Trio",
          points: perNamePoints,
          icon: "🎭",
        });
      });
    } else {
      breakdown.bonusGames.push({
        label: "Traitor Trio Challenge",
        result: "incorrect",
        points: 0,
      });
    }
  }

  scoreAdjustments
    .filter((adjustment) => {
      if (!adjustment.seasonId || !seasonState.seasonId) return true;
      return adjustment.seasonId === seasonState.seasonId;
    })
    .filter((adjustment) => adjustment.playerId === player.id)
    .filter((adjustment) => {
      if (!adjustment.weekId) return true;
      return normalizeWeekId(adjustment.weekId) === weeklyResultWeekId;
    })
    .forEach((adjustment) => {
      score += adjustment.points;
      breakdown.adjustments.push({
        reason: adjustment.reason,
        points: adjustment.points,
        weekId: adjustment.weekId,
      });
      achievements.push({
        member: player.name,
        type: `Adjustment: ${adjustment.reason}`,
        points: adjustment.points,
        icon: adjustment.points >= 0 ? "🧾" : "⚠️",
      });
    });

  return { total: score, breakdown, achievements };
};
