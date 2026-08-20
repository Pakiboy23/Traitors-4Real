import { describe, expect, it } from "vitest";
import type { DraftPick } from "../../types";
import {
  DRAFT_PROGRESS_MAX_AGE_MS,
  DRAFT_PROGRESS_VERSION,
  createDraftProgress,
  describeSavedAt,
  fitToDraftSize,
  isDraftProgressEmpty,
  parseDraftProgress,
  type DraftProgressInput,
} from "./draftProgress";

const NOW = Date.parse("2026-09-01T20:00:00.000Z");

const pick = (member = ""): DraftPick => ({ member, rank: 1, role: "Faithful" });

const input = (overrides: Partial<DraftProgressInput> = {}): DraftProgressInput => ({
  seasonId: "traitors-new-blood-s1",
  step: 1,
  playerName: "Tester",
  playerEmail: "tester@example.com",
  picks: [pick("Abby Lee")],
  sealedPicks: [true],
  predFirstOut: "Joe Vanella",
  predWinner: "Tomica Adams",
  traitors: ["Sherry Kuehl", "", ""],
  ...overrides,
});

const stored = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    ...createDraftProgress(input()),
    savedAt: NOW - 60_000,
    ...overrides,
  });

describe("createDraftProgress", () => {
  it("stamps the current version", () => {
    expect(createDraftProgress(input()).version).toBe(DRAFT_PROGRESS_VERSION);
  });
});

describe("isDraftProgressEmpty", () => {
  it("is empty when nothing has been entered", () => {
    expect(
      isDraftProgressEmpty(
        input({
          playerName: "",
          playerEmail: "",
          predFirstOut: "",
          predWinner: "",
          traitors: ["", "", ""],
          picks: [pick(), pick()],
        })
      )
    ).toBe(true);
  });

  it("treats whitespace as empty, so we do not offer to restore nothing", () => {
    expect(
      isDraftProgressEmpty(
        input({
          playerName: "   ",
          playerEmail: "  ",
          predFirstOut: " ",
          predWinner: "",
          traitors: ["  ", "", ""],
          picks: [pick("   ")],
        })
      )
    ).toBe(true);
  });

  it.each([
    ["a name", { playerName: "Tester" }],
    ["an email", { playerEmail: "t@example.com" }],
    ["a pick", { picks: [pick("Abby Lee")] }],
    ["a winner call", { predWinner: "Tomica Adams" }],
    ["a traitor guess", { traitors: ["Sherry Kuehl", "", ""] }],
  ])("is not empty once there is %s", (_label, overrides) => {
    const base = input({
      playerName: "",
      playerEmail: "",
      predFirstOut: "",
      predWinner: "",
      traitors: ["", "", ""],
      picks: [pick()],
    });

    expect(isDraftProgressEmpty({ ...base, ...overrides })).toBe(false);
  });
});

