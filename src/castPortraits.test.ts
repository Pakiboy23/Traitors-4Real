import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getCastPortraitSrc, slugifyCastName } from "./castPortraits";
import { NEW_BLOOD_CAST } from "./config/newBloodCast";

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

/**
 * Files in public/cast-portraits/ ship in the web bundle and the native wrapper.
 * Missing current-season portraits are fine — CastPortrait falls back to initials.
 * Last-season celebrity stills are not: they would appear as the wrong faces.
 */
describe("public/cast-portraits only contains current-season slugs", () => {
  const dir = path.resolve(__dirname, "../public/cast-portraits");
  const allowed = new Set(NEW_BLOOD_CAST.map((member) => slugifyCastName(member.name)));

  it("rejects any PNG whose stem is not a New Blood name", () => {
    const pngs = readdirSync(dir).filter((file) => file.toLowerCase().endsWith(".png"));
    const unexpected = pngs.filter((file) => !allowed.has(file.replace(/\.png$/i, "")));
    expect(unexpected).toEqual([]);
  });
});
