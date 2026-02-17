import { describe, it, expect } from 'vitest';
import { calculatePlayerScore, formatScore } from './scoring';
import { SCORING_POINTS } from './scoringConstants';
import type { GameState, PlayerEntry } from '../../types';

describe('formatScore', () => {
  it('should format integer scores without decimals', () => {
    expect(formatScore(10)).toBe('10');
    expect(formatScore(0)).toBe('0');
    expect(formatScore(-5)).toBe('-5');
  });

  it('should format decimal scores with one decimal place', () => {
    expect(formatScore(10.5)).toBe('10.5');
    expect(formatScore(3.7)).toBe('3.7');
    expect(formatScore(-2.3)).toBe('-2.3');
  });
});

describe('calculatePlayerScore', () => {
  const createMockGameState = (overrides?: Partial<GameState>): GameState => ({
    players: [],
    castStatus: {},
    weeklyResults: {
      nextBanished: '',
      nextMurdered: '',
      bonusGames: {},
    },
    ...overrides,
  });

  const createMockPlayer = (overrides?: Partial<PlayerEntry>): PlayerEntry => ({
    id: 'test-player-1',
    name: 'Test Player',
    email: 'test@example.com',
    picks: [],
    predFirstOut: '',
    predWinner: '',
    predTraitors: [],
    ...overrides,
  });

  describe('Draft picks scoring', () => {
    it('should award points for draft winners', () => {
      const gameState = createMockGameState({
        castStatus: {
          'Player A': { isWinner: true, isFirstOut: false, isTraitor: false, isEliminated: false },
          'Player B': { isWinner: true, isFirstOut: false, isTraitor: false, isEliminated: false },
        },
      });

      const player = createMockPlayer({
        picks: [
          { member: 'Player A', rank: 1, role: 'Faithful' },
          { member: 'Player B', rank: 2, role: 'Faithful' },
        ],
      });

      const result = calculatePlayerScore(gameState, player);

      expect(result.total).toBe(SCORING_POINTS.DRAFT_WINNER * 2);
      expect(result.breakdown.draftWinners).toEqual(['Player A', 'Player B']);
      expect(result.achievements).toHaveLength(2);
    });

    it('should not award points for non-winning picks', () => {
      const gameState = createMockGameState({
        castStatus: {
          'Player A': { isWinner: false, isFirstOut: false, isTraitor: false, isEliminated: true },
        },
      });

      const player = createMockPlayer({
        picks: [{ member: 'Player A', rank: 1, role: 'Faithful' }],
      });

      const result = calculatePlayerScore(gameState, player);
      expect(result.total).toBe(0);
      expect(result.breakdown.draftWinners).toEqual([]);
    });
  });

  describe('Prophecy scoring', () => {
    it('should award points for correct winner prediction', () => {
      const gameState = createMockGameState({
        castStatus: {
          'Winner': { isWinner: true, isFirstOut: false, isTraitor: false, isEliminated: false },
        },
      });

      const player = createMockPlayer({
        predWinner: 'Winner',
      });

      const result = calculatePlayerScore(gameState, player);
      expect(result.total).toBe(SCORING_POINTS.PRED_WINNER);
      expect(result.breakdown.predWinner).toBe(true);
    });

    it('should award points for correct first out prediction', () => {
      const gameState = createMockGameState({
        castStatus: {
          'FirstOut': { isWinner: false, isFirstOut: true, isTraitor: false, isEliminated: true },
        },
      });

      const player = createMockPlayer({
        predFirstOut: 'FirstOut',
      });

      const result = calculatePlayerScore(gameState, player);
      expect(result.total).toBe(SCORING_POINTS.PRED_FIRST_OUT);
      expect(result.breakdown.predFirstOut).toBe(true);
    });

    it('should apply penalty when winner prediction is first out', () => {
      const gameState = createMockGameState({
        castStatus: {
          'BadPick': { isWinner: false, isFirstOut: true, isTraitor: false, isEliminated: true },
        },
      });

      const player = createMockPlayer({
        predWinner: 'BadPick',
      });

      const result = calculatePlayerScore(gameState, player);
      expect(result.total).toBe(SCORING_POINTS.PROPHECY_REVERSED_PENALTY);
      expect(result.breakdown.penalty).toBe(true);
    });
  });

  describe('Traitor identification', () => {
    it('should award points for each correctly identified traitor', () => {
      const gameState = createMockGameState({
        castStatus: {
          'Traitor1': { isWinner: false, isFirstOut: false, isTraitor: true, isEliminated: false },
          'Traitor2': { isWinner: false, isFirstOut: false, isTraitor: true, isEliminated: false },
          'Faithful': { isWinner: false, isFirstOut: false, isTraitor: false, isEliminated: false },
        },
      });

      const player = createMockPlayer({
        predTraitors: ['Traitor1', 'Traitor2', 'Faithful'],
      });

      const result = calculatePlayerScore(gameState, player);
      expect(result.total).toBe(SCORING_POINTS.TRAITOR_BONUS * 2);
      expect(result.breakdown.traitorBonus).toEqual(['Traitor1', 'Traitor2']);
    });
  });

  describe('Weekly predictions', () => {
    it('should award points for correct weekly predictions', () => {
      const gameState = createMockGameState({
        weeklyResults: {
          nextBanished: 'Player A',
          nextMurdered: 'Player B',
        },
      });

      const player = createMockPlayer({
        weeklyPredictions: {
          nextBanished: 'Player A',
          nextMurdered: 'Player B',
        },
      });

      const result = calculatePlayerScore(gameState, player);
      expect(result.total).toBe(SCORING_POINTS.WEEKLY_CORRECT_BASE * 2);
    });

    it('should apply penalty for incorrect weekly predictions', () => {
      const gameState = createMockGameState({
        weeklyResults: {
          nextBanished: 'Player A',
          nextMurdered: 'Player B',
        },
      });

      const player = createMockPlayer({
        weeklyPredictions: {
          nextBanished: 'Player C',
          nextMurdered: 'Player D',
        },
      });

      const result = calculatePlayerScore(gameState, player);
      expect(result.total).toBe(-SCORING_POINTS.WEEKLY_INCORRECT_BASE * 2);
    });

    it('should double weekly points with Double or Nothing', () => {
      const gameState = createMockGameState({
        weeklyResults: {
          nextBanished: 'Player A',
          nextMurdered: 'Player B',
        },
      });

      const player = createMockPlayer({
        weeklyPredictions: {
          nextBanished: 'Player A',
          nextMurdered: 'Player B',
          bonusGames: {
            doubleOrNothing: true,
          },
        },
      });

      const result = calculatePlayerScore(gameState, player);
      expect(result.total).toBe(SCORING_POINTS.WEEKLY_CORRECT_BASE * 2 * 2); // 2 correct * 2x multiplier
    });
  });

  describe('Bonus games', () => {
    it('should award redemption roulette points when correct', () => {
      const gameState = createMockGameState({
        weeklyResults: {
          bonusGames: {
            redemptionRoulette: 'Traitor',
          },
        },
      });

      const player = createMockPlayer({
        weeklyPredictions: {
          nextBanished: '',
          nextMurdered: '',
          bonusGames: {
            redemptionRoulette: 'Traitor',
          },
        },
      });

      const result = calculatePlayerScore(gameState, player);
      expect(result.total).toBe(SCORING_POINTS.REDEMPTION_ROULETTE_CORRECT);
    });

    it('should double redemption roulette points when player has negative score', () => {
      const gameState = createMockGameState({
        castStatus: {
          'BadPick': { isWinner: false, isFirstOut: true, isTraitor: false, isEliminated: true },
        },
        weeklyResults: {
          bonusGames: {
            redemptionRoulette: 'Traitor',
          },
        },
      });

      const player = createMockPlayer({
        predWinner: 'BadPick', // -2 points penalty
        weeklyPredictions: {
          nextBanished: '',
          nextMurdered: '',
          bonusGames: {
            redemptionRoulette: 'Traitor',
          },
        },
      });

      const result = calculatePlayerScore(gameState, player);
      // Should have -2 from penalty, then +16 from doubled redemption = 14
      expect(result.total).toBe(
        SCORING_POINTS.PROPHECY_REVERSED_PENALTY +
        SCORING_POINTS.REDEMPTION_ROULETTE_CORRECT_NEGATIVE
      );
    });

    it('should award perfect traitor trio bonus', () => {
      const gameState = createMockGameState({
        weeklyResults: {
          bonusGames: {
            traitorTrio: ['T1', 'T2', 'T3'],
          },
        },
      });

      const player = createMockPlayer({
        weeklyPredictions: {
          nextBanished: '',
          nextMurdered: '',
          bonusGames: {
            traitorTrio: ['T1', 'T2', 'T3'],
          },
        },
      });

      const result = calculatePlayerScore(gameState, player);
      expect(result.total).toBe(SCORING_POINTS.TRAITOR_TRIO_PERFECT);
    });

    it('should award partial traitor trio points', () => {
      const gameState = createMockGameState({
        weeklyResults: {
          bonusGames: {
            traitorTrio: ['T1', 'T2', 'T3'],
          },
        },
      });

      const player = createMockPlayer({
        weeklyPredictions: {
          nextBanished: '',
          nextMurdered: '',
          bonusGames: {
            traitorTrio: ['T1', 'T2', 'Wrong'],
          },
        },
      });

      const result = calculatePlayerScore(gameState, player);
      expect(result.total).toBe(SCORING_POINTS.TRAITOR_TRIO_PARTIAL * 2); // 2 correct
    });
  });

  describe('Complex scoring scenarios', () => {
    it('should correctly calculate score for a winning player with multiple achievements', () => {
      const gameState = createMockGameState({
        castStatus: {
          'Winner': { isWinner: true, isFirstOut: false, isTraitor: false, isEliminated: false },
          'FirstOut': { isWinner: false, isFirstOut: true, isTraitor: false, isEliminated: true },
          'Traitor1': { isWinner: false, isFirstOut: false, isTraitor: true, isEliminated: false },
          'Picked': { isWinner: true, isFirstOut: false, isTraitor: false, isEliminated: false },
        },
        weeklyResults: {
          nextBanished: 'Player A',
          nextMurdered: 'Player B',
          bonusGames: {
            redemptionRoulette: 'Traitor1',
          },
        },
      });

      const player = createMockPlayer({
        picks: [{ member: 'Picked', rank: 1, role: 'Faithful' }],
        predWinner: 'Winner',
        predFirstOut: 'FirstOut',
        predTraitors: ['Traitor1'],
        weeklyPredictions: {
          nextBanished: 'Player A',
          nextMurdered: 'Player B',
          bonusGames: {
            redemptionRoulette: 'Traitor1',
          },
        },
      });

      const result = calculatePlayerScore(gameState, player);

      const expected =
        SCORING_POINTS.DRAFT_WINNER + // 10
        SCORING_POINTS.PRED_WINNER + // 10
        SCORING_POINTS.PRED_FIRST_OUT + // 5
        SCORING_POINTS.TRAITOR_BONUS + // 3
        (SCORING_POINTS.WEEKLY_CORRECT_BASE * 2) + // 2
        SCORING_POINTS.REDEMPTION_ROULETTE_CORRECT; // 8

      expect(result.total).toBe(expected); // 38
      expect(result.achievements.length).toBeGreaterThan(0);
    });
  });
});
