import type { DraftPick } from "../../types";

/**
 * Saved progress for a draft entry in flight.
 *
 * A draft is roughly twenty-six decisions. Holding all of that in component
 * state meant a refresh, a phone call, or an accidental back gesture wiped it,
 * and starting a twenty-six decision form again is where people give up.
 */

export const DRAFT_PROGRESS_VERSION = 1;
export const DRAFT_PROGRESS_KEY = "traitors_draft_progress_v1";

/** Progress older than this is discarded rather than resurrected. */
export const DRAFT_PROGRESS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface DraftProgress {
  version: number;
  seasonId: string | null;
  savedAt: number;
  step: number;
  playerName: string;
  playerEmail: string;
  picks: DraftPick[];
  sealedPicks: boolean[];
  predFirstOut: string;
  predWinner: string;
  traitors: string[];
}

export type DraftProgressInput = Omit<DraftProgress, "version" | "savedAt">;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const readPick = (value: unknown): DraftPick => {
  const source = isRecord(value) ? value : {};
  const rank = Number(source.rank);
  return {
    member: readString(source.member),
    rank: Number.isFinite(rank) && rank > 0 ? rank : 1,
    role: source.role === "Traitor" ? "Traitor" : "Faithful",
  };
};

export const createDraftProgress = (input: DraftProgressInput): DraftProgress => ({
  ...input,
  version: DRAFT_PROGRESS_VERSION,
  savedAt: Date.now(),
});

/** True when the entry has nothing worth restoring, so we don't offer to. */
export const isDraftProgressEmpty = (progress: DraftProgressInput): boolean =>
  !progress.playerName.trim() &&
  !progress.playerEmail.trim() &&
  !progress.predFirstOut.trim() &&
  !progress.predWinner.trim() &&
  progress.traitors.every((name) => !name.trim()) &&
  progress.picks.every((pick) => !pick.member.trim());

/**
 * Parses stored progress, returning null for anything unusable.
 *
 * Storage is treated as hostile input: it survives across deploys, can be hand
 * edited, and can hold a shape from an older build. A corrupt blob must not be
 * able to break the form it is meant to protect.
 */
export const parseDraftProgress = (
  raw: string | null,
  options: { seasonId?: string | null; now?: number } = {}
): DraftProgress | null => {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.version !== DRAFT_PROGRESS_VERSION) return null;

  const savedAt = Number(parsed.savedAt);
  if (!Number.isFinite(savedAt)) return null;

  const now = options.now ?? Date.now();
  if (now - savedAt > DRAFT_PROGRESS_MAX_AGE_MS) return null;

  // Progress belongs to the season it was started in. Restoring last season's
  // half-finished entry into a new season would fill the form with people who
  // are not in the cast.
  const seasonId = typeof parsed.seasonId === "string" ? parsed.seasonId : null;
  const expectedSeasonId = options.seasonId ?? null;
  if (expectedSeasonId !== null && seasonId !== null && seasonId !== expectedSeasonId) {
    return null;
  }

  const picks = Array.isArray(parsed.picks) ? parsed.picks.map(readPick) : [];
  const sealedPicks = Array.isArray(parsed.sealedPicks)
    ? parsed.sealedPicks.map(Boolean)
    : [];
  const traitors = Array.isArray(parsed.traitors)
    ? parsed.traitors.map(readString)
    : [];

  const step = Number(parsed.step);

  return {
    version: DRAFT_PROGRESS_VERSION,
    seasonId,
    savedAt,
    step: Number.isFinite(step) && step >= 0 ? Math.floor(step) : 0,
    playerName: readString(parsed.playerName),
    playerEmail: readString(parsed.playerEmail),
    picks,
    sealedPicks,
    predFirstOut: readString(parsed.predFirstOut),
    predWinner: readString(parsed.predWinner),
    traitors,
  };
};

/**
 * Fits restored arrays to the current draft size.
 *
 * The number of slots is a constant that could change between seasons, and a
 * saved entry sized for a different one must not leave the form short of rows
 * or holding extras it cannot render.
 */
export const fitToDraftSize = <T,>(
  values: T[],
  size: number,
  fill: () => T
): T[] => {
  const next = values.slice(0, size);
  while (next.length < size) next.push(fill());
  return next;
};

/** "just now", "12 minutes ago", "3 days ago" — for the restore prompt. */
export const describeSavedAt = (savedAt: number, now: number): string => {
  const elapsed = Math.max(0, now - savedAt);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};
