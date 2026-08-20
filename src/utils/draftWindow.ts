import type { GameState } from "../../types";

/**
 * Why the draft is open or closed.
 *
 * Surfaced to the UI so the form can explain itself rather than showing a bare
 * disabled button — "the draft locked at 8pm" is actionable, "Draft Closed" is
 * not.
 */
export type DraftWindowReason =
  | "open"
  | "forced-closed"
  | "season-locked"
  | "season-not-live"
  | "disabled-by-admin"
  | "past-lock-time";

export interface DraftWindow {
  isOpen: boolean;
  reason: DraftWindowReason;
  /** Set when the window closes at a scheduled time, for countdown display. */
  lockAt: string | null;
}

export interface ResolveDraftWindowOptions {
  /**
   * Emergency build-time override. When true the draft is closed regardless of
   * season state. Normally unset — the season record is the authority.
   */
  forceClosed?: boolean;
  /** Injected for deterministic tests. */
  now?: number;
}

/**
 * Reads the build-time override.
 *
 * This used to be the primary gate, which meant opening the draft on premiere
 * night required editing an environment variable and waiting for a rebuild.
 * It is now an override only: unset means "defer to the season record", so the
 * draft can be opened and closed from the admin panel at runtime.
 */
export const readForceClosedFromEnv = (): boolean =>
  String(process.env.NEXT_PUBLIC_DRAFT_CLOSED ?? "").trim().toLowerCase() === "true";

const parseLockAt = (value?: string | null): number | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Decides whether the draft accepts entries.
 *
 * Checks run in order of authority: an explicit override beats season
 * lifecycle, which beats the admin toggle, which beats the schedule. The first
 * rule that closes the draft is the one reported, so the message a player sees
 * names the actual cause.
 */
export const resolveDraftWindow = (
  gameState: Pick<GameState, "seasonConfig" | "showConfig">,
  options: ResolveDraftWindowOptions = {}
): DraftWindow => {
  const { forceClosed = false, now = Date.now() } = options;

  const seasonConfig = gameState.seasonConfig;
  const lockAtRaw = seasonConfig?.lockSchedule?.draftLockAt ?? null;
  const lockAt = parseLockAt(lockAtRaw);
  const lockAtIso = lockAt === null ? null : new Date(lockAt).toISOString();

  if (forceClosed) {
    return { isOpen: false, reason: "forced-closed", lockAt: lockAtIso };
  }

  const status = seasonConfig?.status;

  if (status === "finalized" || status === "archived") {
    return { isOpen: false, reason: "season-locked", lockAt: lockAtIso };
  }

  // A season still being set up must not take entries. Legacy state predates
  // seasonConfig entirely, so its absence is not treated as "not live" — those
  // deployments stay governed by the admin toggle alone.
  if (seasonConfig && status !== "live") {
    return { isOpen: false, reason: "season-not-live", lockAt: lockAtIso };
  }

  if (gameState.showConfig?.featureToggles?.draftEnabled === false) {
    return { isOpen: false, reason: "disabled-by-admin", lockAt: lockAtIso };
  }

  if (lockAt !== null && now >= lockAt) {
    return { isOpen: false, reason: "past-lock-time", lockAt: lockAtIso };
  }

  return { isOpen: true, reason: "open", lockAt: lockAtIso };
};

/** Player-facing explanation for a closed draft. */
export const describeDraftWindow = (
  window: DraftWindow,
  draftLabel = "Draft"
): string => {
  switch (window.reason) {
    case "open":
      return `${draftLabel} is open.`;
    case "past-lock-time":
      return `${draftLabel} locked when the season began. Weekly Council is still open.`;
    case "season-locked":
      return `This season is complete. ${draftLabel} entries are closed.`;
    case "season-not-live":
      return `${draftLabel} opens when the season goes live.`;
    case "disabled-by-admin":
    case "forced-closed":
      return `${draftLabel} is currently closed.`;
  }
};
