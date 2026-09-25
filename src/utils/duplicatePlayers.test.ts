import { describe, expect, it } from "vitest";
import {
  duplicateFlagsTouching,
  duplicateReasonLabel,
  findLikelyDuplicatePlayers,
  formatDuplicateImportWarning,
  normalizePlayerName,
} from "./duplicatePlayers";

describe("normalizePlayerName", () => {
  it("treats initials with periods as the same letters", () => {
    expect(normalizePlayerName("K.K.")).toBe("kk");
    expect(normalizePlayerName("  Kiley   Kaiser ")).toBe("kiley kaiser");
  });
});

describe("findLikelyDuplicatePlayers", () => {
  const kiley = { id: "kiley", name: "Kiley Kaiser", email: "kiley@example.com" };
  const kk = { id: "kk", name: "KK", email: "kk@example.com" };
  const robyn = { id: "robyn", name: "Robyn Taylor", email: "robyn@example.com" };
  const robynTypo = { id: "robyn-2", name: "Robyn Tylor", email: "other@example.com" };

  it("flags initials against a full name and does not merge either row", () => {
    const roster = [kiley, kk];
    const flags = findLikelyDuplicatePlayers(roster);

    expect(flags).toEqual([
      {
        playerId: "kiley",
        otherPlayerId: "kk",
        playerName: "Kiley Kaiser",
        otherName: "KK",
        reason: "initials",
      },
    ]);
    expect(roster).toHaveLength(2);
    expect(duplicateReasonLabel("initials")).toBe("Initials match the full name");
  });

  it("flags the same normalized name and a close typo", () => {
    const flags = findLikelyDuplicatePlayers([
      robyn,
      { id: "robyn-dup", name: "robyn  taylor", email: "second@example.com" },
      robynTypo,
    ]);

    expect(flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: "robyn",
          otherPlayerId: "robyn-dup",
          reason: "same-name",
        }),
        expect.objectContaining({
          playerId: "robyn",
          otherPlayerId: "robyn-2",
          reason: "similar",
        }),
        expect.objectContaining({
          playerId: "robyn-dup",
          otherPlayerId: "robyn-2",
          reason: "similar",
        }),
      ])
    );
    expect(flags).toHaveLength(3);
  });

  it("does not flag unrelated names", () => {
    expect(
      findLikelyDuplicatePlayers([
        { id: "a", name: "Alex Rivera", email: "a@example.com" },
        { id: "b", name: "Jordan Blake", email: "b@example.com" },
      ])
    ).toEqual([]);
  });

  it("limits an import warning to rows that were just added", () => {
    const existing = [kiley];
    const additions = [kk];
    const flags = duplicateFlagsTouching([...existing, ...additions], ["kk"]);

    expect(flags).toHaveLength(1);
    expect(formatDuplicateImportWarning(flags)).toContain("Kiley Kaiser and KK");
    expect(formatDuplicateImportWarning(flags)).toContain("not merged");
    expect(formatDuplicateImportWarning([])).toBe("");
  });
});
