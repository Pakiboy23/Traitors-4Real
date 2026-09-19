import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPushRegistrationEvent,
  describeUnknownError,
  isStoreErrorWorthRecording,
  normalizePageProtocol,
  redactPushToken,
  sanitizePushDebugDetail,
  shouldRecordNativeGate,
} from "./pushRegistrationEvents";

const HEX_TOKEN = "a".repeat(64);

describe("redactPushToken", () => {
  it("keeps only the last eight characters", () => {
    expect(redactPushToken(HEX_TOKEN)).toEqual({
      tokenTail: "aaaaaaaa",
      tokenLength: 64,
    });
  });

  it("returns a null tail for a blank or non-string token", () => {
    expect(redactPushToken("   ")).toEqual({ tokenTail: null, tokenLength: 0 });
    expect(redactPushToken(undefined)).toEqual({ tokenTail: null, tokenLength: 0 });
    expect(redactPushToken(42)).toEqual({ tokenTail: null, tokenLength: 0 });
  });
});

describe("sanitizePushDebugDetail", () => {
  it("drops raw token keys and hex blobs long enough to be an APNs token", () => {
    const detail = sanitizePushDebugDetail({
      token: HEX_TOKEN,
      value: HEX_TOKEN,
      receive: "granted",
      leftover: HEX_TOKEN,
    });

    expect(detail).toEqual({
      receive: "granted",
      tokenTail: "aaaaaaaa",
      tokenLength: 64,
    });
    expect(JSON.stringify(detail)).not.toContain(HEX_TOKEN);
  });

  it("wraps a string detail as a message", () => {
    expect(sanitizePushDebugDetail("  boom  ")).toEqual({ message: "boom" });
  });
});

describe("shouldRecordNativeGate", () => {
  it("never records when Capacitor already reports native", () => {
    expect(
      shouldRecordNativeGate({
        isNative: true,
        protocol: "capacitor:",
        pluginAvailable: true,
      }),
    ).toBe(false);
  });

  it("records a Capacitor or Ionic shell that failed the native check", () => {
    expect(shouldRecordNativeGate({ isNative: false, protocol: "capacitor:" })).toBe(true);
    expect(shouldRecordNativeGate({ isNative: false, protocol: "ionic" })).toBe(true);
  });

  it("records when the push plugin is still present on a non-native report", () => {
    expect(shouldRecordNativeGate({ isNative: false, pluginAvailable: true })).toBe(true);
  });

  it("does not record ordinary https website traffic", () => {
    expect(
      shouldRecordNativeGate({
        isNative: false,
        protocol: "https:",
        pluginAvailable: false,
      }),
    ).toBe(false);
  });
});

describe("normalizePageProtocol", () => {
  it("strips the trailing colon and lowercases", () => {
    expect(normalizePageProtocol("Capacitor:")).toBe("capacitor");
  });
});

describe("isStoreErrorWorthRecording", () => {
  it("ignores the duplicate-token unique violation", () => {
    expect(isStoreErrorWorthRecording("23505")).toBe(false);
  });

  it("records any other code, including a missing one", () => {
    expect(isStoreErrorWorthRecording("42501")).toBe(true);
    expect(isStoreErrorWorthRecording(undefined)).toBe(true);
  });
});

describe("describeUnknownError", () => {
  it("prefers message, then Capacitor's error field", () => {
    expect(describeUnknownError({ message: "no entitlements" })).toBe("no entitlements");
    expect(describeUnknownError({ error: "registration failed" })).toBe("registration failed");
  });

  it("falls back to JSON and handles primitives", () => {
    expect(describeUnknownError("plain")).toBe("plain");
    expect(describeUnknownError({ code: "PGRST301" })).toBe("PGRST301");
    expect(describeUnknownError(undefined)).toBe("unknown_error");
  });
});

describe("buildPushRegistrationEvent", () => {
  it("builds a complete record and nulls empty optional strings", () => {
    expect(
      buildPushRegistrationEvent({
        eventType: "registration_success",
        platform: "ios",
        detail: { receive: "granted", ...redactPushToken(HEX_TOKEN) },
        seasonId: "traitors-new-blood-s1",
        appVersion: "  2.0.1  ",
        appBuild: "",
      }),
    ).toEqual({
      event_type: "registration_success",
      platform: "ios",
      detail: { receive: "granted", tokenTail: "aaaaaaaa", tokenLength: 64 },
      season_id: "traitors-new-blood-s1",
      app_version: "2.0.1",
      app_build: null,
    });
  });

  it("refuses an unknown event type or platform", () => {
    expect(
      buildPushRegistrationEvent({ eventType: "explode", platform: "ios" }),
    ).toBeNull();
    expect(
      buildPushRegistrationEvent({
        eventType: "native_gate",
        platform: "blackberry",
      }),
    ).toBeNull();
  });
});

describe("push_registration_events migration posture", () => {
  const sql = readFileSync(
    path.resolve(__dirname, "../../supabase/0003_push_registration_events.sql"),
    "utf8",
  );

  it("creates the debug table with RLS matching push_tokens", () => {
    expect(sql).toContain("create table if not exists public.push_registration_events");
    expect(sql).toContain("alter table public.push_registration_events enable row level security");
    expect(sql).toMatch(/for insert\s+to anon, authenticated/);
    expect(sql).toContain("public.is_traitors_admin()");
    expect(sql).toMatch(/for all\s+to authenticated/);
  });

  it("does not grant a public SELECT policy", () => {
    expect(sql).not.toMatch(/for select\s+to anon/);
    expect(sql).toContain("Deliberately no public select");
  });
});
