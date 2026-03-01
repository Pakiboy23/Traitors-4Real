import type { SeasonConfig, ShowConfig } from "../../types";
import { DEFAULT_SHOW_CONFIG } from "./defaultShowConfig";
import { TRAITORS_CLASSIC_RULE_PACK } from "./rulePacks";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const readBoolean = (value: unknown, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const readStringArray = (value: unknown, fallback: string[] = []) =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : fallback;

export const sanitizeShowConfig = (input: unknown): ShowConfig => {
  const source = asRecord(input);
  const branding = asRecord(source?.branding);
  const terminology = asRecord(source?.terminology);
  const featureToggles = asRecord(source?.featureToggles);

  return {
    slug: readString(source?.slug, DEFAULT_SHOW_CONFIG.slug),
    showName: readString(source?.showName, DEFAULT_SHOW_CONFIG.showName),
    shortName: readString(source?.shortName, DEFAULT_SHOW_CONFIG.shortName),
    branding: {
      logoUrl:
        typeof branding?.logoUrl === "string" && branding.logoUrl.trim()
          ? branding.logoUrl.trim()
          : null,
      wordmark: readString(branding?.wordmark, DEFAULT_SHOW_CONFIG.branding.wordmark || ""),
      headerKicker: readString(
        branding?.headerKicker,
        DEFAULT_SHOW_CONFIG.branding.headerKicker || ""
      ),
      appTitle: readString(branding?.appTitle, DEFAULT_SHOW_CONFIG.branding.appTitle || ""),
      footerCopy: readString(
        branding?.footerCopy,
        DEFAULT_SHOW_CONFIG.branding.footerCopy || ""
      ),
    },
    terminology: {
      weeklyCouncilLabel: readString(
        terminology?.weeklyCouncilLabel,
        DEFAULT_SHOW_CONFIG.terminology.weeklyCouncilLabel
      ),
      jrCouncilLabel: readString(
        terminology?.jrCouncilLabel,
        DEFAULT_SHOW_CONFIG.terminology.jrCouncilLabel
      ),
      draftLabel: readString(terminology?.draftLabel, DEFAULT_SHOW_CONFIG.terminology.draftLabel),
      leaderboardLabel: readString(
        terminology?.leaderboardLabel,
        DEFAULT_SHOW_CONFIG.terminology.leaderboardLabel
      ),
      adminLabel: readString(terminology?.adminLabel, DEFAULT_SHOW_CONFIG.terminology.adminLabel),
      finaleLabelDefault: readString(
        terminology?.finaleLabelDefault,
        DEFAULT_SHOW_CONFIG.terminology.finaleLabelDefault
      ),
    },
    defaultUiVariant:
      source?.defaultUiVariant === "classic" || source?.defaultUiVariant === "premium"
        ? source.defaultUiVariant
        : DEFAULT_SHOW_CONFIG.defaultUiVariant,
    featureToggles: {
      draftEnabled: readBoolean(
        featureToggles?.draftEnabled,
        DEFAULT_SHOW_CONFIG.featureToggles.draftEnabled
      ),
      jrLeagueEnabled: readBoolean(
        featureToggles?.jrLeagueEnabled,
        DEFAULT_SHOW_CONFIG.featureToggles.jrLeagueEnabled
      ),
      finaleEnabled: readBoolean(
        featureToggles?.finaleEnabled,
        DEFAULT_SHOW_CONFIG.featureToggles.finaleEnabled
      ),
      scoreAdjustmentsEnabled: readBoolean(
        featureToggles?.scoreAdjustmentsEnabled,
        DEFAULT_SHOW_CONFIG.featureToggles.scoreAdjustmentsEnabled
      ),
      seasonArchivingEnabled: readBoolean(
        featureToggles?.seasonArchivingEnabled,
        DEFAULT_SHOW_CONFIG.featureToggles.seasonArchivingEnabled
      ),
    },
    castNames: readStringArray(source?.castNames, [...DEFAULT_SHOW_CONFIG.castNames]),
  };
};

export const sanitizeSeasonConfig = (
  input: unknown,
  fallbackSeasonId: string
): SeasonConfig => {
  const source = asRecord(input);
  const lockSchedule = asRecord(source?.lockSchedule);
  const finaleConfig = asRecord(source?.finaleConfig);
  const statusValue = readString(source?.status, "live");
  const status =
    statusValue === "draft" ||
    statusValue === "live" ||
    statusValue === "finalized" ||
    statusValue === "archived"
      ? statusValue
      : "live";

  return {
    seasonId: readString(source?.seasonId, fallbackSeasonId),
    label: readString(source?.label, "Season"),
    status,
    timezone: readString(source?.timezone, "UTC"),
    lockSchedule: {
      draftLockAt: readString(lockSchedule?.draftLockAt, "") || null,
      weeklyLockAt: readString(lockSchedule?.weeklyLockAt, "") || null,
      finaleLockAt: readString(lockSchedule?.finaleLockAt, "") || null,
    },
    activeWeekId: readString(source?.activeWeekId, "") || undefined,
    finaleConfig: {
      enabled: readBoolean(finaleConfig?.enabled, false),
      label: readString(finaleConfig?.label, "Finale"),
      lockAt: readString(finaleConfig?.lockAt, ""),
    },
    rulePackId: readString(source?.rulePackId, TRAITORS_CLASSIC_RULE_PACK.id),
  };
};

