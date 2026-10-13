import {
  CAST_NAMES,
  type CastMemberStatus,
  type GameState,
  type PlayerEntry,
  type ScoreAdjustment,
  type SeasonConfig,
  type ShowConfig,
  type WeeklyScoreSnapshot,
  type WeeklySubmissionHistoryEntry,
  normalizeWeekId,
  resolveActiveWeekId,
} from "../../types.ts";
import { DEFAULT_SHOW_CONFIG } from "../config/defaultShowConfig.ts";
import { sanitizeSeasonConfig, sanitizeShowConfig } from "../config/validation.ts";
import { normalizeCastMemberStatus, resolveCastNames } from "./castProfiles.ts";
import { assignPublicRosterIds } from "./publicRosterIds.ts";
import { sanitizeWeeklyRecaps } from "./weeklyRecap.ts";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const DEFAULT_FINALE_LABEL = "Finale Gauntlet";
const FINALE_LOCK_LEAD_MS = 7 * 24 * 60 * 60 * 1000;

/** Default finale lock, measured from the time the caller supplies. */
export const defaultFinaleLockAt = (now: number): string =>
  new Date(now + FINALE_LOCK_LEAD_MS).toISOString();

const DEFAULT_WEEKLY_RESULTS = {
  nextBanished: "",
  nextMurdered: "",
  bonusGames: {
    redemptionRoulette: "",
    shieldGambit: "",
    traitorTrio: [] as string[],
  },
  finaleResults: {
    finalWinner: "",
    lastFaithfulStanding: "",
    lastTraitorStanding: "",
    finalPotValue: null as number | null,
  },
};

export const normalizeFinaleConfig = (
  input?: GameState["finaleConfig"] | null,
  now: number = Date.now()
): GameState["finaleConfig"] => ({
  enabled: Boolean(input?.enabled),
  label:
    typeof input?.label === "string" && input.label.trim()
      ? input.label
      : DEFAULT_FINALE_LABEL,
  lockAt:
    typeof input?.lockAt === "string" && input.lockAt.trim()
      ? input.lockAt
      : defaultFinaleLockAt(now),
});

export const normalizeWeeklyResults = (
  input?: GameState["weeklyResults"] | null,
  fallbackWeekId?: string
): GameState["weeklyResults"] => {
  const bonusGames = input?.bonusGames ?? DEFAULT_WEEKLY_RESULTS.bonusGames;
  const finaleResults =
    input?.finaleResults ?? DEFAULT_WEEKLY_RESULTS.finaleResults;
  return {
    weekId: normalizeWeekId(input?.weekId) ?? normalizeWeekId(fallbackWeekId) ?? undefined,
    nextBanished: input?.nextBanished ?? DEFAULT_WEEKLY_RESULTS.nextBanished,
    nextMurdered: input?.nextMurdered ?? DEFAULT_WEEKLY_RESULTS.nextMurdered,
    bonusGames: {
      redemptionRoulette:
        bonusGames.redemptionRoulette ??
        DEFAULT_WEEKLY_RESULTS.bonusGames.redemptionRoulette,
      shieldGambit:
        bonusGames.shieldGambit ??
        DEFAULT_WEEKLY_RESULTS.bonusGames.shieldGambit,
      traitorTrio: Array.isArray(bonusGames.traitorTrio)
        ? bonusGames.traitorTrio
        : DEFAULT_WEEKLY_RESULTS.bonusGames.traitorTrio,
    },
    finaleResults: {
      finalWinner: finaleResults.finalWinner ?? DEFAULT_WEEKLY_RESULTS.finaleResults.finalWinner,
      lastFaithfulStanding:
        finaleResults.lastFaithfulStanding ??
        DEFAULT_WEEKLY_RESULTS.finaleResults.lastFaithfulStanding,
      lastTraitorStanding:
        finaleResults.lastTraitorStanding ??
        DEFAULT_WEEKLY_RESULTS.finaleResults.lastTraitorStanding,
      finalPotValue:
        typeof finaleResults.finalPotValue === "number" &&
        Number.isFinite(finaleResults.finalPotValue)
          ? finaleResults.finalPotValue
          : DEFAULT_WEEKLY_RESULTS.finaleResults.finalPotValue,
    },
  };
};

/**
 * The shape Home and the Leaderboard score. Kept here so the bundled client
 * and the season-standings Edge Function cannot drift apart on defaults.
 */
