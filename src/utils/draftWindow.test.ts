import { describe, expect, it } from "vitest";
import type { GameState, SeasonConfig, SeasonStatus, ShowConfig } from "../../types";
import { DEFAULT_SHOW_CONFIG } from "../config/defaultShowConfig";
import {
  describeDraftWindow,
  resolveDraftWindow,
  resolvePicksLockTarget,
} from "./draftWindow";

const NOW = Date.parse("2026-09-01T20:00:00.000Z");
const BEFORE = "2026-09-01T21:00:00.000Z";
const AFTER = "2026-09-01T19:00:00.000Z";

const seasonConfig = (
  status: SeasonStatus,
  draftLockAt: string | null = null
): SeasonConfig => ({
  seasonId: "season-5",
  label: "Season 5",
  status,
  timezone: "America/New_York",
  lockSchedule: { draftLockAt },
});

const showConfig = (draftEnabled: boolean): ShowConfig => ({
  ...DEFAULT_SHOW_CONFIG,
  featureToggles: { ...DEFAULT_SHOW_CONFIG.featureToggles, draftEnabled },
});

const state = (overrides: Partial<GameState> = {}): Pick<
  GameState,
  "seasonConfig" | "showConfig"
> => ({
  seasonConfig: seasonConfig("live"),
  showConfig: showConfig(true),
  ...overrides,
});

const resolve = (
  overrides: Partial<GameState> = {},
  options: Parameters<typeof resolveDraftWindow>[1] = {}
) => resolveDraftWindow(state(overrides), { now: NOW, ...options });

describe("resolveDraftWindow", () => {
  it("opens for a live season with the draft enabled and no lock time", () => {
    expect(resolve()).toMatchObject({ isOpen: true, reason: "open" });
  });

  it("stays open before the scheduled lock time", () => {
    const window = resolve({ seasonConfig: seasonConfig("live", BEFORE) });

    expect(window.isOpen).toBe(true);
    expect(window.lockAt).toBe(BEFORE);
  });

  it("closes once the lock time has passed", () => {
    expect(resolve({ seasonConfig: seasonConfig("live", AFTER) })).toMatchObject({
      isOpen: false,
      reason: "past-lock-time",
    });
  });

  it("closes exactly at the lock time, not a moment after", () => {
    const lockAt = new Date(NOW).toISOString();

    expect(resolve({ seasonConfig: seasonConfig("live", lockAt) })).toMatchObject({
      isOpen: false,
      reason: "past-lock-time",
    });
  });

  it("flips from open to closed as the clock advances past the lock", () => {
    // This is the contract DraftForm's lock timer relies on: re-resolving with
    // a later `now` is what closes a form that was opened before the lock.
    const lockAt = new Date(NOW + 60_000).toISOString();
    const state = { seasonConfig: seasonConfig("live", lockAt), showConfig: showConfig(true) };

    expect(resolveDraftWindow(state, { now: NOW }).isOpen).toBe(true);
    expect(resolveDraftWindow(state, { now: NOW + 59_999 }).isOpen).toBe(true);
    expect(resolveDraftWindow(state, { now: NOW + 60_000 }).isOpen).toBe(false);
    expect(resolveDraftWindow(state, { now: NOW + 60_001 }).reason).toBe("past-lock-time");
  });

  it("closes when an admin turns the draft off", () => {
    expect(resolve({ showConfig: showConfig(false) })).toMatchObject({
      isOpen: false,
      reason: "disabled-by-admin",
    });
  });

  it.each<SeasonStatus>(["finalized", "archived"])(
    "closes for a %s season",
    (status) => {
      expect(resolve({ seasonConfig: seasonConfig(status) })).toMatchObject({
        isOpen: false,
        reason: "season-locked",
      });
    }
  );

  it("closes for a season still in draft status", () => {
    expect(resolve({ seasonConfig: seasonConfig("draft") })).toMatchObject({
      isOpen: false,
      reason: "season-not-live",
    });
  });

  it("honours the build-time override above everything else", () => {
    const window = resolveDraftWindow(state(), { now: NOW, forceClosed: true });

    expect(window).toMatchObject({ isOpen: false, reason: "forced-closed" });
  });

  it("reports the most authoritative reason when several apply", () => {
    // Finalized season, draft disabled, and past its lock time all at once.
    const window = resolve({
      seasonConfig: seasonConfig("finalized", AFTER),
      showConfig: showConfig(false),
    });

    expect(window.reason).toBe("season-locked");
  });

  it("ignores an unparseable lock time rather than closing the draft", () => {
    const window = resolve({ seasonConfig: seasonConfig("live", "not-a-date") });

    expect(window.isOpen).toBe(true);
    expect(window.lockAt).toBeNull();
  });

  it("treats an empty lock time as no schedule", () => {
    expect(resolve({ seasonConfig: seasonConfig("live", "   ") })).toMatchObject({
      isOpen: true,
      reason: "open",
    });
  });

  describe("legacy state without a season config", () => {
    it("stays open, governed by the admin toggle alone", () => {
      const window = resolveDraftWindow(
        { seasonConfig: undefined, showConfig: showConfig(true) },
        { now: NOW }
      );

      expect(window).toMatchObject({ isOpen: true, reason: "open" });
    });

    it("still respects the admin toggle", () => {
      const window = resolveDraftWindow(
        { seasonConfig: undefined, showConfig: showConfig(false) },
        { now: NOW }
      );

      expect(window).toMatchObject({ isOpen: false, reason: "disabled-by-admin" });
    });
  });
});

