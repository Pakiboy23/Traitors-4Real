import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSeasonStateCasApplied,
  enqueueSeasonWrite,
  SeasonStateWriteConflict,
  seasonStateCasExpected,
} from "./seasonWriteQueue";

describe("enqueueSeasonWrite", () => {
  it("runs a later save of the same season after the earlier upsert finishes", async () => {
    const chains = new Map<string, Promise<unknown>>();
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = enqueueSeasonWrite(chains, "season-a", async () => {
      await gate;
      order.push("first-upsert");
      return "first";
    });
    const second = enqueueSeasonWrite(chains, "season-a", async () => {
      order.push("second-upsert");
      return "second";
    });

    expect(order).toEqual([]);
    releaseFirst();
    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    expect(order).toEqual(["first-upsert", "second-upsert"]);
  });

  it("does not hold up a write for a different season", async () => {
    const chains = new Map<string, Promise<unknown>>();
    let releaseFirst: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = enqueueSeasonWrite(chains, "season-a", async () => {
      await gate;
    });
    const other = enqueueSeasonWrite(chains, "season-b", async () => "other");
    await expect(other).resolves.toBe("other");
    releaseFirst();
    await first;
  });

  it("continues the chain after a failed write", async () => {
    const chains = new Map<string, Promise<unknown>>();
    const failed = enqueueSeasonWrite(chains, "season-a", async () => {
      throw new Error("upsert failed");
    });
    await expect(failed).rejects.toThrow("upsert failed");
    await expect(
      enqueueSeasonWrite(chains, "season-a", async () => "recovered")
    ).resolves.toBe("recovered");
  });
});

describe("season state compare-and-swap", () => {
  it("inserts when no snapshot exists and rejects a write that missed the stored timestamp", () => {
    expect(seasonStateCasExpected(null)).toBeNull();
    expect(seasonStateCasExpected("")).toBeNull();
    expect(seasonStateCasExpected("2026-10-13T20:00:00.000Z")).toBe(
      "2026-10-13T20:00:00.000Z"
    );
    expect(() => assertSeasonStateCasApplied(1)).not.toThrow();
    expect(() => assertSeasonStateCasApplied(0)).toThrow(SeasonStateWriteConflict);
    expect(() => assertSeasonStateCasApplied(0)).toThrow(
      "Season state changed while saving. Reload and try again."
    );
  });

  it("writes the snapshot only when the stored updated_at still matches", () => {
    const source = readFileSync(path.resolve(__dirname, "../../services/supabase.ts"), "utf8");
    expect(source).toContain("seasonStateCasExpected");
    expect(source).toContain("assertSeasonStateCasApplied");
    expect(source).toContain('.eq("updated_at", expected)');
  });
});
