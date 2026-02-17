/**
 * Scoring constants for the Traitors Fantasy Draft game
 * All point values are defined here for consistency and easy adjustment
 */

export const SCORING_POINTS = {
  /** Points awarded for drafting a cast member who wins */
  DRAFT_WINNER: 10,

  /** Points awarded for correctly predicting the overall winner */
  PRED_WINNER: 10,

  /** Points awarded for correctly predicting the first eliminated player */
  PRED_FIRST_OUT: 5,

  /** Points awarded for each correctly identified traitor */
  TRAITOR_BONUS: 3,

  /** Penalty when your winner prediction is eliminated first */
  PROPHECY_REVERSED_PENALTY: -2,

  /** Base points for correct weekly council prediction (multiplied by weekly multiplier) */
  WEEKLY_CORRECT_BASE: 1,

  /** Base penalty for incorrect weekly council prediction (multiplied by weekly multiplier) */
  WEEKLY_INCORRECT_BASE: 0.5,

  /** Points for correct Redemption Roulette guess (normal) */
  REDEMPTION_ROULETTE_CORRECT: 8,

  /** Points for correct Redemption Roulette guess (when negative score) */
  REDEMPTION_ROULETTE_CORRECT_NEGATIVE: 16,

  /** Penalty for incorrect Redemption Roulette guess */
  REDEMPTION_ROULETTE_INCORRECT: -1,

  /** Points for correct Shield Gambit guess (normal) */
  SHIELD_GAMBIT_CORRECT: 5,

  /** Points for correct Shield Gambit guess (when negative score) */
  SHIELD_GAMBIT_CORRECT_NEGATIVE: 8,

  /** Points for each correct Traitor Trio member */
  TRAITOR_TRIO_PARTIAL: 3,

  /** Points for perfect Traitor Trio (all 3 correct) */
  TRAITOR_TRIO_PERFECT: 15,

  /** Points per member in perfect Traitor Trio (for achievement breakdown) */
  TRAITOR_TRIO_PERFECT_PER_MEMBER: 5,
} as const;

export const MULTIPLIERS = {
  /** Multiplier applied to weekly predictions when Double or Nothing is active */
  DOUBLE_OR_NOTHING: 2,

  /** Normal multiplier (no Double or Nothing) */
  NORMAL: 1,
} as const;

export const TIMING = {
  /** Debounce delay (ms) before saving game state to PocketBase */
  SAVE_DEBOUNCE_MS: 500,

  /** Duration (ms) of the sync animation pulse */
  SYNC_ANIMATION_MS: 1000,
} as const;

export const LIMITS = {
  /** Maximum number of weekly submission history entries to keep */
  HISTORY_LIMIT: 200,

  /** Maximum number of weekly score snapshots to keep */
  SCORE_HISTORY_LIMIT: 52,

  /** Number of recent score history entries to show by default */
  SCORE_HISTORY_DEFAULT_DISPLAY: 6,

  /** Number of recent history entries to show by default */
  HISTORY_DEFAULT_DISPLAY: 20,

  /** Number of recent weekly snapshots to show in player timeline */
  PLAYER_TIMELINE_DISPLAY: 6,
} as const;
