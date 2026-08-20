import { describe, expect, it } from "vitest";
import { getCastPortraitSrc, slugifyCastName } from "./castPortraits";

describe("slugifyCastName", () => {
  it.each([
    ["Abbey Benjamin", "abbey-benjamin"],
    ["Victor Vollbrechthausen", "victor-vollbrechthausen"],
    // The archived celebrity season carries qualifiers in the name itself.
    ["Lisa Rinna (RHOBH)", "lisa-rinna-rhobh"],
    ["Donna Kelce (Travis' Mom)", "donna-kelce-travis-mom"],
    ["  Spaced  Out  ", "spaced-out"],
  ])("%s -> %s", (input, expected) => {
    expect(slugifyCastName(input)).toBe(expected);
  });
});

describe("getCastPortraitSrc", () => {
  it("derives a path for any cast member, not just a fixed list", () => {
    // The regression this guards: the current cast resolved to "" because
    // their names were not keys in a table built from last season.
    expect(getCastPortraitSrc("Abbey Benjamin")).toBe("/cast-portraits/abbey-benjamin.png");
    expect(getCastPortraitSrc("Xavier Scruggs")).toBe("/cast-portraits/xavier-scruggs.png");
  });

  it("still resolves the archived celebrity names", () => {
    expect(getCastPortraitSrc("Lisa Rinna (RHOBH)")).toBe("/cast-portraits/lisa-rinna-rhobh.png");
  });

  it("prefers an explicitly set portrait URL", () => {
    expect(getCastPortraitSrc("Abbey Benjamin", "https://example.com/a.jpg")).toBe(
      "https://example.com/a.jpg"
    );
  });

  it("ignores a blank explicit URL rather than returning empty", () => {
    expect(getCastPortraitSrc("Abbey Benjamin", "   ")).toBe("/cast-portraits/abbey-benjamin.png");
    expect(getCastPortraitSrc("Abbey Benjamin", null)).toBe("/cast-portraits/abbey-benjamin.png");
  });

  it("returns nothing for an empty name, so the caller shows a placeholder", () => {
    expect(getCastPortraitSrc("")).toBe("");
    expect(getCastPortraitSrc("   ")).toBe("");
  });
});
