import type { RulePack, RulePackPoints } from "../../types";
import {
  RULE_EXPLANATIONS,
  RULE_GROUPS,
  type RuleGroupId,
} from "../config/ruleExplanations";
import { MULTIPLIERS } from "./scoringConstants";

export interface RuleGuideEntry {
  key: keyof RulePackPoints;
  label: string;
  detail: string;
  /** Signed value as it affects a score, ready to display. */
  points: number;
  tone: "gain" | "loss";
}

export interface RuleGuideSection {
  id: RuleGroupId;
  title: string;
  blurb: string;
  entries: RuleGuideEntry[];
}

export interface RulesGuide {
  packName: string;
  packDescription: string;
  sections: RuleGuideSection[];
  /** Short notes that are rules but not point values. */
  notes: string[];
}

const POINT_KEYS = Object.keys(RULE_EXPLANATIONS) as Array<keyof RulePackPoints>;

/**
 * Turns a rule pack into the guide players read.
 *
 * Every number comes from the pack itself, so switching packs or changing a
 * value updates the guide with no copy to rewrite. Rules belonging to a module
 * the pack disables are dropped rather than shown as unreachable.
 */
export const buildRulesGuide = (pack: RulePack): RulesGuide => {
  const sections = RULE_GROUPS.map((group) => {
    const entries = POINT_KEYS.filter((key) => {
      const explanation = RULE_EXPLANATIONS[key];
      if (explanation.hidden) return false;
      if (explanation.group !== group.id) return false;
      if (explanation.module && !pack.bonusModules[explanation.module]) return false;
      return true;
    }).map<RuleGuideEntry>((key) => {
      const explanation = RULE_EXPLANATIONS[key];
      const raw = pack.points[key];
      // Weekly penalties are stored positive and subtracted; bonus penalties are
      // stored negative and added. Normalise so the guide always shows the sign
      // a player would actually see on their score.
      const points = explanation.subtracted ? -Math.abs(raw) : raw;
      return {
        key,
        label: explanation.label,
        detail: explanation.detail,
        points,
        tone: explanation.tone,
      };
    });

    return { id: group.id, title: group.title, blurb: group.blurb, entries };
  }).filter((section) => section.entries.length > 0);

  const notes: string[] = [];

  if (pack.bonusModules.doubleOrNothing) {
    notes.push(
      `Double or Nothing multiplies your weekly calls by ${MULTIPLIERS.DOUBLE_OR_NOTHING} — the reward and the penalty alike. It is switched off during the finale.`
    );
  }

  if (pack.bonusModules.traitorTrio) {
    notes.push(
      "The Traitor Trio bonus needs all three names correct. A shorter correct list still pays the per-name rate, not the flat bonus."
    );
  }

  if (pack.tieBreakStrategy === "final_pot_distance") {
    notes.push(
      "Level scores are separated by whoever guessed closest to the final prize pot."
    );
  }

  notes.push(
    "Admins can apply manual adjustments, which always show on your scorecard with a reason."
  );

  return {
    packName: pack.name,
    packDescription: pack.description ?? "",
    sections,
    notes,
  };
};

/** Formats a signed value for display, e.g. "+10", "-2", "+0.5". */
export const formatRulePoints = (points: number): string => {
  const rounded = Number.isInteger(points) ? points.toFixed(0) : points.toFixed(1);
  return points > 0 ? `+${rounded}` : rounded;
};
