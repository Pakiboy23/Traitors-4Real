import { describe, expect, it } from "vitest";
import { enqueueSeasonWrite } from "./seasonWriteQueue";

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
