import {
  CAST_NAMES,
  COUNCIL_LABELS,
  type ShowConfig,
} from "../../types";

export const DEFAULT_SHOW_SLUG = "default";

export const DEFAULT_SHOW_CONFIG: ShowConfig = {
  slug: DEFAULT_SHOW_SLUG,
  showName: "Traitors Fantasy Draft",
  shortName: "Traitors Fantasy",
  branding: {
    headerKicker: "Traitors Fantasy Draft",
    appTitle: "Round Table Command Desk",
    footerCopy: "Traitors Fantasy Draft: Titanic Swim Team Edition workspace.",
  },
  terminology: {
    weeklyCouncilLabel: COUNCIL_LABELS.weekly,
    jrCouncilLabel: COUNCIL_LABELS.jr,
    draftLabel: "Draft",
    leaderboardLabel: "Leaderboard",
    adminLabel: "Admin",
    finaleLabelDefault: "Finale Gauntlet",
  },
  defaultUiVariant: "premium",
  featureToggles: {
    draftEnabled: true,
    jrLeagueEnabled: true,
    finaleEnabled: true,
    scoreAdjustmentsEnabled: true,
    seasonArchivingEnabled: true,
  },
  castNames: [...CAST_NAMES],
};
