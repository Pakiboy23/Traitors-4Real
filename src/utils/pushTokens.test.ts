import { describe, expect, it } from "vitest";
import {
  buildPushTokenRecord,
  describeTimeUntilLock,
  isPushPlatform,
  shouldSendLockReminder,
} from "./pushTokens";

const NOW = Date.parse("2026-09-17T20:00:00.000Z");
const minutesFromNow = (m: number) => new Date(NOW + m * 60000).toISOString();

describe("isPushPlatform", () => {
  it("accepts the three supported platforms", () => {
    expect(isPushPlatform("ios")).toBe(true);
    expect(isPushPlatform("android")).toBe(true);
    expect(isPushPlatform("web")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isPushPlatform("windows")).toBe(false);
    expect(isPushPlatform(undefined)).toBe(false);
    expect(isPushPlatform(7)).toBe(false);
  });
});

describe("buildPushTokenRecord", () => {
  it("builds a complete record", () => {
    expect(
      buildPushTokenRecord({
        token: "abc123",
        platform: "ios",
        seasonId: "traitors-new-blood-s1",
        email: "Player@Example.com",
      })
    ).toEqual({
      token: "abc123",
      platform: "ios",
      season_id: "traitors-new-blood-s1",
      email: "player@example.com",
    });
  });

  it("refuses a blank token rather than storing a dead row", () => {
    // Registration can report success with an empty value when provisioning is
    // wrong; such a row could never receive a notification.
    expect(buildPushTokenRecord({ token: "   ", platform: "ios" })).toBeNull();
    expect(buildPushTokenRecord({ token: undefined, platform: "ios" })).toBeNull();
    expect(buildPushTokenRecord({ token: 42, platform: "ios" })).toBeNull();
  });

  it("refuses an unknown platform", () => {
    expect(buildPushTokenRecord({ token: "abc", platform: "blackberry" })).toBeNull();
  });

  it("trims the token and lowercases the email", () => {
    const record = buildPushTokenRecord({
      token: "  abc  ",
      platform: "android",
      email: "  MiXeD@Case.COM  ",
    });

    expect(record?.token).toBe("abc");
    expect(record?.email).toBe("mixed@case.com");
  });

  it("nulls optional context rather than storing empty strings", () => {
    const record = buildPushTokenRecord({
      token: "abc",
      platform: "web",
      seasonId: "   ",
      email: "",
    });

    expect(record).toEqual({ token: "abc", platform: "web", season_id: null, email: null });
  });
});

describe("shouldSendLockReminder", () => {
  it("sends inside the lead window", () => {
    expect(shouldSendLockReminder(minutesFromNow(45), NOW, 60)).toBe(true);
  });

  it("stays quiet while the lock is still far off", () => {
    expect(shouldSendLockReminder(minutesFromNow(180), NOW, 60)).toBe(false);
  });

  it("never fires after the lock has passed", () => {
    // A reminder arriving after the lock tells someone to act on something
    // already closed — worse than sending nothing.
    expect(shouldSendLockReminder(minutesFromNow(-1), NOW, 60)).toBe(false);
    expect(shouldSendLockReminder(new Date(NOW).toISOString(), NOW, 60)).toBe(false);
  });

  it("treats the window edge as inside it", () => {
    expect(shouldSendLockReminder(minutesFromNow(60), NOW, 60)).toBe(true);
  });

  it("ignores missing or unparseable lock times", () => {
    expect(shouldSendLockReminder(null, NOW, 60)).toBe(false);
    expect(shouldSendLockReminder(undefined, NOW, 60)).toBe(false);
    expect(shouldSendLockReminder("   ", NOW, 60)).toBe(false);
    expect(shouldSendLockReminder("not-a-date", NOW, 60)).toBe(false);
  });
});

describe("describeTimeUntilLock", () => {
  it("counts down in minutes under the hour", () => {
    expect(describeTimeUntilLock(minutesFromNow(45), NOW)).toBe("in 45 minutes");
    expect(describeTimeUntilLock(minutesFromNow(1), NOW)).toBe("in 1 minute");
  });

  it("switches to hours at and beyond sixty minutes", () => {
    expect(describeTimeUntilLock(minutesFromNow(60), NOW)).toBe("in 1 hour");
    expect(describeTimeUntilLock(minutesFromNow(180), NOW)).toBe("in 3 hours");
  });

  it("returns null once the lock has passed", () => {
    expect(describeTimeUntilLock(minutesFromNow(-5), NOW)).toBeNull();
    expect(describeTimeUntilLock("not-a-date", NOW)).toBeNull();
  });
});
