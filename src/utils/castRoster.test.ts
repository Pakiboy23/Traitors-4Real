import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SHOW_CONFIG } from "../config/defaultShowConfig";
import { NEW_BLOOD_CAST_NAMES } from "../config/newBloodCast";
import { resolveCastNames } from "./castProfiles";

const repoRoot = path.resolve(__dirname, "../..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(path.join(repoRoot, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });

/**
 * The legacy roster has now been welded onto a new season's cast twice: once in
 * App.tsx, and once — after that was fixed — in the admin panel's banish and
 * murder menus, where it listed twenty-two civilians next to twenty-three
 * celebrities from the season before.
 *
 * CAST_NAMES is a fallback for state that predates per-season casts. Spreading
 * it into a roster makes it an addition instead, so the spread itself is what
 * this test bans. Pass it to resolveCastNames as the fallback argument.
 */
describe("the legacy cast list stays a fallback", () => {
  it("is never spread into a roster", () => {
    const offenders = [...sourceFiles("components"), "App.tsx"]
      .filter((file) => /\.\.\.\s*CAST_NAMES/.test(readFileSync(path.join(repoRoot, file), "utf8")));

    expect(offenders).toEqual([]);
  });
});

describe("resolveCastNames on the season that is actually live", () => {
  // The global show_configs record still holds last season's celebrities, so a
  // roster that trusts it produces forty-five names for a twenty-two person show.
  const legacyNames = DEFAULT_SHOW_CONFIG.castNames;

  it("keeps a declared season roster to itself", () => {
    const resolved = resolveCastNames([], NEW_BLOOD_CAST_NAMES, legacyNames);

    expect(resolved).toHaveLength(22);
    expect(resolved).not.toContain("Lisa Rinna (RHOBH)");
  });

  it("still falls back for state that declares no cast at all", () => {
    expect(resolveCastNames([], [], legacyNames)).toHaveLength(legacyNames.length);
  });
});
