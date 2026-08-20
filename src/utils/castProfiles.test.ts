import { describe, expect, it } from "vitest";
import type { CastMemberStatus } from "../../types";
import { NEW_BLOOD_CAST, NEW_BLOOD_CAST_NAMES } from "../config/newBloodCast";
import {
  describeCastMember,
  filterCastOptions,
  normalizeCastMemberStatus,
  resolveCastNames,
  summariseCastMember,
  toCastOptions,
} from "./castProfiles";

const status = (overrides: Partial<CastMemberStatus> = {}): CastMemberStatus => ({
  isWinner: false,
  isFirstOut: false,
  isTraitor: false,
  isEliminated: false,
  ...overrides,
});

const roster = () =>
  toCastOptions({
    "Abby Lee": status({ age: 29, occupation: "Astrophysicist", hometown: "Saint Paul, MN" }),
    "Tomica Adams": status({ age: 54, occupation: "Pilot", hometown: "Boston, MA" }),
    "Joe Vanella": status({ age: 44, occupation: "Funeral Director", hometown: "Wantagh, NY" }),
    "Sherry Kuehl": status({ age: 65, occupation: "Writer", hometown: "Leawood, KS", isEliminated: true }),
  });

describe("describeCastMember", () => {
  it("joins age, occupation and hometown", () => {
    expect(
      describeCastMember({ age: 37, occupation: "Nurse", hometown: "Mangham, LA" })
    ).toBe("37 · Nurse · Mangham, LA");
  });

  it("drops missing parts instead of leaving empty separators", () => {
    expect(describeCastMember({ age: 37, occupation: null, hometown: "Mangham, LA" })).toBe(
      "37 · Mangham, LA"
    );
    expect(describeCastMember({ age: null, occupation: "Nurse", hometown: null })).toBe("Nurse");
    expect(describeCastMember({})).toBe("");
  });

  it("ignores blank strings and non-finite ages", () => {
    expect(describeCastMember({ age: Number.NaN, occupation: "   ", hometown: "Boston, MA" })).toBe(
      "Boston, MA"
    );
  });
});

describe("summariseCastMember", () => {
  it("omits the hometown for the collapsed control", () => {
    expect(summariseCastMember({ age: 26, occupation: "Designer" })).toBe("26 · Designer");
  });
});

describe("toCastOptions", () => {
  it("sorts by name and carries profile fields through", () => {
    const options = roster();

    expect(options.map((o) => o.name)).toEqual([
      "Abby Lee",
      "Joe Vanella",
      "Sherry Kuehl",
      "Tomica Adams",
    ]);
    expect(options[0]).toMatchObject({ age: 29, occupation: "Astrophysicist" });
  });

  it("marks eliminated members without dropping them", () => {
    expect(roster().find((o) => o.name === "Sherry Kuehl")?.isEliminated).toBe(true);
  });

  it("tolerates a roster with no profile data at all", () => {
    const options = toCastOptions({ "Someone New": status() });

    expect(options[0]).toMatchObject({ name: "Someone New", age: null, occupation: null });
    expect(describeCastMember(options[0])).toBe("");
  });
});

describe("filterCastOptions", () => {
  it("returns everything for an empty query", () => {
    expect(filterCastOptions(roster(), "   ")).toHaveLength(4);
  });

  it("matches on name", () => {
    expect(filterCastOptions(roster(), "abby").map((o) => o.name)).toEqual(["Abby Lee"]);
  });

  it("matches on occupation, which is how an unfamiliar cast is actually recalled", () => {
    expect(filterCastOptions(roster(), "astro").map((o) => o.name)).toEqual(["Abby Lee"]);
    expect(filterCastOptions(roster(), "funeral").map((o) => o.name)).toEqual(["Joe Vanella"]);
  });

  it("matches on hometown", () => {
    expect(filterCastOptions(roster(), "boston").map((o) => o.name)).toEqual(["Tomica Adams"]);
  });

  it("matches on age", () => {
    expect(filterCastOptions(roster(), "65").map((o) => o.name)).toEqual(["Sherry Kuehl"]);
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    expect(filterCastOptions(roster(), "  PILOT  ").map((o) => o.name)).toEqual(["Tomica Adams"]);
  });

  it("returns nothing when there is no match", () => {
    expect(filterCastOptions(roster(), "zzzz")).toHaveLength(0);
  });
});

