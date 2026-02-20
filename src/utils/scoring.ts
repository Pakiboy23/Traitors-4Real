import type { GameState, PlayerEntry } from "../../types";
import { normalizeWeekId } from "../../types";
import { SCORING_POINTS, MULTIPLIERS } from "./scoringConstants";

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
}

export interface PlayerScore {
  total: number;
  breakdown: ScoreBreakdown;
  achievements: ScoreAchievement[];
}

export const formatScore = (value: number) =>
  Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);

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
  if (!isValidCurrentWeekPick(bonus.redemptionRoulette)) return false;
  if (!isValidCurrentWeekPick(bonus.shieldGambit)) return false;
  if (
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

export const calculatePlayerScore = (
  gameState: GameState,
  player: PlayerEntry
): PlayerScore => {
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
  };

  player.picks.forEach((pick) => {
    const status = gameState.castStatus[pick.member];
    if (status?.isWinner) {
      score += SCORING_POINTS.DRAFT_WINNER;
      breakdown.draftWinners.push(pick.member);
      achievements.push({
        member: pick.member,
        type: "Winner",
        points: SCORING_POINTS.DRAFT_WINNER,
        icon: "🏆",
      });
    }
  });

  if (gameState.castStatus[player.predWinner]?.isWinner) {
    score += SCORING_POINTS.PRED_WINNER;
    breakdown.predWinner = true;
    achievements.push({
      member: player.predWinner,
      type: "Prophecy: Winner",
      points: SCORING_POINTS.PRED_WINNER,
      icon: "✨",
    });
  }

  if (gameState.castStatus[player.predFirstOut]?.isFirstOut) {
    score += SCORING_POINTS.PRED_FIRST_OUT;
    breakdown.predFirstOut = true;
    achievements.push({
      member: player.predFirstOut,
      type: "Prophecy: 1st Out",
      points: SCORING_POINTS.PRED_FIRST_OUT,
      icon: "💀",
    });
  }

  player.predTraitors.forEach((guess) => {
    if (gameState.castStatus[guess]?.isTraitor) {
      score += SCORING_POINTS.TRAITOR_BONUS;
      breakdown.traitorBonus.push(guess);
      achievements.push({
        member: guess,
        type: "Unmasked Traitor",
        points: SCORING_POINTS.TRAITOR_BONUS,
        icon: "🎭",
      });
    }
  });

  if (gameState.castStatus[player.predWinner]?.isFirstOut) {
    score += SCORING_POINTS.PROPHECY_REVERSED_PENALTY;
    breakdown.penalty = true;
  }

  const weeklyResults = gameState.weeklyResults;
  const weeklyPredictions = player.weeklyPredictions;
  const currentWeekId =
    normalizeWeekId(gameState.activeWeekId) ??
    normalizeWeekId(weeklyResults?.weekId);
  const weeklyResultWeekId =
    normalizeWeekId(weeklyResults?.weekId) ?? currentWeekId;
  const weeklyPredictionWeekId = resolveEffectiveWeeklyPredictionWeekId(
    gameState,
    player,
    weeklyResultWeekId
  );
  const hasMatchingWeeklyWeek = Boolean(
    weeklyPredictionWeekId &&
      weeklyResultWeekId &&
      weeklyPredictionWeekId === weeklyResultWeekId
  );
  const weeklyMultiplier = getWeeklyMultiplier(player);
  const weeklyCorrectPoints = SCORING_POINTS.WEEKLY_CORRECT_BASE * weeklyMultiplier;
  const weeklyIncorrectPoints = SCORING_POINTS.WEEKLY_INCORRECT_BASE * weeklyMultiplier;

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
        ? SCORING_POINTS.REDEMPTION_ROULETTE_CORRECT_NEGATIVE
        : SCORING_POINTS.REDEMPTION_ROULETTE_CORRECT;
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
      score += SCORING_POINTS.REDEMPTION_ROULETTE_INCORRECT;
      breakdown.bonusGames.push({
        label: "Redemption Roulette",
        result: "incorrect",
        points: SCORING_POINTS.REDEMPTION_ROULETTE_INCORRECT,
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
        ? SCORING_POINTS.SHIELD_GAMBIT_CORRECT_NEGATIVE
        : SCORING_POINTS.SHIELD_GAMBIT_CORRECT;
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
          ? SCORING_POINTS.TRAITOR_TRIO_PERFECT
          : correctCount * SCORING_POINTS.TRAITOR_TRIO_PARTIAL;
      const perNamePoints =
        correctCount === 3
          ? SCORING_POINTS.TRAITOR_TRIO_PERFECT_PER_MEMBER
          : SCORING_POINTS.TRAITOR_TRIO_PARTIAL;
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
  return { total: score, breakdown, achievements };
};
