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
 * Live play is seasons + season_states. #176 deleted the client helpers.
 * 0004 drops the leftover table; this scan keeps the client path from returning.
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

  it("drops public.games in a forward migration instead of rewriting 0001", () => {
    const sqlDir = path.join(repoRoot, "supabase");
    const files = readdirSync(sqlDir).filter((name) => name.endsWith(".sql"));
    expect(files).toContain("0001_traitors_core.sql");

    const drop = /drop table if exists public\.games/i;
    const forwardDrops = files.filter(
      (name) =>
        name !== "0001_traitors_core.sql" &&
        drop.test(readFileSync(path.join(sqlDir, name), "utf8"))
    );

    expect(forwardDrops.length).toBeGreaterThan(0);
  });

  it("does not keep a games table in generated Database types", () => {
    const source = readFileSync(path.join(repoRoot, "src/types/database.ts"), "utf8");
    expect(source).not.toMatch(/^\s+games:\s*\{/m);
  });
});
