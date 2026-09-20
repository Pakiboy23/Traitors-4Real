import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(path.join(repoRoot, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });

const clientFiles = () =>
  [...sourceFiles("components"), ...sourceFiles("services"), ...sourceFiles("src"), "App.tsx"].filter(
    (file) => file !== "src/types/database.ts"
  );

/**
 * Live play is seasons + season_states. The games jsonb row is leftover
 * persistence: production always has a season, so fetchGameState / saveGameState
 * / subscribeToGameState never ran. The table stays until that client ships.
 */
describe("the unused games persistence path stays deleted", () => {
  it("does not fetch, save, or subscribe to public.games from the client", () => {
    const helpers = /fetchGameState|saveGameState|subscribeToGameState/;
    const tableCall = /\.from\(\s*["']games["']\s*\)/;
    const offenders = clientFiles().filter((file) => {
      const source = readFileSync(path.join(repoRoot, file), "utf8");
      return helpers.test(source) || tableCall.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
