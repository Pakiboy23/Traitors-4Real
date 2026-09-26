import { NEW_BLOOD_CAST_NAMES } from "./src/config/newBloodCast";

export interface CastMemberStatus {
  isWinner: boolean;
  isFirstOut: boolean;
  isTraitor: boolean;
  isEliminated: boolean;
  portraitUrl?: string | null;
  /**
   * Profile details shown when picking. A civilian cast carries no public
   * recognition, so these are what let a player tell one name from another.
   * All optional: a season may be published before its cast is fleshed out.
   */
  age?: number | null;
  occupation?: string | null;
  hometown?: string | null;
}

export interface DraftPick {
  member: string;
  rank: number;
  role: 'Faithful' | 'Traitor';
}

export interface WeeklyPredictions {
  weekId?: string;
  nextBanished: string;
  nextMurdered: string;
  bonusGames?: BonusGamePredictions;
  finalePredictions?: FinalePredictions;
}

export interface WeeklyResults {
  weekId?: string;
  nextBanished?: string;
  nextMurdered?: string;
  bonusGames?: BonusGameResults;
  finaleResults?: FinaleResults;
}

export interface FinaleConfig {
  enabled: boolean;
  label: string;
  lockAt: string;
}

export interface FinalePredictions {
  finalWinner: string;
  lastFaithfulStanding: string;
  lastTraitorStanding: string;
  finalPotEstimate: number | null;
}

export interface FinaleResults {
  finalWinner?: string;
  lastFaithfulStanding?: string;
  lastTraitorStanding?: string;
  finalPotValue?: number | null;
}

export interface BonusGamePredictions {
  redemptionRoulette?: string;
  doubleOrNothing?: boolean;
  shieldGambit?: string;
  traitorTrio?: string[];
}

export interface BonusGameResults {
  redemptionRoulette?: string;
  shieldGambit?: string;
  traitorTrio?: string[];
}

export interface BonusPointBreakdownEntry {
  label: string;
  result: "correct" | "incorrect" | "partial";
  points: number;
}

export interface WeeklyScoreSnapshot {
  id: string;
  label: string;
  createdAt: string;
  weeklyResults?: WeeklyResults;
  totals: Record<string, number>;
}

/**
 * Admin copy and publish flag for one week's public recap.
 * Stored on the season snapshot next to weeklyResults. Unpublished weeks
 * stay off the public page.
 */
export interface WeeklyRecapRecord {
  weekId: string;
  intro: string;
  published: boolean;
  publishedAt?: string | null;
}

export type League = "main" | "jr";
export type SeasonStatus = "draft" | "live" | "finalized" | "archived";
export type SubmissionStatus = "new" | "merged" | "skipped_late" | "skipped_stale";

export const COUNCIL_LABELS = {
  weekly: "Weekly Council",
  jr: "Jr. Council",
} as const;

export interface ShowBranding {
  headerKicker?: string;
  appTitle?: string;
  footerCopy?: string;
}

export interface ShowTerminology {
  weeklyCouncilLabel: string;
  jrCouncilLabel: string;
  draftLabel: string;
  leaderboardLabel: string;
  adminLabel: string;
  finaleLabelDefault: string;
}

export interface ShowFeatureToggles {
  draftEnabled: boolean;
}

export interface ShowConfig {
  slug: string;
  showName: string;
  shortName: string;
  /**
   * What this particular group of players calls itself.
   *
   * Separate from showName on purpose: the storefront name and the league name
   * answer to different audiences, and only one of them is public.
   */
  leagueName: string;
  branding: ShowBranding;
  terminology: ShowTerminology;
  featureToggles: ShowFeatureToggles;
  castNames: string[];
}

export interface SeasonConfig {
  seasonId: string;
  label: string;
  status: SeasonStatus;
  timezone: string;
  lockSchedule: {
    draftLockAt?: string | null;
    weeklyLockAt?: string | null;
    finaleLockAt?: string | null;
  };
  activeWeekId?: string;
  finaleConfig?: FinaleConfig;
  rulePackId?: string;
}

