
export interface CastMemberStatus {
  isWinner: boolean;
  isFirstOut: boolean;
  isTraitor: boolean;
  isEliminated: boolean;
  portraitUrl?: string | null;
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

export type League = "main" | "jr";
export type UiVariant = "classic" | "premium";
export type SeasonStatus = "draft" | "live" | "finalized" | "archived";
export type SubmissionStatus = "new" | "merged" | "skipped_late" | "skipped_stale";

export const COUNCIL_LABELS = {
  weekly: "Weekly Council",
  jr: "Jr. Council",
} as const;

export interface ShowBranding {
  logoUrl?: string | null;
  wordmark?: string;
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
  jrLeagueEnabled: boolean;
  finaleEnabled: boolean;
  scoreAdjustmentsEnabled: boolean;
  seasonArchivingEnabled: boolean;
}

export interface ShowConfig {
  slug: string;
  showName: string;
  shortName: string;
  branding: ShowBranding;
  terminology: ShowTerminology;
  defaultUiVariant: UiVariant;
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

export const CAST_NAMES = [
  "Candiace Dillard Bassett (RHOP)", "Caroline Stanbury (RHODubai)", "Dorinda Medley (RHONY)", 
  "Lisa Rinna (RHOBH)", "Porsha Williams (RHOA)", "Maura Higgins (Love Island UK)", 
  "Rob Rausch (Love Island USA)", "Rob Cesternino (Survivor)", "Yam Yam Arocho (Survivor)", 
  "Natalie Anderson (Survivor/Amazing Race)", "Ian Terry (Big Brother)", "Tiffany Mitchell (Big Brother)", 
  "Colton Underwood (The Bachelor)", "Johnny Weir (Olympian)", "Tara Lipinski (Olympian)", 
  "Mark Ballas (DWTS)", "Kristen Kish (Top Chef)", "Eric Nam (Singer/Host)", 
  "Monet X Change (Drag Race)", "Ron Funches (Comedian)", "Michael Rapaport (Actor)", 
  "Stephen Colletti (One Tree Hill)", "Donna Kelce (Travis' Mom)"
].sort();
