/**
 * Pure helpers for device push registration.
 *
 * Kept separate from the Capacitor glue in src/native/push.ts so the parts that
 * decide *what* gets stored are testable without a device.
 */

export type PushPlatform = "ios" | "android" | "web";

export interface PushTokenRecord {
  token: string;
  platform: PushPlatform;
  season_id: string | null;
  email: string | null;
}

const PLATFORMS: PushPlatform[] = ["ios", "android", "web"];

export const isPushPlatform = (value: unknown): value is PushPlatform =>
  typeof value === "string" && (PLATFORMS as string[]).includes(value);

/**
 * Builds the row stored for a device, or null when the input cannot produce a
 * usable one.
 *
 * A blank or non-string token is the common failure: the registration callback
 * fires with an empty value when provisioning is wrong, and storing it would
 * leave a row that can never receive anything.
 */
export const buildPushTokenRecord = (input: {
  token?: unknown;
  platform?: unknown;
  seasonId?: string | null;
  email?: string | null;
}): PushTokenRecord | null => {
  const token = typeof input.token === "string" ? input.token.trim() : "";
  if (!token) return null;
  if (!isPushPlatform(input.platform)) return null;

  const email =
    typeof input.email === "string" && input.email.trim()
      ? input.email.trim().toLowerCase()
      : null;

  const seasonId =
    typeof input.seasonId === "string" && input.seasonId.trim()
      ? input.seasonId.trim()
      : null;

  return { token, platform: input.platform, season_id: seasonId, email };
};

/**
 * Whether a reminder is still worth sending.
 *
 * A lock reminder that arrives after the lock is worse than none at all — it
 * tells someone to act on something already closed. `leadMinutes` is how far
 * ahead the reminder is meant to land.
 */
export const shouldSendLockReminder = (
  lockAt: string | null | undefined,
  now: number,
  leadMinutes: number
): boolean => {
  if (typeof lockAt !== "string" || !lockAt.trim()) return false;
  const lockMs = Date.parse(lockAt);
  if (!Number.isFinite(lockMs)) return false;
  if (lockMs <= now) return false;

  const minutesRemaining = (lockMs - now) / 60000;
  return minutesRemaining <= leadMinutes;
};

/** Human-readable countdown for the notification body, e.g. "in 45 minutes". */
export const describeTimeUntilLock = (
  lockAt: string,
  now: number
): string | null => {
  const lockMs = Date.parse(lockAt);
  if (!Number.isFinite(lockMs) || lockMs <= now) return null;

  const minutes = Math.round((lockMs - now) / 60000);
  if (minutes < 60) {
    return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const hours = Math.round(minutes / 60);
  return `in ${hours} hour${hours === 1 ? "" : "s"}`;
};
