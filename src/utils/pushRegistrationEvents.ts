/**
 * Pure helpers for push-registration diagnostics.
 *
 * The Capacitor glue in src/native/push.ts decides *when* to record a step.
 * This module decides *what* gets stored, so the redaction and gate rules
 * can be tested without a device.
 */

import type { Json } from "../types/database";
import { isPushPlatform, type PushPlatform } from "./pushTokens";

export const PUSH_REGISTRATION_EVENT_TYPES = [
  "native_gate",
  "permission_check",
  "permission_denied",
  "register_invoked",
  "registration_success",
  "registration_error",
  "store_error",
] as const;

export type PushRegistrationEventType = (typeof PUSH_REGISTRATION_EVENT_TYPES)[number];

export interface PushRegistrationEventRecord {
  event_type: PushRegistrationEventType;
  platform: PushPlatform;
  detail: Json;
  season_id: string | null;
  app_version: string | null;
  app_build: string | null;
}

const DETAIL_MAX = 500;

export const isPushRegistrationEventType = (
  value: unknown,
): value is PushRegistrationEventType =>
  typeof value === "string" &&
  (PUSH_REGISTRATION_EVENT_TYPES as readonly string[]).includes(value);

/** Last 8 characters only — enough to prove a token arrived, not enough to replay it. */
export const redactPushToken = (
  token: unknown,
): { tokenTail: string | null; tokenLength: number } => {
  const value = typeof token === "string" ? token.trim() : "";
  if (!value) return { tokenTail: null, tokenLength: 0 };
  return { tokenTail: value.slice(-8), tokenLength: value.length };
};

export const normalizePageProtocol = (protocol: unknown): string => {
  if (typeof protocol !== "string") return "";
  return protocol.replace(/:$/, "").trim().toLowerCase();
};

/**
 * The public website must not write a row on every visit. Persist a native_gate
 * event only when the page looks like a Capacitor shell that failed the
 * native-platform check — the TestFlight mis-detect case.
 */
export const shouldRecordNativeGate = (input: {
  isNative: boolean;
  protocol?: unknown;
  pluginAvailable?: boolean;
}): boolean => {
  if (input.isNative) return false;
  const protocol = normalizePageProtocol(input.protocol);
  if (protocol === "capacitor" || protocol === "ionic") return true;
  return input.pluginAvailable === true;
};

/** Duplicate token inserts are the normal relaunch case; everything else is a fault. */
export const isStoreErrorWorthRecording = (code: unknown): boolean => code !== "23505";

export const describeUnknownError = (error: unknown): string => {
  if (typeof error === "string") return error.slice(0, DETAIL_MAX);
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.slice(0, DETAIL_MAX);
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error.slice(0, DETAIL_MAX);
    }
    if (typeof record.code === "string" && record.code.trim()) {
      return record.code.slice(0, DETAIL_MAX);
    }
    try {
      return JSON.stringify(error).slice(0, DETAIL_MAX);
    } catch {
      return "unserializable_error";
    }
  }
  return "unknown_error";
};

const nullableTrimmed = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const isJsonScalar = (value: unknown): value is string | number | boolean | null =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

/**
 * Drop keys that look like a raw APNs token, and replace hex blobs long enough
 * to be one with their tail. Defensive: callers should already redact, but a
 * listener payload can still carry `value`.
 */
export const sanitizePushDebugDetail = (detail: unknown): Json => {
  if (typeof detail === "string") {
    const trimmed = detail.trim();
    return trimmed ? { message: trimmed.slice(0, DETAIL_MAX) } : {};
  }
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return {};

  const out: { [key: string]: Json | undefined } = {};
  for (const [key, value] of Object.entries(detail as Record<string, unknown>)) {
    if (key === "token" || key === "value") continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 32 && /^[0-9a-fA-F]+$/.test(trimmed)) {
        const redacted = redactPushToken(trimmed);
        out.tokenTail = redacted.tokenTail;
        out.tokenLength = redacted.tokenLength;
        continue;
      }
      out[key] = trimmed.slice(0, DETAIL_MAX);
      continue;
    }

    if (isJsonScalar(value)) {
      out[key] = value;
    }
  }
  return out;
};

export const buildPushRegistrationEvent = (input: {
  eventType?: unknown;
  platform?: unknown;
  detail?: unknown;
  seasonId?: string | null;
  appVersion?: string | null;
  appBuild?: string | null;
}): PushRegistrationEventRecord | null => {
  if (!isPushRegistrationEventType(input.eventType)) return null;
  if (!isPushPlatform(input.platform)) return null;

  return {
    event_type: input.eventType,
    platform: input.platform,
    detail: sanitizePushDebugDetail(input.detail),
    season_id: nullableTrimmed(input.seasonId),
    app_version: nullableTrimmed(input.appVersion),
    app_build: nullableTrimmed(input.appBuild),
  };
};