describe("parseDraftProgress", () => {
  it("round-trips a saved entry", () => {
    const result = parseDraftProgress(stored(), { seasonId: "traitors-new-blood-s1", now: NOW });

    expect(result).toMatchObject({
      playerName: "Tester",
      playerEmail: "tester@example.com",
      predWinner: "Tomica Adams",
      step: 1,
    });
    expect(result?.picks[0].member).toBe("Abby Lee");
  });

  it("returns null for nothing stored", () => {
    expect(parseDraftProgress(null)).toBeNull();
    expect(parseDraftProgress("")).toBeNull();
  });

  // Storage survives deploys, can be hand-edited, and can hold an older shape.
  // A corrupt blob must not break the form it exists to protect.
  it.each([
    ["not JSON at all", "{{{"],
    ["a JSON array", "[1,2,3]"],
    ["a bare string", '"hello"'],
    ["null", "null"],
  ])("returns null for %s", (_label, raw) => {
    expect(parseDraftProgress(raw, { now: NOW })).toBeNull();
  });

  it("rejects a different schema version rather than guessing at it", () => {
    expect(parseDraftProgress(stored({ version: 999 }), { now: NOW })).toBeNull();
  });

  it("rejects progress older than the maximum age", () => {
    const tooOld = stored({ savedAt: NOW - DRAFT_PROGRESS_MAX_AGE_MS - 1 });

    expect(parseDraftProgress(tooOld, { now: NOW })).toBeNull();
  });

  it("keeps progress right at the age boundary", () => {
    const atLimit = stored({ savedAt: NOW - DRAFT_PROGRESS_MAX_AGE_MS });

    expect(parseDraftProgress(atLimit, { now: NOW })).not.toBeNull();
  });

  it("rejects progress from a different season", () => {
    // Restoring last season's half-finished entry would fill the form with
    // people who are not in this cast.
    const other = stored({ seasonId: "season-legacy" });

    expect(parseDraftProgress(other, { seasonId: "traitors-new-blood-s1", now: NOW })).toBeNull();
  });

  it("accepts progress saved before seasons were recorded", () => {
    const legacy = stored({ seasonId: null });

    expect(parseDraftProgress(legacy, { seasonId: "traitors-new-blood-s1", now: NOW })).not.toBeNull();
  });

  it("repairs malformed picks instead of discarding the whole entry", () => {
    const messy = stored({
      picks: [{ member: "Abby Lee", rank: "not-a-number", role: "Wizard" }, null, 7],
    });

    const result = parseDraftProgress(messy, { now: NOW });

    expect(result?.picks).toEqual([
      { member: "Abby Lee", rank: 1, role: "Faithful" },
      { member: "", rank: 1, role: "Faithful" },
      { member: "", rank: 1, role: "Faithful" },
    ]);
  });

  it("coerces non-array and non-string fields to safe defaults", () => {
    const messy = stored({
      picks: "nope",
      sealedPicks: 5,
      traitors: null,
      playerName: 42,
      step: -3,
    });

    const result = parseDraftProgress(messy, { now: NOW });

    expect(result).toMatchObject({
      picks: [],
      sealedPicks: [],
      traitors: [],
      playerName: "",
      step: 0,
    });
  });

  it("rejects a missing or unparseable savedAt", () => {
    expect(parseDraftProgress(stored({ savedAt: "yesterday" }), { now: NOW })).toBeNull();
    expect(parseDraftProgress(stored({ savedAt: undefined }), { now: NOW })).toBeNull();
  });
});

describe("fitToDraftSize", () => {
  it("pads a short entry up to the draft size", () => {
    expect(fitToDraftSize([pick("Abby Lee")], 3, pick)).toEqual([
      { member: "Abby Lee", rank: 1, role: "Faithful" },
      { member: "", rank: 1, role: "Faithful" },
      { member: "", rank: 1, role: "Faithful" },
    ]);
  });

  it("truncates an entry saved when the draft was larger", () => {
    expect(fitToDraftSize([true, true, true], 2, () => false)).toEqual([true, true]);
  });

  it("leaves an exact fit alone", () => {
    expect(fitToDraftSize([1, 2], 2, () => 0)).toEqual([1, 2]);
  });
});

describe("describeSavedAt", () => {
  it("reads naturally across the ranges", () => {
    expect(describeSavedAt(NOW, NOW)).toBe("just now");
    expect(describeSavedAt(NOW - 60_000, NOW)).toBe("1 minute ago");
    expect(describeSavedAt(NOW - 12 * 60_000, NOW)).toBe("12 minutes ago");
    expect(describeSavedAt(NOW - 60 * 60_000, NOW)).toBe("1 hour ago");
    expect(describeSavedAt(NOW - 5 * 60 * 60_000, NOW)).toBe("5 hours ago");
    expect(describeSavedAt(NOW - 3 * 24 * 60 * 60_000, NOW)).toBe("3 days ago");
  });

  it("never reports a negative age from a clock skew", () => {
    expect(describeSavedAt(NOW + 60_000, NOW)).toBe("just now");
  });
});