export interface RulePackPoints {
  DRAFT_WINNER: number;
  PRED_WINNER: number;
  PRED_FIRST_OUT: number;
  TRAITOR_BONUS: number;
  PROPHECY_REVERSED_PENALTY: number;
  WEEKLY_CORRECT_BASE: number;
  WEEKLY_INCORRECT_BASE: number;
  FINALE_WEEKLY_CORRECT: number;
  FINALE_WEEKLY_INCORRECT: number;
  FINALE_FINAL_WINNER: number;
  FINALE_LAST_FAITHFUL_STANDING: number;
  FINALE_LAST_TRAITOR_STANDING: number;
  REDEMPTION_ROULETTE_CORRECT: number;
  REDEMPTION_ROULETTE_CORRECT_NEGATIVE: number;
  REDEMPTION_ROULETTE_INCORRECT: number;
  SHIELD_GAMBIT_CORRECT: number;
  SHIELD_GAMBIT_CORRECT_NEGATIVE: number;
  TRAITOR_TRIO_PARTIAL: number;
  TRAITOR_TRIO_PERFECT: number;
  TRAITOR_TRIO_PERFECT_PER_MEMBER: number;
}

export interface RulePack {
  id: string;
  name: string;
  description?: string;
  supportedEvents: string[];
  points: RulePackPoints;
  tieBreakStrategy: "final_pot_distance" | "none";
  bonusModules: {
    redemptionRoulette: boolean;
    shieldGambit: boolean;
    traitorTrio: boolean;
    doubleOrNothing: boolean;
    finaleGauntlet: boolean;
  };
}

export interface ScoreAdjustment {
  id: string;
  seasonId: string;
  playerId: string;
  weekId?: string;
  reason: string;
  points: number;
  createdBy: string;
  createdAt: string;
}

export interface WeeklySubmissionHistoryEntry {
  id: string;
  name: string;
  email: string;
  weekId?: string;
  weeklyBanished?: string;
  weeklyMurdered?: string;
  bonusGames?: BonusGamePredictions;
  finalePredictions?: FinalePredictions;
  bonusPoints?: number;
  bonusPointBreakdown?: BonusPointBreakdownEntry[];
  league?: League;
  created?: string;
  mergedAt: string;
}

export interface PlayerEntry {
  id: string;
  name: string;
  email: string;
  league?: League;
  picks: DraftPick[];
  predFirstOut: string;
  predWinner: string;
  predTraitors: string[];
  totalScore?: number;
  portraitUrl?: string;
  weeklyPredictions?: WeeklyPredictions;
}

export interface GameState {
  seasonId?: string;
  rulePackId?: string;
  activeWeekId?: string;
  players: PlayerEntry[];
  castStatus: Record<string, CastMemberStatus>;
  weeklyResults?: WeeklyResults;
  finaleConfig?: FinaleConfig;
  showConfig?: ShowConfig;
  seasonConfig?: SeasonConfig;
  scoreAdjustments?: ScoreAdjustment[];
  weeklySubmissionHistory?: WeeklySubmissionHistoryEntry[];
  weeklyScoreHistory?: WeeklyScoreSnapshot[];
  weeklyRecaps?: WeeklyRecapRecord[];
}

export type SeasonState = GameState;

export const normalizeWeekId = (value?: string | null): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const inferActiveWeekId = (input?: {
  activeWeekId?: string;
  weeklyScoreHistory?: WeeklyScoreSnapshot[];
} | null): string => {
  const explicit = normalizeWeekId(input?.activeWeekId);
  if (explicit) return explicit;
  const historyLength = Array.isArray(input?.weeklyScoreHistory)
    ? input.weeklyScoreHistory.length
    : 0;
  return `week-${historyLength + 1}`;
};

/**
 * The running week is `state.activeWeekId` — that is what Admin writes when
 * it archives a week. `seasons.active_week_id` and `seasonConfig.activeWeekId`
 * are copies and have drifted. When they disagree, the snapshot wins. A
 * missing snapshot week falls back to the season row, then to history length.
 */
export const resolveActiveWeekId = (input?: {
  activeWeekId?: string | null;
  seasonConfig?: { activeWeekId?: string | null } | null;
  weeklyScoreHistory?: WeeklyScoreSnapshot[] | null;
} | null): string => {
  const fromState = normalizeWeekId(input?.activeWeekId);
  if (fromState) return fromState;
  const fromConfig = normalizeWeekId(input?.seasonConfig?.activeWeekId);
  if (fromConfig) return fromConfig;
  return inferActiveWeekId({
    weeklyScoreHistory: input?.weeklyScoreHistory ?? undefined,
  });
};

/**
 * Fallback roster, used only when no season has been loaded.
 *
 * Every real season stores its own cast, so this is what the app shows before
 * the first sync — on a cold start, offline, or in a fresh install. It used to
 * hold the previous celebrity season, which meant an offline launch displayed
 * twenty-three people who are not in the show any more, and reported them as
 * "suspects in play". It tracks the current cast now.
 */
export const CAST_NAMES = [...NEW_BLOOD_CAST_NAMES];