describe("resolvePicksLockTarget", () => {
  const DRAFT_LOCK = "2026-09-18T00:00:00.000Z";
  const STALE_FINALE_LOCK = "2026-09-08T20:49:07.347Z";
  const NOW = Date.parse("2026-09-09T14:00:00.000Z");

  it("uses the draft lock on the home countdown before finale mode", () => {
    expect(
      resolvePicksLockTarget({
        isFinaleMode: false,
        draftLockAt: DRAFT_LOCK,
        finaleLockAt: STALE_FINALE_LOCK,
        now: NOW,
      })
    ).toBe(DRAFT_LOCK);
  });

  it("does not fall back to a leftover finale timestamp during the draft", () => {
    const target = resolvePicksLockTarget({
      isFinaleMode: false,
      draftLockAt: null,
      finaleLockAt: STALE_FINALE_LOCK,
      now: NOW,
    });

    expect(Date.parse(target)).toBeGreaterThan(NOW);
    expect(target).not.toBe(STALE_FINALE_LOCK);
  });

  it("uses the finale lock once finale mode is on", () => {
    expect(
      resolvePicksLockTarget({
        isFinaleMode: true,
        draftLockAt: DRAFT_LOCK,
        finaleLockAt: "2026-11-20T01:00:00.000Z",
        now: NOW,
      })
    ).toBe("2026-11-20T01:00:00.000Z");
  });
});

describe("describeDraftWindow", () => {
  it("names the cause rather than saying only that it is closed", () => {
    const locked = resolve({ seasonConfig: seasonConfig("live", AFTER) });

    expect(describeDraftWindow(locked)).toContain("Weekly Council");
  });

  it("uses the show's own term for the draft", () => {
    const notLive = resolve({ seasonConfig: seasonConfig("draft") });

    expect(describeDraftWindow(notLive, "Roster Lock")).toContain("Roster Lock");
  });

  it("covers every reason", () => {
    const reasons = [
      resolve(),
      resolve({ seasonConfig: seasonConfig("live", AFTER) }),
      resolve({ seasonConfig: seasonConfig("finalized") }),
      resolve({ seasonConfig: seasonConfig("draft") }),
      resolve({ showConfig: showConfig(false) }),
      resolveDraftWindow(state(), { now: NOW, forceClosed: true }),
    ];

    for (const window of reasons) {
      expect(describeDraftWindow(window)).toBeTruthy();
    }
  });
});
