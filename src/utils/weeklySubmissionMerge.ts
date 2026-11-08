import type { BonusGamePredictions, WeeklyPredictions } from "../../types";
import { normalizeWeekId } from "../../types";

const isSameWeek = (
  existingWeekly?: WeeklyPredictions | null,
  activeWeekId?: string | null
) => {
  const existingWeekId = normalizeWeekId(existingWeekly?.weekId);
  const normalizedActiveWeekId = normalizeWeekId(activeWeekId);
  return (
    existingWeekId !== null &&
    normalizedActiveWeekId !== null &&
    existingWeekId === normalizedActiveWeekId
  );
};

/**
 * Merge one submission's council picks onto the active week.
 *
 * A different week never keeps the previous week's banished/murdered calls.
 * Bonus-only votes store those columns as null, which is indistinguishable
 * from an omitted field, so a same-week omit still keeps this week's choice.
 * A submitted name replaces what was stored.
 */
export const mergeWeeklyCouncilPicks = (input: {
  activeWeekId: string;
  existingWeekly?: WeeklyPredictions | null;
  submittedBanished?: string | null;
  submittedMurdered?: string | null;
}): { nextBanished: string; nextMurdered: string } => {
  const sameWeek = isSameWeek(input.existingWeekly, input.activeWeekId);
  return {
    nextBanished: resolveString(
      readOmittedString(input.submittedBanished),
      sameWeek ? input.existingWeekly?.nextBanished : undefined
    ),
    nextMurdered: resolveString(
      readOmittedString(input.submittedMurdered),
      sameWeek ? input.existingWeekly?.nextMurdered : undefined
    ),
  };
};

/**
 * Merge one submission's bonus picks onto the active week.
 *
 * A different week never keeps the previous week's choices. On the same week,
 * a field left out of the submission still keeps the choice already stored.
 * An explicit blank string or empty trio clears that field in either week.
 * A submitted choice, including Double or Nothing, replaces what was stored.
 */
export const mergeWeeklyBonusPredictions = (input: {
  activeWeekId: string;
  existingWeekly?: WeeklyPredictions | null;
  submittedBonus?: BonusGamePredictions | null;
}): BonusGamePredictions => {
  const sameWeek = isSameWeek(input.existingWeekly, input.activeWeekId);
  const existing = input.existingWeekly?.bonusGames;
  const submitted = bonusRecord(input.submittedBonus);

  return {
    redemptionRoulette: resolveString(
      readString(submitted, "redemptionRoulette"),
      sameWeek ? existing?.redemptionRoulette : undefined
    ),
    shieldGambit: resolveString(
      readString(submitted, "shieldGambit"),
      sameWeek ? existing?.shieldGambit : undefined
    ),
    traitorTrio: resolveTrio(
      readTrio(submitted),
      sameWeek ? existing?.traitorTrio : undefined
    ),
    doubleOrNothing: resolveBoolean(
      readBoolean(submitted, "doubleOrNothing"),
      sameWeek ? existing?.doubleOrNothing : undefined
    ),
  };
};

type FieldRead<T> = { state: "absent" } | { state: "blank" } | { state: "value"; value: T };

const bonusRecord = (
  value: BonusGamePredictions | null | undefined
): BonusGamePredictions | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value;
};

const readOmittedString = (raw: string | null | undefined): FieldRead<string> => {
  if (typeof raw !== "string") return { state: "absent" };
  const trimmed = raw.trim();
  if (!trimmed) return { state: "absent" };
  return { state: "value", value: trimmed };
};

const readString = (
  bonus: BonusGamePredictions | undefined,
  key: "redemptionRoulette" | "shieldGambit"
): FieldRead<string> => {
  if (!bonus || !Object.prototype.hasOwnProperty.call(bonus, key)) return { state: "absent" };
  const raw = bonus[key];
  if (typeof raw !== "string") return { state: "absent" };
  const trimmed = raw.trim();
  if (!trimmed) return { state: "blank" };
  return { state: "value", value: trimmed };
};

const readTrio = (bonus: BonusGamePredictions | undefined): FieldRead<string[]> => {
  if (!bonus || !Object.prototype.hasOwnProperty.call(bonus, "traitorTrio")) {
    return { state: "absent" };
  }
  const raw = bonus.traitorTrio;
  if (!Array.isArray(raw)) return { state: "absent" };
  const names = raw
    .map((name) => (typeof name === "string" ? name.trim() : ""))
    .filter((name) => name.length > 0);
  if (names.length === 0) return { state: "blank" };
  return { state: "value", value: names };
};

const readBoolean = (
  bonus: BonusGamePredictions | undefined,
  key: "doubleOrNothing"
): FieldRead<boolean> => {
  if (!bonus || !Object.prototype.hasOwnProperty.call(bonus, key)) return { state: "absent" };
  const raw = bonus[key];
  if (typeof raw !== "boolean") return { state: "absent" };
  return { state: "value", value: raw };
};

const resolveString = (read: FieldRead<string>, inherited: string | undefined): string => {
  switch (read.state) {
    case "value":
      return read.value;
    case "blank":
      return "";
    case "absent":
      return typeof inherited === "string" ? inherited : "";
    default: {
      const _exhaustive: never = read;
      return _exhaustive;
    }
  }
};

const resolveTrio = (read: FieldRead<string[]>, inherited: string[] | undefined): string[] => {
  switch (read.state) {
    case "value":
      return read.value.slice();
    case "blank":
      return [];
    case "absent":
      return Array.isArray(inherited) ? inherited.slice() : [];
    default: {
      const _exhaustive: never = read;
      return _exhaustive;
    }
  }
};

const resolveBoolean = (read: FieldRead<boolean>, inherited: boolean | undefined): boolean => {
  switch (read.state) {
    case "value":
      return read.value;
    case "blank":
      return false;
    case "absent":
      return Boolean(inherited);
    default: {
      const _exhaustive: never = read;
      return _exhaustive;
    }
  }
};
