import type { GameState, PlayerEntry } from "../../types";

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

export const calculatePlayerScore = (
  gameState: GameState,
  player: PlayerEntry
): PlayerScore => {
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
      score += 10;
      breakdown.draftWinners.push(pick.member);
      achievements.push({
        member: pick.member,
        type: "Winner",
        points: 10,
        icon: "🏆",
      });
    }
  });

  if (gameState.castStatus[player.predWinner]?.isWinner) {
    score += 10;
    breakdown.predWinner = true;
    achievements.push({
      member: player.predWinner,
      type: "Prophecy: Winner",
      points: 10,
      icon: "✨",
    });
  }

  if (gameState.castStatus[player.predFirstOut]?.isFirstOut) {
    score += 5;
    breakdown.predFirstOut = true;
    achievements.push({
      member: player.predFirstOut,
      type: "Prophecy: 1st Out",
      points: 5,
      icon: "💀",
    });
  }

  player.predTraitors.forEach((guess) => {
    if (gameState.castStatus[guess]?.isTraitor) {
      score += 3;
      breakdown.traitorBonus.push(guess);
      achievements.push({
        member: guess,
        type: "Unmasked Traitor",
        points: 3,
        icon: "🎭",
      });
    }
  });

  if (gameState.castStatus[player.predWinner]?.isFirstOut) {
    score -= 2;
    breakdown.penalty = true;
  }

  const weeklyResults = gameState.weeklyResults;
  const weeklyPredictions = player.weeklyPredictions;
  const doubleOrNothing = Boolean(weeklyPredictions?.bonusGames?.doubleOrNothing);
  const weeklyMultiplier = doubleOrNothing ? 2 : 1;
  const weeklyCorrectPoints = 1 * weeklyMultiplier;
  const weeklyIncorrectPoints = 0.5 * weeklyMultiplier;

  if (weeklyResults?.nextBanished && weeklyPredictions?.nextBanished) {
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

  if (weeklyResults?.nextMurdered && weeklyPredictions?.nextMurdered) {
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

  if (bonusResults?.redemptionRoulette && bonusPredictions?.redemptionRoulette) {
    if (bonusResults.redemptionRoulette === bonusPredictions.redemptionRoulette) {
      const points = isNegativeForBonus ? 16 : 8;
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
      score -= 1;
      breakdown.bonusGames.push({
        label: "Redemption Roulette",
        result: "incorrect",
        points: -1,
      });
    }
  }

  if (bonusResults?.shieldGambit && bonusPredictions?.shieldGambit) {
    if (bonusResults.shieldGambit === bonusPredictions.shieldGambit) {
      const points = isNegativeForBonus ? 8 : 5;
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

  return { total: score, breakdown, achievements };
};
