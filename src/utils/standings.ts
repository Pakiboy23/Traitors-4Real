import type { GameState, PlayerEntry, WeeklyResults } from "../../types";
import {
  calculatePlayerScore,
  getFinaleTieBreakDistance,
} from "./scoring";

/**
 * Same "is there anything to score this week?" check the Leaderboard uses
 * before it falls back to the latest archived total.
 */
export const weeklyResultsAreLive = (weekly?: WeeklyResults | null): boolean =>
  Boolean(
    weekly?.nextBanished ||
      weekly?.nextMurdered ||
      weekly?.bonusGames?.redemptionRoulette ||
      weekly?.bonusGames?.shieldGambit ||
      weekly?.bonusGames?.traitorTrio?.length ||
      weekly?.finaleResults?.finalWinner ||
      weekly?.finaleResults?.lastFaithfulStanding ||
      weekly?.finaleResults?.lastTraitorStanding ||
      typeof weekly?.finaleResults?.finalPotValue === "number"
  );

/** Leaderboard number: live calculatePlayerScore, or the archive when the week has no results yet. */
export const resolveDisplayTotal = (
  gameState: GameState,
  playerId: string,
  scoringTotal: number
): number => {
  if (weeklyResultsAreLive(gameState.weeklyResults)) return scoringTotal;
  const history = Array.isArray(gameState.weeklyScoreHistory)
    ? gameState.weeklyScoreHistory
    : [];
  const archived = history[history.length - 1]?.totals?.[playerId];
  return typeof archived === "number" ? archived : scoringTotal;
};

export interface StandingSortKey {
  name: string;
  displayTotal: number;
  tieBreakDistance: number | null;
}

/** Leaderboard order: score, finale pot distance when that tie-break is on, then name. */
export const compareStandingEntries = (a: StandingSortKey, b: StandingSortKey): number => {
  if (b.displayTotal !== a.displayTotal) return b.displayTotal - a.displayTotal;
  const aDistance = a.tieBreakDistance;
  const bDistance = b.tieBreakDistance;
  if (aDistance === null && bDistance !== null) return 1;
  if (aDistance !== null && bDistance === null) return -1;
  if (
    typeof aDistance === "number" &&
    typeof bDistance === "number" &&
    aDistance !== bDistance
  ) {
    return aDistance - bDistance;
  }
  return a.name.localeCompare(b.name);
};

export interface LeaderboardRankContext {
  tieBreakActive: boolean;
  pot: number | null;
}

export const leaderboardRankContext = (gameState: GameState): LeaderboardRankContext => {
  const history = Array.isArray(gameState.weeklyScoreHistory)
    ? gameState.weeklyScoreHistory
    : [];
  const latest = history[history.length - 1];
  const live = weeklyResultsAreLive(gameState.weeklyResults);
  const detail = !live && latest?.weeklyResults ? latest.weeklyResults : gameState.weeklyResults;
  const rawPot = detail?.finaleResults?.finalPotValue;
  const pot = typeof rawPot === "number" && Number.isFinite(rawPot) ? rawPot : null;
  return {
    tieBreakActive: Boolean(gameState.finaleConfig?.enabled) && typeof pot === "number",
    pot,
  };
};

const tieBreakDistanceFor = (
  player: PlayerEntry,
  context: LeaderboardRankContext
): number | null => {
  if (!context.tieBreakActive || typeof context.pot !== "number") return null;
  return getFinaleTieBreakDistance(player, context.pot);
};

export interface CurrentStanding {
  playerId: string;
  name: string;
  score: number;
  tieBreakDistance: number | null;
}

/** Current standings in leaderboard order. Scores come from calculatePlayerScore. */
export const currentStandings = (gameState: GameState): CurrentStanding[] => {
  const context = leaderboardRankContext(gameState);
  return gameState.players
    .map((player) => {
      const scoring = calculatePlayerScore(gameState, player);
      return {
        playerId: player.id,
        name: player.name,
        score: resolveDisplayTotal(gameState, player.id, scoring.total),
        tieBreakDistance: tieBreakDistanceFor(player, context),
      };
    })
    .sort((a, b) =>
      compareStandingEntries(
        { name: a.name, displayTotal: a.score, tieBreakDistance: a.tieBreakDistance },
        { name: b.name, displayTotal: b.score, tieBreakDistance: b.tieBreakDistance }
      )
    );
};