export const normalizeGameState = (
  input?: Partial<GameState> | null,
  now: number = Date.now()
): GameState => {
  const weeklyScoreHistory = Array.isArray(input?.weeklyScoreHistory)
    ? (input!.weeklyScoreHistory as WeeklyScoreSnapshot[])
    : [];
  const activeWeekId = resolveActiveWeekId({
    activeWeekId: input?.activeWeekId,
    seasonConfig: input?.seasonConfig,
    weeklyScoreHistory,
  });

  const showConfig: ShowConfig = sanitizeShowConfig(input?.showConfig ?? DEFAULT_SHOW_CONFIG);
  const seasonConfig: SeasonConfig = sanitizeSeasonConfig(
    input?.seasonConfig ?? null,
    typeof input?.seasonId === "string" && input.seasonId.trim()
      ? input.seasonId
      : "season-1"
  );
  const castStatus: GameState["castStatus"] = {};
  const incomingCast: Record<string, Partial<CastMemberStatus>> =
    input?.castStatus ?? {};
  const castNames = resolveCastNames(
    showConfig.castNames,
    Object.keys(incomingCast),
    CAST_NAMES
  );

  castNames.forEach((name) => {
    const current = incomingCast[name] ?? {};
    castStatus[name] = normalizeCastMemberStatus(current, name);
  });

  const players = Array.isArray(input?.players) ? input!.players : [];
  const normalizedPlayers = assignPublicRosterIds(players.map((player, index) => {
    const safeName = typeof player.name === "string" ? player.name : "";
    const safeEmail = typeof player.email === "string" ? player.email : "";
    const legacyPlayer = player as PlayerEntry & {
      finalePredictions?: {
        finalWinner?: string;
        lastFaithfulStanding?: string;
        lastTraitorStanding?: string;
        finalPotEstimate?: number | null;
      };
    };
    const legacyFinale = legacyPlayer.finalePredictions;
    const fallbackIdSeed =
      normalizeEmail(safeEmail) ||
      safeName.trim().toLowerCase().replace(/\s+/g, "-");
    const safeId =
      typeof player.id === "string" && player.id.trim()
        ? player.id
        : fallbackIdSeed || `player-${index + 1}`;

    return {
      ...player,
      id: safeId,
      name: safeName,
      email: safeEmail,
      league: player.league === "jr" ? "jr" : "main",
      picks: Array.isArray(player.picks) ? player.picks : [],
      predTraitors: Array.isArray(player.predTraitors)
        ? player.predTraitors
        : [],
      weeklyPredictions: {
        weekId: normalizeWeekId(player.weeklyPredictions?.weekId) ?? undefined,
        nextBanished: player.weeklyPredictions?.nextBanished ?? "",
        nextMurdered: player.weeklyPredictions?.nextMurdered ?? "",
        bonusGames: {
          redemptionRoulette:
            player.weeklyPredictions?.bonusGames?.redemptionRoulette ?? "",
          doubleOrNothing: Boolean(
            player.weeklyPredictions?.bonusGames?.doubleOrNothing
          ),
          shieldGambit: player.weeklyPredictions?.bonusGames?.shieldGambit ?? "",
          traitorTrio:
            player.weeklyPredictions?.bonusGames?.traitorTrio ?? [],
        },
        finalePredictions: {
          finalWinner:
            player.weeklyPredictions?.finalePredictions?.finalWinner ??
            legacyFinale?.finalWinner ??
            "",
          lastFaithfulStanding:
            player.weeklyPredictions?.finalePredictions?.lastFaithfulStanding ??
            legacyFinale?.lastFaithfulStanding ??
            "",
          lastTraitorStanding:
            player.weeklyPredictions?.finalePredictions?.lastTraitorStanding ??
            legacyFinale?.lastTraitorStanding ??
            "",
          finalPotEstimate:
            typeof player.weeklyPredictions?.finalePredictions?.finalPotEstimate ===
              "number" &&
            Number.isFinite(player.weeklyPredictions?.finalePredictions?.finalPotEstimate)
              ? player.weeklyPredictions?.finalePredictions?.finalPotEstimate
              : typeof legacyFinale?.finalPotEstimate === "number" &&
                Number.isFinite(legacyFinale?.finalPotEstimate)
              ? legacyFinale.finalPotEstimate
              : null,
        },
      },
    } as PlayerEntry;
  }));

  const history = Array.isArray(input?.weeklySubmissionHistory)
    ? (input!.weeklySubmissionHistory as WeeklySubmissionHistoryEntry[])
    : [];
  const scoreAdjustments = Array.isArray(input?.scoreAdjustments)
    ? (input!.scoreAdjustments as ScoreAdjustment[])
        .filter(
          (adjustment) =>
            adjustment &&
            typeof adjustment.id === "string" &&
            typeof adjustment.playerId === "string" &&
            typeof adjustment.seasonId === "string" &&
            typeof adjustment.reason === "string" &&
            typeof adjustment.points === "number"
        )
        .map((adjustment) => ({
          ...adjustment,
          weekId: normalizeWeekId(adjustment.weekId) ?? undefined,
          createdBy: adjustment.createdBy || "admin",
          createdAt: adjustment.createdAt || new Date(now).toISOString(),
        }))
    : [];
  const seasonId =
    normalizeWeekId(input?.seasonId) ??
    normalizeWeekId(seasonConfig.seasonId) ??
    "season-1";
  const rulePackId =
    normalizeWeekId(input?.rulePackId) ??
    normalizeWeekId(seasonConfig.rulePackId) ??
    "traitors-classic";

  return {
    seasonId,
    rulePackId,
    activeWeekId,
    players: normalizedPlayers,
    castStatus,
    showConfig,
    seasonConfig: {
      ...seasonConfig,
      seasonId,
      activeWeekId,
      rulePackId,
    },
    finaleConfig: normalizeFinaleConfig(input?.finaleConfig, now),
    scoreAdjustments,
    weeklyResults: normalizeWeeklyResults(input?.weeklyResults, activeWeekId),
    weeklySubmissionHistory: history,
    weeklyScoreHistory,
    weeklyRecaps: sanitizeWeeklyRecaps(input?.weeklyRecaps),
  };
};