describe("New Blood cast data", () => {
  it("has the announced twenty-two", () => {
    expect(NEW_BLOOD_CAST).toHaveLength(22);
    expect(NEW_BLOOD_CAST_NAMES).toHaveLength(22);
  });

  it("has no duplicate names", () => {
    expect(new Set(NEW_BLOOD_CAST_NAMES).size).toBe(22);
  });

  it("gives every member enough context to be told apart", () => {
    for (const member of NEW_BLOOD_CAST) {
      expect(member.name.trim()).toBeTruthy();
      expect(describeCastMember(member)).not.toBe("");
    }
  });

  it("keeps names free of embedded context, unlike the celebrity seasons", () => {
    // "Lisa Rinna (RHOBH)" style names become the identity key used by
    // castStatus, submissions and scoring. Profile data belongs in fields.
    for (const member of NEW_BLOOD_CAST) {
      expect(member.name).not.toContain("(");
    }
  });

  it("is sorted for display", () => {
    expect(NEW_BLOOD_CAST_NAMES).toEqual([...NEW_BLOOD_CAST_NAMES].sort((a, b) => a.localeCompare(b)));
  });
});

describe("normalizeCastMemberStatus", () => {
  it("preserves profile data through a round trip", () => {
    // The regression this guards: App rebuilds castStatus field by field, so a
    // field missing from the normaliser is dropped on every single load.
    const result = normalizeCastMemberStatus({
      isEliminated: true,
      age: 65,
      occupation: "Writer",
      hometown: "Leawood, KS",
      portraitUrl: "/cast-portraits/sherry-kuehl.png",
    });

    expect(result).toEqual({
      isWinner: false,
      isFirstOut: false,
      isTraitor: false,
      isEliminated: true,
      portraitUrl: "/cast-portraits/sherry-kuehl.png",
      age: 65,
      occupation: "Writer",
      hometown: "Leawood, KS",
    });
  });

  it("nulls blank and non-finite values rather than storing them", () => {
    const result = normalizeCastMemberStatus({
      age: Number.NaN,
      occupation: "   ",
      hometown: "",
      portraitUrl: "  ",
    });

    expect(result.age).toBeNull();
    expect(result.occupation).toBeNull();
    expect(result.hometown).toBeNull();
    expect(result.portraitUrl).toBeNull();
  });

  it("produces a complete record from nothing", () => {
    expect(normalizeCastMemberStatus(undefined)).toEqual({
      isWinner: false,
      isFirstOut: false,
      isTraitor: false,
      isEliminated: false,
      portraitUrl: null,
      age: null,
      occupation: null,
      hometown: null,
    });
  });

  it("covers every field of the stored record", () => {
    // If CastMemberStatus gains a field, this fails until the normaliser
    // carries it — the same class of bug, caught next time.
    const keys = Object.keys(normalizeCastMemberStatus({})).sort();

    expect(keys).toEqual([
      "age",
      "hometown",
      "isEliminated",
      "isFirstOut",
      "isTraitor",
      "isWinner",
      "occupation",
      "portraitUrl",
    ]);
  });
});

describe("resolveCastNames", () => {
  const LAST_SEASON = ["Lisa Rinna (RHOBH)", "Donna Kelce (Travis' Mom)"];

  it("uses the season's own cast and does not inherit the previous one", () => {
    // The bug this guards: the hardcoded roster was merged unconditionally, so
    // a 22-person civilian season rendered 45 people.
    const result = resolveCastNames(NEW_BLOOD_CAST_NAMES, [], LAST_SEASON);

    expect(result).toHaveLength(22);
    expect(result).not.toContain("Lisa Rinna (RHOBH)");
  });

  it("falls back to the hardcoded roster only when nothing is declared", () => {
    expect(resolveCastNames([], [], LAST_SEASON)).toEqual(
      [...LAST_SEASON].sort((a, b) => a.localeCompare(b))
    );
    expect(resolveCastNames(undefined, [], LAST_SEASON)).toHaveLength(2);
  });

  it("keeps members already present in stored state", () => {
    const result = resolveCastNames(["Abby Lee"], ["Late Addition"], LAST_SEASON);

    expect(result).toEqual(["Abby Lee", "Late Addition"]);
  });

  it("de-duplicates and sorts", () => {
    expect(resolveCastNames(["Zoe", "Alice", "Zoe"], ["Alice"], LAST_SEASON)).toEqual([
      "Alice",
      "Zoe",
    ]);
  });

  it("ignores blank entries", () => {
    expect(resolveCastNames(["Alice", "", "   "], [], LAST_SEASON)).toEqual(["Alice"]);
  });
});
