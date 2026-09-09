import { describe, expect, it } from "vitest";
import type { DraftWindow } from "./draftWindow";
import { resolveHomeCountdown } from "./homeCountdown";

const NOW = Date.parse("2026-09-09T14:00:00.000Z");
const PREMIERE = "2026-09-18T00:00:00.000Z";
const YESTERDAY = "2026-09-08T20:49:07.347Z";

const open = (lockAt: string | null = PREMIERE): DraftWindow => ({
  isOpen: true,
  reason: "open",
  lockAt,
});

const closed = (
  reason: Exclude<DraftWindow["reason"], "open">,
  lockAt: string | null = PREMIERE
): DraftWindow => ({ isOpen: false, reason, lockAt });

const resolve = (
  overrides: Partial<Parameters<typeof resolveHomeCountdown>[0]> = {}
) =>
  resolveHomeCountdown({
    finaleLabel: "Finale Gauntlet",
    draftWindow: open(),
    now: NOW,
    ...overrides,
  });

describe("resolveHomeCountdown", () => {
  it("counts down to the draft lock while the draft is open", () => {
    expect(resolve()).toEqual({
      kind: "draft",
      label: "Draft Locks In",
      targetAt: PREMIERE,
      statusText: "Draft is locked.",
    });
  });

  it("ignores a stale finale lock while the finale is disabled", () => {
    // This is the App Store 2.0 bug: finaleConfig.lockAt defaults to creation
    // time + 24h and the Home bar read it as the draft lock.
    const countdown = resolve({
      finaleConfig: { enabled: false, lockAt: YESTERDAY },
    });

    expect(countdown.kind).toBe("draft");
    expect(countdown.targetAt).toBe(PREMIERE);
  });

  it("hands the bar to the finale once it is enabled", () => {
    const finaleLockAt = "2026-11-05T01:00:00.000Z";

    expect(
      resolve({ finaleConfig: { enabled: true, lockAt: finaleLockAt } })
    ).toEqual({
      kind: "finale",
      label: "Finale Gauntlet",
      targetAt: finaleLockAt,
      statusText: "Picks are locked.",
    });
  });

  it("reports a passed finale lock as locked rather than counting", () => {
    const countdown = resolve({
      finaleConfig: { enabled: true, lockAt: YESTERDAY },
    });

    expect(countdown.kind).toBe("finale");
    expect(countdown.targetAt).toBeNull();
  });

  it("falls back to a scheduled weekly lock once the draft has closed", () => {
    const weeklyLockAt = "2026-09-24T00:00:00.000Z";
    const countdown = resolve({
      draftWindow: closed("past-lock-time", YESTERDAY),
      lockSchedule: { draftLockAt: YESTERDAY, weeklyLockAt },
    });

    expect(countdown).toEqual({
      kind: "weekly",
      label: "Picks Lock In",
      targetAt: weeklyLockAt,
      statusText: "Picks are locked.",
    });
  });

  it("does not count down to a weekly lock that has already passed", () => {
    const countdown = resolve({
      draftWindow: closed("past-lock-time", YESTERDAY),
      lockSchedule: { draftLockAt: YESTERDAY, weeklyLockAt: YESTERDAY },
    });

    expect(countdown.kind).toBe("none");
    expect(countdown.targetAt).toBeNull();
  });

  it("does not count down to a weekly lock unless the draft closed on schedule", () => {
    const weeklyLockAt = "2026-09-24T00:00:00.000Z";
    const lockSchedule = { draftLockAt: PREMIERE, weeklyLockAt };
    const closedReasons = [
      "season-not-live",
      "season-locked",
      "disabled-by-admin",
      "forced-closed",
    ] as const;

    for (const reason of closedReasons) {
      const countdown = resolve({
        draftWindow: closed(reason),
        lockSchedule,
      });
      expect(countdown.kind).toBe("none");
      expect(countdown.targetAt).toBeNull();
    }

    expect(
      resolve({
        draftWindow: open(null),
        lockSchedule,
      }).kind
    ).toBe("none");
  });

  it("states the draft is open when nothing is scheduled instead of inventing a time", () => {
    expect(resolve({ draftWindow: open(null) })).toEqual({
      kind: "none",
      label: "Draft Status",
      targetAt: null,
      statusText: "Draft is open. No lock time is scheduled yet.",
    });
  });

  it("explains a closed draft in the same words as the Draft tab", () => {
    const lockSchedule = {
      draftLockAt: PREMIERE,
      weeklyLockAt: "2026-09-24T00:00:00.000Z",
    };

    expect(
      resolve({
        draftWindow: closed("season-not-live"),
        lockSchedule,
      }).statusText
    ).toBe("Draft opens when the season goes live.");
    expect(
      resolve({
        draftWindow: closed("season-locked"),
        lockSchedule,
      }).statusText
    ).toBe("This season is complete. Draft entries are closed.");
    expect(
      resolve({
        draftWindow: closed("disabled-by-admin"),
        lockSchedule,
      }).statusText
    ).toBe("Draft is currently closed.");
    expect(
      resolve({
        draftWindow: closed("forced-closed"),
        lockSchedule,
      }).statusText
    ).toBe("Draft is currently closed.");
  });

  it("uses the league's own draft terminology", () => {
    const countdown = resolve({ draftLabel: "Round Table" });

    expect(countdown.label).toBe("Round Table Locks In");
    expect(countdown.statusText).toBe("Round Table is locked.");
  });

  it("treats an unparseable lock time as unscheduled", () => {
    expect(resolve({ draftWindow: open("next tuesday") }).kind).toBe("none");
  });
});
