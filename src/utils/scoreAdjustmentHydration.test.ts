import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decideScoreAdjustmentHydration } from "./scoreAdjustmentHydration";
import type { ScoreAdjustment } from "../../types";

const repoRoot = path.resolve(__dirname, "../..");
const admin = readFileSync(path.join(repoRoot, "components/AdminPanel.tsx"), "utf8");
const supabase = readFileSync(path.join(repoRoot, "services/supabase.ts"), "utf8");

const listFn = supabase.slice(
  supabase.indexOf("export const listScoreAdjustments"),
  supabase.indexOf("export const createScoreAdjustment")
);

const adjustment = (id: string): ScoreAdjustment => ({
  id,
  seasonId: "traitors-new-blood-s1",
  playerId: "player-1",
  reason: "scoring correction",
  points: 5,
  createdBy: "admin",
  createdAt: "2026-10-11T00:00:00.000Z",
});

const base = {
  isLatestFetch: true,
  writeRevisionAtFetchStart: 0,
  writeRevisionNow: 0,
  records: [adjustment("adj-1")],
};

describe("decideScoreAdjustmentHydration", () => {
  it("applies a successful list, including an empty one", () => {
    expect(decideScoreAdjustmentHydration(base)).toEqual({
      apply: true,
      records: base.records,
    });
    expect(
      decideScoreAdjustmentHydration({ ...base, records: [] })
    ).toEqual({ apply: true, records: [] });
  });

  it("does not empty the board when a late fetch is no longer the newest", () => {
    expect(
      decideScoreAdjustmentHydration({ ...base, isLatestFetch: false, records: [] })
    ).toEqual({ apply: false });
  });

  it("keeps a row the commissioner added while the list was in flight", () => {
    expect(
      decideScoreAdjustmentHydration({
        ...base,
        writeRevisionNow: 1,
        records: [],
      })
    ).toEqual({ apply: false });
  });

  it("ignores a non-array payload", () => {
    expect(
      decideScoreAdjustmentHydration({ ...base, records: null })
    ).toEqual({ apply: false });
  });
});

describe("score adjustment hydrator wiring", () => {
  it("does not swallow a failed list as an empty array", () => {
    expect(listFn).toContain("if (error) throw error");
    expect(listFn).not.toContain("listScoreAdjustments failed:");
    expect(listFn).not.toMatch(/catch[\s\S]*return \[\]/);
  });

  it("gates the board write on decideScoreAdjustmentHydration and local write revision", () => {
    expect(admin).toContain("decideScoreAdjustmentHydration");
    expect(admin).toContain("scoreAdjustmentWriteRevRef");
    expect(admin).toContain("scoreAdjustmentFetchSeqRef");
    expect(admin).toMatch(
      /applyScoreAdjustmentsToState[\s\S]*scoreAdjustmentWriteRevRef\.current \+= 1/
    );
  });
});
