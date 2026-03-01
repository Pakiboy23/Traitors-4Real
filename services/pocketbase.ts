import type { RecordModel } from "pocketbase";
import type {
  FinalePredictions,
  GameState,
  ScoreAdjustment,
  SeasonConfig,
  SeasonState,
  ShowConfig,
  SubmissionStatus,
} from "../types";
import { normalizeWeekId } from "../types";
import { pb, pocketbaseUrl } from "../src/lib/pocketbase";
import { DEFAULT_SHOW_CONFIG, DEFAULT_SHOW_SLUG } from "../src/config/defaultShowConfig";
import { sanitizeSeasonConfig, sanitizeShowConfig } from "../src/config/validation";
import { logger } from "../src/utils/logger";

const GAME_COLLECTION = "games";
const GAME_SLUG = DEFAULT_SHOW_SLUG;
const PORTRAITS_COLLECTION = "playerPortraits";
const ADMIN_COLLECTION = "admins";
const SUBMISSIONS_COLLECTION = "submissions";
const SUBMISSIONS_SORT = "-id";
const SHOW_CONFIG_COLLECTION = "showConfigs";
const SEASONS_COLLECTION = "seasons";
const SEASON_STATES_COLLECTION = "seasonStates";
const SCORE_ADJUSTMENTS_COLLECTION = "scoreAdjustments";

