import { describe, expect, it } from "vitest";
import type { RulePackPoints } from "../../types";
import { RULE_EXPLANATIONS } from "../config/ruleExplanations";
import {
  RULE_PACKS,
  TRAITORS_CLASSIC_RULE_PACK,
  GENERIC_ELIMINATION_RULE_PACK,
} from "../config/rulePacks";
import { buildRulesGuide, formatRulePoints } from "./rulesGuide";

const allEntries = (pack = TRAITORS_CLASSIC_RULE_PACK) =>
  buildRulesGuide(pack).sections.flatMap((section) => section.entries);

describe("buildRulesGuide", () => {
  it("explains every scoring constant the engine can award", () => {
    // The guard against drift: if a point is added to the rule pack without an
    // explanation, it silently stops being documented. This catches that.
    const documented = Object.keys(RULE_EXPLANATIONS).sort();
    const inPack = Object.keys(TRAITORS_CLASSIC_RULE_PACK.points).sort();

    expect(documented).toEqual(inPack);
  });

  it("takes every number from the pack rather than hardcoding it", () => {
    const entries = allEntries();

    for (const entry of entries) {
      const packValue = TRAITORS_CLASSIC_RULE_PACK.points[entry.key];
      expect(Math.abs(entry.points)).toBe(Math.abs(packValue));
    }
  });

  it("reflects a different pack's values without any copy change", () => {
    const classic = allEntries(TRAITORS_CLASSIC_RULE_PACK);
    const generic = allEntries(GENERIC_ELIMINATION_RULE_PACK);

    const winnerOf = (entries: typeof classic) =>
      entries.find((e) => e.key === "PRED_WINNER")?.points;

    expect(winnerOf(classic)).toBe(TRAITORS_CLASSIC_RULE_PACK.points.PRED_WINNER);
    expect(winnerOf(generic)).toBe(GENERIC_ELIMINATION_RULE_PACK.points.PRED_WINNER);
    expect(winnerOf(classic)).not.toBe(winnerOf(generic));
  });

  it("shows weekly misses as a loss even though the constant is stored positive", () => {
    const miss = allEntries().find((e) => e.key === "WEEKLY_INCORRECT_BASE");

    expect(TRAITORS_CLASSIC_RULE_PACK.points.WEEKLY_INCORRECT_BASE).toBeGreaterThan(0);
    expect(miss?.points).toBeLessThan(0);
  });

  it("leaves an already-negative constant alone", () => {
    const miss = allEntries().find((e) => e.key === "REDEMPTION_ROULETTE_INCORRECT");

    expect(miss?.points).toBe(
      TRAITORS_CLASSIC_RULE_PACK.points.REDEMPTION_ROULETTE_INCORRECT
    );
    expect(miss?.points).toBeLessThan(0);
  });

  it("hides rules whose module the pack has switched off", () => {
    const withoutTrio = {
      ...TRAITORS_CLASSIC_RULE_PACK,
      bonusModules: { ...TRAITORS_CLASSIC_RULE_PACK.bonusModules, traitorTrio: false },
    };

    const keys = allEntries(withoutTrio).map((e) => e.key);

    expect(keys).not.toContain("TRAITOR_TRIO_PARTIAL");
    expect(keys).not.toContain("TRAITOR_TRIO_PERFECT");
    expect(keys).toContain("SHIELD_GAMBIT_CORRECT");
  });

  it("drops a section entirely when all of its rules are switched off", () => {
    const noFinale = {
      ...TRAITORS_CLASSIC_RULE_PACK,
      bonusModules: { ...TRAITORS_CLASSIC_RULE_PACK.bonusModules, finaleGauntlet: false },
    };

    expect(buildRulesGuide(noFinale).sections.map((s) => s.id)).not.toContain("finale");
  });

  it("mentions Double or Nothing only when the pack enables it", () => {
    const on = buildRulesGuide(TRAITORS_CLASSIC_RULE_PACK).notes.join(" ");
    const off = buildRulesGuide({
      ...TRAITORS_CLASSIC_RULE_PACK,
      bonusModules: {
        ...TRAITORS_CLASSIC_RULE_PACK.bonusModules,
        doubleOrNothing: false,
      },
    }).notes.join(" ");

    expect(on).toContain("Double or Nothing");
    expect(off).not.toContain("Double or Nothing");
  });

  it("mentions the tie-break only when the pack uses one", () => {
    const withTieBreak = buildRulesGuide(TRAITORS_CLASSIC_RULE_PACK).notes.join(" ");
    const without = buildRulesGuide({
      ...TRAITORS_CLASSIC_RULE_PACK,
      tieBreakStrategy: "none",
    }).notes.join(" ");

    expect(withTieBreak).toContain("prize pot");
    expect(without).not.toContain("prize pot");
  });

  it("produces a usable guide for every shipped pack", () => {
    for (const pack of RULE_PACKS) {
      const guide = buildRulesGuide(pack);

      expect(guide.packName).toBeTruthy();
      expect(guide.sections.length).toBeGreaterThan(0);
      for (const section of guide.sections) {
        for (const entry of section.entries) {
          expect(entry.label).toBeTruthy();
          expect(entry.detail).toBeTruthy();
        }
      }
    }
  });

  it("groups every documented rule under a section that is rendered", () => {
    const rendered = new Set(allEntries().map((e) => e.key));
    const expected = (Object.keys(RULE_EXPLANATIONS) as Array<keyof RulePackPoints>)
      .filter((key) => {
        const explanation = RULE_EXPLANATIONS[key];
        if (explanation.hidden) return false;
        const module = explanation.module;
        return !module || TRAITORS_CLASSIC_RULE_PACK.bonusModules[module];
      });

    for (const key of expected) {
      expect(rendered.has(key)).toBe(true);
    }
  });

  it("keeps the per-name Trio attribution out of the player-facing list", () => {
    // It is documented — so the drift guarantee still covers it — but showing a
    // "+5" next to a value that never adds to a total would misread as a fourth
    // Trio award.
    const keys = allEntries().map((e) => e.key);

    expect(RULE_EXPLANATIONS.TRAITOR_TRIO_PERFECT_PER_MEMBER.hidden).toBe(true);
    expect(keys).not.toContain("TRAITOR_TRIO_PERFECT_PER_MEMBER");
    expect(keys).toContain("TRAITOR_TRIO_PERFECT");
  });
});

describe("formatRulePoints", () => {
  it("signs gains and losses explicitly", () => {
    expect(formatRulePoints(10)).toBe("+10");
    expect(formatRulePoints(-2)).toBe("-2");
  });

  it("keeps one decimal for fractional values", () => {
    expect(formatRulePoints(0.5)).toBe("+0.5");
    expect(formatRulePoints(-0.5)).toBe("-0.5");
  });

  it("renders zero without a plus", () => {
    expect(formatRulePoints(0)).toBe("0");
  });
});
