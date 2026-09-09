import type { FinaleConfig, SeasonConfig } from "../../types";
import { describeDraftWindow, type DraftWindow } from "./draftWindow";

export type HomeCountdownKind = "finale" | "draft" | "weekly" | "none";

/**
 * What the Home hero's lock bar counts down to.
 *
 * The bar used to read `finaleConfig.lockAt` unconditionally. That field is
 * only meaningful once the finale is enabled; the rest of the season it holds
 * whatever the admin panel defaulted it to when the season was created —
 * creation time plus 24 hours — so a day after set-up the Home screen told
 * every player "Picks are locked." while the draft was open. It shipped that
 * way to the App Store.
 */
export interface HomeCountdown {
  kind: HomeCountdownKind;
  /** Heading above the timer. */
  label: string;
  /** ISO timestamp the timer counts to; null when nothing is scheduled. */
  targetAt: string | null;
  /** Shown instead of a timer when there is no target or it has passed. */
  statusText: string;
}

export interface ResolveHomeCountdownInput {
  finaleConfig?: Pick<FinaleConfig, "enabled" | "lockAt"> | null;
  finaleLabel: string;
  draftWindow: DraftWindow;
  draftLabel?: string;
  lockSchedule?: SeasonConfig["lockSchedule"] | null;
  /** Injected for deterministic tests. */
  now?: number;
}

const futureIso = (value: string | null | undefined, now: number): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= now) return null;
  return new Date(parsed).toISOString();
};

/**
 * Authority order mirrors the season itself: the finale, once enabled, owns the
 * lock bar; otherwise the draft lock while the draft is open; otherwise a
 * scheduled weekly lock. With nothing scheduled the bar states the draft's
 * status in words rather than counting down to an invented time.
 */
export const resolveHomeCountdown = ({
  finaleConfig,
  finaleLabel,
  draftWindow,
  draftLabel = "Draft",
  lockSchedule,
  now = Date.now(),
}: ResolveHomeCountdownInput): HomeCountdown => {
  if (finaleConfig?.enabled) {
    return {
      kind: "finale",
      label: finaleLabel,
      targetAt: futureIso(finaleConfig.lockAt, now),
      statusText: "Picks are locked.",
    };
  }

  const draftLockAt = futureIso(draftWindow.lockAt, now);
  if (draftWindow.isOpen && draftLockAt) {
    return {
      kind: "draft",
      label: `${draftLabel} Locks In`,
      targetAt: draftLockAt,
      statusText: `${draftLabel} is locked.`,
    };
  }

  const weeklyLockAt = futureIso(lockSchedule?.weeklyLockAt, now);
  if (weeklyLockAt) {
    return {
      kind: "weekly",
      label: "Picks Lock In",
      targetAt: weeklyLockAt,
      statusText: "Picks are locked.",
    };
  }

  return {
    kind: "none",
    label: `${draftLabel} Status`,
    targetAt: null,
    statusText: draftWindow.isOpen
      ? `${draftLabel} is open. No lock time is scheduled yet.`
      : describeDraftWindow(draftWindow, draftLabel),
  };
};