const escapeFilterValue = (value: string) => value.replace(/"/g, '\\"');

const isNotFound = (error: any) =>
  error?.status === 404 || error?.response?.code === 404;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const onAdminAuthChange = (callback: (isAuthed: boolean) => void) => {
  return pb.authStore.onChange(() => {
    callback(pb.authStore.isValid);
  }, true);
};

export const signInAdmin = async (email: string, password: string) => {
  await pb.collection(ADMIN_COLLECTION).authWithPassword(email, password);
  return pb.authStore.isValid;
};

export const signOutAdmin = () => {
  pb.authStore.clear();
};

export interface ShowConfigRecord extends RecordModel {
  slug: string;
  config: ShowConfig;
}

export interface SeasonRecord extends RecordModel, SeasonConfig {}

export interface SeasonStateRecord extends RecordModel {
  seasonId: string;
  state: SeasonState;
}

export interface ScoreAdjustmentRecord extends RecordModel {
  seasonId: string;
  playerId: string;
  weekId?: string;
  reason: string;
  points: number;
  createdBy?: string;
}

export const fetchShowConfig = async (
  slug = DEFAULT_SHOW_SLUG
): Promise<ShowConfig | null> => {
  try {
    const record = await pb
      .collection(SHOW_CONFIG_COLLECTION)
      .getFirstListItem<ShowConfigRecord>(`slug="${escapeFilterValue(slug)}"`);
    return sanitizeShowConfig(record.config);
  } catch (error) {
    if (isNotFound(error)) return null;
    logger.warn("fetchShowConfig failed:", error);
    return null;
  }
};

export const saveShowConfig = async (
  config: ShowConfig,
  slug = DEFAULT_SHOW_SLUG
) => {
  const sanitized = sanitizeShowConfig({ ...config, slug });
  try {
    const existing = await pb
      .collection(SHOW_CONFIG_COLLECTION)
      .getFirstListItem<ShowConfigRecord>(`slug="${escapeFilterValue(slug)}"`);
    return pb.collection(SHOW_CONFIG_COLLECTION).update(existing.id, {
      slug,
      config: sanitized,
    });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  return pb.collection(SHOW_CONFIG_COLLECTION).create({
    slug,
    config: sanitized,
  });
};

export const ensureDefaultShowConfig = async () => {
  const existing = await fetchShowConfig(DEFAULT_SHOW_SLUG);
  if (existing) return existing;
  await saveShowConfig(DEFAULT_SHOW_CONFIG, DEFAULT_SHOW_SLUG);
  return DEFAULT_SHOW_CONFIG;
};

export const listSeasons = async (): Promise<SeasonConfig[]> => {
  try {
    const records = await pb.collection(SEASONS_COLLECTION).getFullList<SeasonRecord>({
      sort: "-created",
      perPage: 200,
    });
    return records.map((record) => sanitizeSeasonConfig(record, record.seasonId || record.id));
  } catch (error) {
    if (isNotFound(error)) return [];
    logger.warn("listSeasons failed:", error);
    return [];
  }
};

export const createSeason = async (input: SeasonConfig) => {
  const season = sanitizeSeasonConfig(input, input.seasonId);
  return pb.collection(SEASONS_COLLECTION).create(season);
};

export const updateSeason = async (
  seasonId: string,
  updates: Partial<SeasonConfig>
) => {
  const existing = await pb
    .collection(SEASONS_COLLECTION)
    .getFirstListItem<SeasonRecord>(`seasonId="${escapeFilterValue(seasonId)}"`);
  const merged = sanitizeSeasonConfig(
    {
      ...existing,
      ...updates,
      seasonId,
    },
    seasonId
  );
  return pb.collection(SEASONS_COLLECTION).update(existing.id, merged);
};

export const archiveSeason = async (seasonId: string) =>
  updateSeason(seasonId, { status: "archived" });

export const finalizeSeason = async (seasonId: string) =>
  updateSeason(seasonId, { status: "finalized" });

export const fetchSeasonState = async (
  seasonId: string
): Promise<SeasonState | null> => {
  try {
    const record = await pb
      .collection(SEASON_STATES_COLLECTION)
      .getFirstListItem<SeasonStateRecord>(
        `seasonId="${escapeFilterValue(seasonId)}"`
      );
    return {
      ...(record.state as SeasonState),
      seasonId,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

export const saveSeasonState = async (
  seasonId: string,
  state: SeasonState
) => {
  try {
    const existing = await pb
      .collection(SEASON_STATES_COLLECTION)
      .getFirstListItem<SeasonStateRecord>(
        `seasonId="${escapeFilterValue(seasonId)}"`
      );
    return pb.collection(SEASON_STATES_COLLECTION).update(existing.id, {
      seasonId,
      state: { ...state, seasonId },
    });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  return pb.collection(SEASON_STATES_COLLECTION).create({
    seasonId,
    state: { ...state, seasonId },
  });
};

const resetSeasonStateForClone = (state: SeasonState): SeasonState => {
  const castStatus = Object.fromEntries(
    Object.entries(state.castStatus || {}).map(([name, status]) => [
      name,
      {
        ...status,
        isWinner: false,
        isFirstOut: false,
        isTraitor: false,
        isEliminated: false,
      },
    ])
  );
  return {
    ...state,
    players: [],
    castStatus,
    weeklyResults: {
      weekId: "week-1",
      nextBanished: "",
      nextMurdered: "",
      bonusGames: {
        redemptionRoulette: "",
        shieldGambit: "",
        traitorTrio: [],
      },
      finaleResults: {
        finalWinner: "",
        lastFaithfulStanding: "",
        lastTraitorStanding: "",
        finalPotValue: null,
      },
    },
    activeWeekId: "week-1",
    weeklySubmissionHistory: [],
    weeklyScoreHistory: [],
    scoreAdjustments: [],
  };
};

export const cloneSeason = async (params: {
  sourceSeasonId: string;
  targetSeason: SeasonConfig;
}) => {
  const sourceState = await fetchSeasonState(params.sourceSeasonId);
  await createSeason(params.targetSeason);
  if (!sourceState) return null;
  return saveSeasonState(
    params.targetSeason.seasonId,
    resetSeasonStateForClone(sourceState)
  );
};

export const listScoreAdjustments = async (
  seasonId: string
): Promise<ScoreAdjustment[]> => {
  try {
    const records = await pb
      .collection(SCORE_ADJUSTMENTS_COLLECTION)
      .getFullList<ScoreAdjustmentRecord>({
        filter: `seasonId="${escapeFilterValue(seasonId)}"`,
        sort: "-created",
        perPage: 500,
      });
    return records.map((record) => ({
      id: record.id,
      seasonId: record.seasonId,
      playerId: record.playerId,
      weekId: record.weekId,
      reason: record.reason,
      points: Number(record.points) || 0,
      createdBy: record.createdBy || "admin",
      createdAt: record.created || new Date().toISOString(),
    }));
  } catch (error) {
    if (isNotFound(error)) return [];
    logger.warn("listScoreAdjustments failed:", error);
    return [];
  }
};

export const createScoreAdjustment = async (input: {
  seasonId: string;
  playerId: string;
  weekId?: string;
  reason: string;
  points: number;
  createdBy: string;
}) => {
  const payload = {
    seasonId: input.seasonId,
    playerId: input.playerId,
    weekId: input.weekId || "",
    reason: input.reason.trim(),
    points: input.points,
    createdBy: input.createdBy.trim(),
  };
  const record = await pb.collection(SCORE_ADJUSTMENTS_COLLECTION).create(payload);
  return {
    id: record.id,
    seasonId: payload.seasonId,
    playerId: payload.playerId,
    weekId: payload.weekId || undefined,
    reason: payload.reason,
    points: payload.points,
    createdBy: payload.createdBy,
    createdAt: record.created || new Date().toISOString(),
  } as ScoreAdjustment;
};

export const deleteScoreAdjustment = async (id: string) => {
  await pb.collection(SCORE_ADJUSTMENTS_COLLECTION).delete(id);
};

export const fetchGameState = async (): Promise<{
  state: GameState;
  updatedAt?: number;
} | null> => {
  try {
    const record = await pb
      .collection(GAME_COLLECTION)
      .getFirstListItem(`slug="${GAME_SLUG}"`);
    const updatedAt = record.updated
      ? new Date(record.updated as string).getTime()
      : undefined;
    return { state: record.state as GameState, updatedAt };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

export const saveGameState = async (state: GameState) => {
  let existing: { id: string } | null = null;
  try {
    const record = await pb
      .collection(GAME_COLLECTION)
      .getFirstListItem(`slug="${GAME_SLUG}"`);
    existing = { id: record.id };
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (existing) {
    return pb.collection(GAME_COLLECTION).update(existing.id, {
      slug: GAME_SLUG,
      state,
    });
  }
  return pb.collection(GAME_COLLECTION).create({
    slug: GAME_SLUG,
    state,
  });
};

export const subscribeToGameState = (
  handler: (state: GameState, updatedAt?: number) => void
) => {
  const callback = (event: any) => {
    if (!event?.record) return;
    if (event.record.slug !== GAME_SLUG) return;
    const updatedAt = event.record.updated
      ? new Date(event.record.updated as string).getTime()
      : undefined;
    handler(event.record.state as GameState, updatedAt);
  };

  pb.collection(GAME_COLLECTION).subscribe("*", callback).catch((error) => {
    logger.warn("PocketBase subscription failed:", error);
  });

  return () => {
    pb.collection(GAME_COLLECTION).unsubscribe("*").catch(() => undefined);
  };
};

export const fetchPlayerPortraits = async () => {
  const records = await pb.collection(PORTRAITS_COLLECTION).getFullList({
    perPage: 500,
  });
  const portraits: Record<string, string> = {};
  records.forEach((record: any) => {
    const email = normalizeEmail(record.email || "");
    if (email && record.portraitUrl) {
      portraits[email] = record.portraitUrl as string;
    }
  });
  return portraits;
};

export const savePlayerPortrait = async (
  email: string,
  name: string,
  portraitUrl: string
) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  let existing: { id: string } | null = null;
  try {
    const record = await pb
      .collection(PORTRAITS_COLLECTION)
      .getFirstListItem(`email="${escapeFilterValue(normalized)}"`);
    existing = { id: record.id };
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (existing) {
    await pb.collection(PORTRAITS_COLLECTION).update(existing.id, {
      email: normalized,
      name,
      portraitUrl,
    });
  } else {
    await pb.collection(PORTRAITS_COLLECTION).create({
      email: normalized,
      name,
      portraitUrl,
    });
  }
};


export interface SubmissionRecord extends RecordModel {
  name: string;
  email: string;
  kind: string;
  seasonId?: string;
  weekId?: string;
  submissionStatus?: SubmissionStatus;
  rulePackId?: string;
  league?: string;
  weeklyBanished?: string;
  weeklyMurdered?: string;
  payload?: unknown;
  created?: string;
  updated?: string;
}

const sortSubmissions = (items: SubmissionRecord[]) =>
  [...items].sort((a, b) => (b.id || "").localeCompare(a.id || ""));

const isWeeklySubmissionRecord = (item: SubmissionRecord) => {
  const kind = String(item.kind ?? "").trim().toLowerCase();
  if (kind === "weekly") return true;
  if (kind) return false;

  // Some API responses can omit `kind`; keep weekly records visible by shape.
  const payload = item.payload as
    | {
        weeklyPredictions?: {
          nextBanished?: string;
          nextMurdered?: string;
          bonusGames?: {
            redemptionRoulette?: string;
            shieldGambit?: string;
            doubleOrNothing?: boolean;
            traitorTrio?: string[];
          };
          finalePredictions?: {
            finalWinner?: string;
            lastFaithfulStanding?: string;
            lastTraitorStanding?: string;
            finalPotEstimate?: number | null;
          };
        };
        bonusGames?: {
          redemptionRoulette?: string;
          shieldGambit?: string;
          doubleOrNothing?: boolean;
          traitorTrio?: string[];
        };
        finalePredictions?: {
          finalWinner?: string;
          lastFaithfulStanding?: string;
          lastTraitorStanding?: string;
          finalPotEstimate?: number | null;
        };
      }
    | undefined;

  const bonusGames = payload?.weeklyPredictions?.bonusGames ?? payload?.bonusGames;
  const finalePredictions =
    payload?.weeklyPredictions?.finalePredictions ?? payload?.finalePredictions;

  const hasWeeklyFields =
    typeof item.weeklyBanished === "string" ||
    typeof item.weeklyMurdered === "string";
  const hasWeeklyPayload =
    typeof payload?.weeklyPredictions?.nextBanished === "string" ||
    typeof payload?.weeklyPredictions?.nextMurdered === "string";
  const hasBonusPayload =
    typeof bonusGames?.redemptionRoulette === "string" ||
    typeof bonusGames?.shieldGambit === "string" ||
    Array.isArray(bonusGames?.traitorTrio) ||
    typeof bonusGames?.doubleOrNothing === "boolean";
  const hasFinalePayload =
    typeof finalePredictions?.finalWinner === "string" ||
    typeof finalePredictions?.lastFaithfulStanding === "string" ||
    typeof finalePredictions?.lastTraitorStanding === "string" ||
    typeof finalePredictions?.finalPotEstimate === "number";

  return hasWeeklyFields || hasWeeklyPayload || hasBonusPayload || hasFinalePayload;
};

const normalizeWeeklySubmissions = (items: unknown): SubmissionRecord[] => {
  if (!Array.isArray(items)) return [];
  return sortSubmissions(
    (items as SubmissionRecord[]).filter(
      (item) => Boolean(item) && isWeeklySubmissionRecord(item)
    )
  );
};

const buildActiveSubmissionFilter = (seasonId?: string | null) => {
  const normalizedSeasonId = normalizeWeekId(seasonId);
  const seasonFilter = normalizedSeasonId
    ? `seasonId="${escapeFilterValue(normalizedSeasonId)}" && `
    : "";
  return `${seasonFilter}((kind="weekly" && (submissionStatus="" || submissionStatus="new")) || kind="")`;
};

export const fetchWeeklySubmissions = async (input?: {
  seasonId?: string | null;
}): Promise<SubmissionRecord[]> => {
  const activeSubmissionFilter = buildActiveSubmissionFilter(input?.seasonId);
  try {
    const perPage = 200;
    const firstPage = await pb
      .collection(SUBMISSIONS_COLLECTION)
      .getList<SubmissionRecord>(1, perPage, {
        sort: SUBMISSIONS_SORT,
        filter: activeSubmissionFilter,
      });
    const items = [...firstPage.items];
    for (let page = 2; page <= firstPage.totalPages; page += 1) {
      const nextPage = await pb
        .collection(SUBMISSIONS_COLLECTION)
        .getList<SubmissionRecord>(page, perPage, {
          sort: SUBMISSIONS_SORT,
          filter: activeSubmissionFilter,
        });
      items.push(...nextPage.items);
    }
    const normalized = normalizeWeeklySubmissions(items);
    logger.log(
      `fetchWeeklySubmissions: Loaded ${normalized.length} submissions via SDK`
    );
    return normalized;
  } catch (error) {
    logger.warn("PocketBase SDK submissions fetch failed:", error);
  }

  // Fallback: use fetch with and without sort/filter variants.
  try {
    const headers: Record<string, string> = {};
    if (pb.authStore.token) {
      headers["Authorization"] = pb.authStore.token;
    }
    const queryVariants = [
      { perPage: "200", sort: SUBMISSIONS_SORT, filter: activeSubmissionFilter },
      { perPage: "200", filter: activeSubmissionFilter },
      { perPage: "200", sort: SUBMISSIONS_SORT },
      { perPage: "200" },
    ];

    for (const query of queryVariants) {
      const params = new URLSearchParams(query);
      const url = `${pocketbaseUrl}/api/collections/${SUBMISSIONS_COLLECTION}/records?${params.toString()}`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        logger.warn(
          `Fallback submissions fetch failed (${response.status}) for ${params.toString()}`
        );
        continue;
      }
      const data = (await response.json()) as { items?: SubmissionRecord[] };
      const normalized = normalizeWeeklySubmissions(data.items);
      if (normalized.length > 0) {
        logger.log(
          `fetchWeeklySubmissions: Loaded ${normalized.length} submissions via fallback`
        );
        return normalized;
      }
    }

    return [];
  } catch (fallbackError) {
    logger.warn("Fallback submissions fetch failed:", fallbackError);
    return [];
  }
};

export const subscribeToWeeklySubmissions = (
  handler: (submission: SubmissionRecord) => void
) => {
  if (!pb.authStore.isValid) {
    logger.warn("subscribeToWeeklySubmissions: Admin not authenticated, skipping subscription");
    return () => {};
  }

  const callback = (event: any) => {
    const record = event?.record as SubmissionRecord | undefined;
    if (!record || record.kind !== "weekly") return;
    if (record.submissionStatus && record.submissionStatus !== "new") return;
    if (event?.action !== "create") return;
    logger.log("New weekly submission received:", record.id, record.name);
    handler(record);
  };

  pb.collection(SUBMISSIONS_COLLECTION).subscribe("*", callback).then(() => {
    logger.log("Subscribed to weekly submissions");
  }).catch((error) => {
    logger.warn("PocketBase submission subscription failed:", error);
  });

  return () => {
    pb.collection(SUBMISSIONS_COLLECTION).unsubscribe("*").catch(() => undefined);
  };
};

export const deleteSubmission = async (id: string) => {
  await pb.collection(SUBMISSIONS_COLLECTION).delete(id);
};

export const markSubmissionMerged = async (id: string) => {
  try {
    await pb.collection(SUBMISSIONS_COLLECTION).update(id, {
      kind: "weekly_merged",
      submissionStatus: "merged",
    });
  } catch (error: any) {
    if (error?.status === 400 || error?.response?.code === 400) {
      await pb.collection(SUBMISSIONS_COLLECTION).update(id, {
        kind: "weekly_merged",
      });
      return;
    }
    throw error;
  }
};

export const markSubmissionSkipped = async (
  id: string,
  status: "skipped_late" | "skipped_stale"
) => {
  try {
    await pb.collection(SUBMISSIONS_COLLECTION).update(id, {
      submissionStatus: status,
    });
  } catch (error: any) {
    if (error?.status === 400 || error?.response?.code === 400) return;
    throw error;
  }
};

export const submitWeeklyCouncilVote = async (input: {
  name: string;
  email: string;
  weeklyPredictions: { nextBanished: string; nextMurdered: string };
  weekId?: string;
  seasonId?: string;
  rulePackId?: string;
  bonusGames?: {
    redemptionRoulette?: string;
    doubleOrNothing?: boolean;
    shieldGambit?: string;
    traitorTrio?: string[];
  };
  finalePredictions?: FinalePredictions;
  league?: string;
}) => {
  const normalizedEmail = normalizeEmail(input.email || "");
  const normalizedWeekId =
    typeof input.weekId === "string" ? input.weekId.trim() : "";
  const nextPayload = {
    name: input.name,
    email: normalizedEmail,
    kind: "weekly",
    seasonId: input.seasonId || "",
    weekId: normalizedWeekId,
    submissionStatus: "new",
    rulePackId: input.rulePackId || "",
    weeklyBanished: input.weeklyPredictions?.nextBanished || "",
    weeklyMurdered: input.weeklyPredictions?.nextMurdered || "",
    payload: {
      league: input.league || "main",
      seasonId: input.seasonId || "",
      rulePackId: input.rulePackId || "",
      weekId: normalizedWeekId,
      weeklyPredictions: {
        weekId: normalizedWeekId,
        nextBanished: input.weeklyPredictions?.nextBanished || "",
        nextMurdered: input.weeklyPredictions?.nextMurdered || "",
        bonusGames: {
          redemptionRoulette: input.bonusGames?.redemptionRoulette || "",
          doubleOrNothing: Boolean(input.bonusGames?.doubleOrNothing),
          shieldGambit: input.bonusGames?.shieldGambit || "",
          traitorTrio: input.bonusGames?.traitorTrio ?? [],
        },
        finalePredictions: {
          finalWinner: input.finalePredictions?.finalWinner || "",
          lastFaithfulStanding: input.finalePredictions?.lastFaithfulStanding || "",
          lastTraitorStanding: input.finalePredictions?.lastTraitorStanding || "",
          finalPotEstimate:
            typeof input.finalePredictions?.finalPotEstimate === "number" &&
            Number.isFinite(input.finalePredictions.finalPotEstimate)
              ? input.finalePredictions.finalPotEstimate
              : null,
        },
      },
    },
  };
  try {
    return await pb.collection(SUBMISSIONS_COLLECTION).create(nextPayload);
  } catch (error: any) {
    if (error?.status !== 400 && error?.response?.code !== 400) throw error;
    // Backward compatibility for legacy schema before season shell fields exist.
    const legacyPayload = {
      name: nextPayload.name,
      email: nextPayload.email,
      kind: nextPayload.kind,
      weeklyBanished: nextPayload.weeklyBanished,
      weeklyMurdered: nextPayload.weeklyMurdered,
      payload: nextPayload.payload,
    };
    return pb.collection(SUBMISSIONS_COLLECTION).create(legacyPayload);
  }
};

export const submitDraftEntry = async (entry: {
  name: string;
  email: string;
  picks?: unknown;
  predFirstOut?: string;
  predWinner?: string;
  predTraitors?: unknown;
  weeklyPredictions?: { nextBanished: string; nextMurdered: string };
}) => {
  const normalizedEmail = normalizeEmail(entry.email || "");
  return pb.collection(SUBMISSIONS_COLLECTION).create({
    name: entry.name,
    email: normalizedEmail,
    kind: "draft",
    weeklyBanished: entry.weeklyPredictions?.nextBanished || "",
    weeklyMurdered: entry.weeklyPredictions?.nextMurdered || "",
    payload: entry,
  });
};

export const submitGrowthEvent = async (input: {
  event: "invite_share_clicked" | "invite_link_opened";
  name?: string;
  email?: string;
  payload?: Record<string, unknown>;
}) => {
  const normalizedEmail = normalizeEmail(input.email || "");
  return pb.collection(SUBMISSIONS_COLLECTION).create({
    name: input.name?.trim() || "growth",
    email: normalizedEmail || "growth@local",
    kind: "growth",
    payload: {
      event: input.event,
      ...input.payload,
    },
  });
};
