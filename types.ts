
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
  nextBanished: string;
  nextMurdered: string;
  bonusGames?: BonusGamePredictions;
}

export interface WeeklyResults {
  nextBanished?: string;
  nextMurdered?: string;
  bonusGames?: BonusGameResults;
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

export const COUNCIL_LABELS = {
  weekly: "Weekly Council",
  jr: "Jr. Council",
} as const;

export interface WeeklySubmissionHistoryEntry {
  id: string;
  name: string;
  email: string;
  weeklyBanished?: string;
  weeklyMurdered?: string;
  bonusGames?: BonusGamePredictions;
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
  players: PlayerEntry[];
  castStatus: Record<string, CastMemberStatus>;
  weeklyResults?: WeeklyResults;
  weeklySubmissionHistory?: WeeklySubmissionHistoryEntry[];
  weeklyScoreHistory?: WeeklyScoreSnapshot[];
}

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
