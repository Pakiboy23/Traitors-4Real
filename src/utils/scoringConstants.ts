export const MULTIPLIERS = {
  /** Multiplier applied to weekly predictions when Double or Nothing is active */
  DOUBLE_OR_NOTHING: 2,

  /** Normal multiplier (no Double or Nothing) */
  NORMAL: 1,
} as const;

export const TIMING = {
  /** Debounce delay (ms) before saving game state to Supabase */
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
} as const;
