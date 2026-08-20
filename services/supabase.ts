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
import { supabase, supabaseUrl } from "../src/lib/supabase";
import type { Database } from "../src/types/database";
import { DEFAULT_SHOW_CONFIG, DEFAULT_SHOW_SLUG } from "../src/config/defaultShowConfig";
import { sanitizeSeasonConfig, sanitizeShowConfig } from "../src/config/validation";
import { logger } from "../src/utils/logger";

export { supabaseUrl };

const GAME_SLUG = DEFAULT_SHOW_SLUG;

// ── helpers ───────────────────────────────────────────────────────────────────

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// PGRST116 = no rows from .single(); 22P02 = invalid uuid input
const isNotFound = (error: { code?: string } | null) =>
  error?.code === "PGRST116" || error?.code === "22P02";

type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];
type SubmissionRow = Database["public"]["Tables"]["submissions"]["Row"];

// Map Supabase snake_case season row → camelCase shape sanitizeSeasonConfig expects
const seasonRowToInput = (row: SeasonRow) => ({
  seasonId: row.season_id,
  label: row.label,
  status: row.status,
  timezone: row.timezone,
  lockSchedule: row.lock_schedule,
  activeWeekId: row.active_week_id ?? undefined,
  finaleConfig: row.finale_config,
  rulePackId: row.rule_pack_id ?? undefined,
});

// ── SubmissionRecord ──────────────────────────────────────────────────────────

export interface SubmissionRecord {
  id: string;
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
  collectionId?: string;
  collectionName?: string;
  expand?: Record<string, unknown>;
}

const rowToSubmissionRecord = (row: SubmissionRow): SubmissionRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  kind: row.kind,
  seasonId: row.season_id ?? undefined,
  weekId: row.week_id ?? undefined,
  submissionStatus: (row.submission_status as SubmissionStatus) ?? "new",
  rulePackId: row.rule_pack_id ?? undefined,
  league: row.league ?? undefined,
  weeklyBanished: row.weekly_banished ?? undefined,
  weeklyMurdered: row.weekly_murdered ?? undefined,
  payload: row.payload,
  created: row.created_at,
  updated: row.updated_at,
  collectionId: "",
  collectionName: "submissions",
  expand: {},
});

// ── interfaces (type-compatibility shims) ─────────────────────────────────────

export interface ShowConfigRecord {
  slug: string;
  config: ShowConfig;
}

export interface SeasonRecord extends SeasonConfig {}

export interface SeasonStateRecord {
  seasonId: string;
  state: SeasonState;
}

export interface ScoreAdjustmentRecord {
  seasonId: string;
  playerId: string;
  weekId?: string;
  reason: string;
  points: number;
  createdBy?: string;
}

// ── auth ──────────────────────────────────────────────────────────────────────

export const onAdminAuthChange = (callback: (isAuthed: boolean) => void) => {
  // Fire immediately with current state
  supabase.auth.getSession().then(({ data: { session } }) => {
    callback(!!session?.user);
  });
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(!!session?.user);
  });
  return () => subscription.unsubscribe();
};

export const signInAdmin = async (email: string, password: string): Promise<boolean> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user!.id)
    .single();
  if (!adminRow) {
    await supabase.auth.signOut();
    throw new Error("Not an admin user");
  }
  return true;
};

export const signOutAdmin = () => {
  supabase.auth.signOut();
};

// ── show config ───────────────────────────────────────────────────────────────

export const fetchShowConfig = async (slug = DEFAULT_SHOW_SLUG): Promise<ShowConfig | null> => {
  try {
    const { data, error } = await supabase
      .from("show_configs")
      .select("config")
      .eq("slug", slug)
      .single();
    if (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
    return sanitizeShowConfig(data.config);
  } catch (error) {
    logger.warn("fetchShowConfig failed:", error);
    return null;
  }
};

export const saveShowConfig = async (config: ShowConfig, slug = DEFAULT_SHOW_SLUG) => {
  const sanitized = sanitizeShowConfig({ ...config, slug });
  const { error } = await supabase
    .from("show_configs")
    .upsert(
      { slug, config: sanitized as unknown as Database["public"]["Tables"]["show_configs"]["Insert"]["config"], updated_at: new Date().toISOString() },
      { onConflict: "slug" }
    );
  if (error) throw error;
};

export const ensureDefaultShowConfig = async (): Promise<ShowConfig> => {
  const existing = await fetchShowConfig(DEFAULT_SHOW_SLUG);
  if (existing) return existing;
  await saveShowConfig(DEFAULT_SHOW_CONFIG, DEFAULT_SHOW_SLUG);
  return DEFAULT_SHOW_CONFIG;
};

// ── seasons ───────────────────────────────────────────────────────────────────

export const listSeasons = async (): Promise<SeasonConfig[]> => {
  try {
    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((row) => sanitizeSeasonConfig(seasonRowToInput(row), row.season_id));
  } catch (error) {
    logger.warn("listSeasons failed:", error);
    return [];
  }
};

export const createSeason = async (input: SeasonConfig) => {
  const season = sanitizeSeasonConfig(input, input.seasonId);
  const { error } = await supabase.from("seasons").insert({
    season_id: season.seasonId,
    label: season.label,
    status: season.status,
    timezone: season.timezone,
    lock_schedule: season.lockSchedule as unknown as Database["public"]["Tables"]["seasons"]["Insert"]["lock_schedule"],
    active_week_id: season.activeWeekId ?? null,
    finale_config: (season.finaleConfig as unknown as Database["public"]["Tables"]["seasons"]["Insert"]["finale_config"]) ?? null,
    rule_pack_id: season.rulePackId ?? null,
  });
  if (error) throw error;
};

export const updateSeason = async (seasonId: string, updates: Partial<SeasonConfig>) => {
  type SeasonUpdate = Database["public"]["Tables"]["seasons"]["Update"];
  const patch: SeasonUpdate = { updated_at: new Date().toISOString() };
  if (updates.label !== undefined) patch.label = updates.label;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.timezone !== undefined) patch.timezone = updates.timezone;
  if (updates.lockSchedule !== undefined) patch.lock_schedule = updates.lockSchedule as SeasonUpdate["lock_schedule"];
  if (updates.activeWeekId !== undefined) patch.active_week_id = updates.activeWeekId;
  if (updates.finaleConfig !== undefined) patch.finale_config = updates.finaleConfig as unknown as SeasonUpdate["finale_config"];
  if (updates.rulePackId !== undefined) patch.rule_pack_id = updates.rulePackId;
  const { error } = await supabase.from("seasons").update(patch).eq("season_id", seasonId);
  if (error) throw error;
};

export const archiveSeason = (seasonId: string) => updateSeason(seasonId, { status: "archived" });
export const finalizeSeason = (seasonId: string) => updateSeason(seasonId, { status: "finalized" });

// ── season state ──────────────────────────────────────────────────────────────

export const fetchSeasonState = async (seasonId: string): Promise<SeasonState | null> => {
  try {
    const { data, error } = await supabase
      .from("season_states")
      .select("state")
      .eq("season_id", seasonId)
      .single();
    if (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
    return { ...(data.state as unknown as SeasonState), seasonId };
  } catch (error) {
    if (isNotFound(error as { code?: string })) return null;
    throw error;
  }
};

export const saveSeasonState = async (seasonId: string, state: SeasonState): Promise<{ updated: string }> => {
  const now = new Date().toISOString();
  const { error } = await supabase.from("season_states").upsert(
    {
      season_id: seasonId,
      state: { ...state, seasonId } as unknown as Database["public"]["Tables"]["season_states"]["Insert"]["state"],
      updated_at: now,
    },
    { onConflict: "season_id" }
  );
  if (error) throw error;
  return { updated: now };
};

const resetSeasonStateForClone = (state: SeasonState): SeasonState => {
  const castStatus = Object.fromEntries(
    Object.entries(state.castStatus || {}).map(([name, status]) => [
      name,
      { ...status, isWinner: false, isFirstOut: false, isTraitor: false, isEliminated: false },
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
      bonusGames: { redemptionRoulette: "", shieldGambit: "", traitorTrio: [] },
      finaleResults: { finalWinner: "", lastFaithfulStanding: "", lastTraitorStanding: "", finalPotValue: null },
    },
    activeWeekId: "week-1",
    weeklySubmissionHistory: [],
    weeklyScoreHistory: [],
    scoreAdjustments: [],
  };
};

export const cloneSeason = async (params: { sourceSeasonId: string; targetSeason: SeasonConfig }) => {
  const sourceState = await fetchSeasonState(params.sourceSeasonId);
  await createSeason(params.targetSeason);
  if (!sourceState) return null;
  return saveSeasonState(params.targetSeason.seasonId, resetSeasonStateForClone(sourceState));
};

// ── score adjustments ─────────────────────────────────────────────────────────

export const listScoreAdjustments = async (seasonId: string): Promise<ScoreAdjustment[]> => {
  try {
    const { data, error } = await supabase
      .from("score_adjustments")
      .select("*")
      .eq("season_id", seasonId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      seasonId: row.season_id,
      playerId: row.player_id,
      weekId: row.week_id ?? undefined,
      reason: row.reason,
      points: Number(row.points) || 0,
      createdBy: row.created_by_label || "admin",
      createdAt: row.created_at || new Date().toISOString(),
    }));
  } catch (error) {
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
}): Promise<ScoreAdjustment> => {
  const { data, error } = await supabase
    .from("score_adjustments")
    .insert({
      season_id: input.seasonId,
      player_id: input.playerId,
      week_id: input.weekId || null,
      reason: input.reason.trim(),
      points: input.points,
      created_by_label: input.createdBy.trim(),
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    seasonId: data.season_id,
    playerId: data.player_id,
    weekId: data.week_id ?? undefined,
    reason: data.reason,
    points: data.points,
    createdBy: data.created_by_label || "admin",
    createdAt: data.created_at,
  };
};

export const deleteScoreAdjustment = async (id: string) => {
  const { error } = await supabase.from("score_adjustments").delete().eq("id", id);
  if (error) throw error;
};

// ── game state ────────────────────────────────────────────────────────────────

export const fetchGameState = async (): Promise<{ state: GameState; updatedAt?: number } | null> => {
  try {
    const { data, error } = await supabase
      .from("games")
      .select("state, updated_at")
      .eq("slug", GAME_SLUG)
      .single();
    if (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
    return {
      state: data.state as unknown as GameState,
      updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined,
    };
  } catch (error) {
    if (isNotFound(error as { code?: string })) return null;
    throw error;
  }
};

export const saveGameState = async (state: GameState): Promise<{ updated: string }> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("games")
    .upsert(
      { slug: GAME_SLUG, state: state as unknown as Database["public"]["Tables"]["games"]["Insert"]["state"], updated_at: now },
      { onConflict: "slug" }
    );
  if (error) throw error;
  return { updated: now };
};

export const subscribeToGameState = (handler: (state: GameState, updatedAt?: number) => void) => {
  const channel = supabase
    .channel("game-state-changes")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "games", filter: `slug=eq.${GAME_SLUG}` },
      (payload) => {
        const record = payload.new as { state?: unknown; updated_at?: string };
        if (!record?.state) return;
        const updatedAt = record.updated_at ? new Date(record.updated_at).getTime() : undefined;
        handler(record.state as unknown as GameState, updatedAt);
      }
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") logger.warn("Supabase game state subscription failed");
    });
  return () => { supabase.removeChannel(channel); };
};

// ── player portraits ──────────────────────────────────────────────────────────

export const fetchPlayerPortraits = async (): Promise<Record<string, string>> => {
  const { data, error } = await supabase
    .from("player_portraits")
    .select("email, portrait_url")
    .limit(500);
  if (error) {
    logger.warn("fetchPlayerPortraits failed:", error);
    return {};
  }
  const portraits: Record<string, string> = {};
  (data ?? []).forEach((row) => {
    const email = normalizeEmail(row.email || "");
    if (email && row.portrait_url) portraits[email] = row.portrait_url;
  });
  return portraits;
};

export const savePlayerPortrait = async (email: string, name: string, portraitUrl: string) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const { error } = await supabase
    .from("player_portraits")
    .upsert(
      { email: normalized, name, portrait_url: portraitUrl, updated_at: new Date().toISOString() },
      { onConflict: "email" }
    );
  if (error) throw error;
};

// ── submissions ───────────────────────────────────────────────────────────────

const sortSubmissions = (items: SubmissionRecord[]) =>
  [...items].sort((a, b) => (b.created || "").localeCompare(a.created || ""));

const isWeeklySubmissionRecord = (item: SubmissionRecord): boolean => {
  const kind = String(item.kind ?? "").trim().toLowerCase();
  if (kind === "weekly") return true;
  if (kind) return false;
  const payload = item.payload as Record<string, unknown> | undefined;
  const bonusGames =
    (payload?.weeklyPredictions as Record<string, unknown> | undefined)?.bonusGames ??
    payload?.bonusGames;
  const finalePredictions =
    (payload?.weeklyPredictions as Record<string, unknown> | undefined)?.finalePredictions ??
    payload?.finalePredictions;
  const hasWeeklyFields =
    typeof item.weeklyBanished === "string" || typeof item.weeklyMurdered === "string";
  const hasWeeklyPayload =
    typeof (payload?.weeklyPredictions as Record<string, unknown> | undefined)?.nextBanished === "string" ||
    typeof (payload?.weeklyPredictions as Record<string, unknown> | undefined)?.nextMurdered === "string";
  const bg = bonusGames as Record<string, unknown> | undefined;
  const hasBonusPayload =
    typeof bg?.redemptionRoulette === "string" ||
    typeof bg?.shieldGambit === "string" ||
    Array.isArray(bg?.traitorTrio) ||
    typeof bg?.doubleOrNothing === "boolean";
  const fp = finalePredictions as Record<string, unknown> | undefined;
  const hasFinalePayload =
    typeof fp?.finalWinner === "string" ||
    typeof fp?.lastFaithfulStanding === "string" ||
    typeof fp?.lastTraitorStanding === "string" ||
    typeof fp?.finalPotEstimate === "number";
  return hasWeeklyFields || hasWeeklyPayload || hasBonusPayload || hasFinalePayload;
};

const normalizeWeeklySubmissions = (items: SubmissionRecord[]): SubmissionRecord[] =>
  sortSubmissions(items.filter((item) => Boolean(item) && isWeeklySubmissionRecord(item)));

export const fetchWeeklySubmissions = async (input?: {
  seasonId?: string | null;
}): Promise<SubmissionRecord[]> => {
  try {
    const normalizedSeasonId = normalizeWeekId(input?.seasonId);
    let query = supabase
      .from("submissions")
      .select("*")
      .eq("kind", "weekly")
      .eq("submission_status", "new")
      .order("created_at", { ascending: false })
      .limit(200);
    if (normalizedSeasonId) {
      query = query.eq("season_id", normalizedSeasonId);
    }
    const { data, error } = await query;
    if (error) throw error;
    const records = (data ?? []).map(rowToSubmissionRecord);
    const normalized = normalizeWeeklySubmissions(records);
    logger.log(`fetchWeeklySubmissions: Loaded ${normalized.length} submissions`);
    return normalized;
  } catch (error) {
    logger.warn("fetchWeeklySubmissions failed:", error);
    return [];
  }
};

export const subscribeToWeeklySubmissions = (handler: (submission: SubmissionRecord) => void) => {
  const channel = supabase
    .channel("weekly-submissions")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "submissions", filter: "kind=eq.weekly" },
      (payload) => {
        const record = payload.new as SubmissionRow;
        if (!record) return;
        const submission = rowToSubmissionRecord(record);
        if (submission.submissionStatus && submission.submissionStatus !== "new") return;
        logger.log("New weekly submission received:", submission.id, submission.name);
        handler(submission);
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") logger.log("Subscribed to weekly submissions");
      else if (status === "CHANNEL_ERROR") logger.warn("Supabase submission subscription failed");
    });
  return () => { supabase.removeChannel(channel); };
};

export const deleteSubmission = async (id: string) => {
  const { error } = await supabase.from("submissions").delete().eq("id", id);
  if (error) throw error;
};

export const markSubmissionMerged = async (id: string) => {
  const { error } = await supabase
    .from("submissions")
    .update({ kind: "weekly_merged", submission_status: "merged", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
};

export const markSubmissionSkipped = async (id: string, status: "skipped_late" | "skipped_stale") => {
  const { error } = await supabase
    .from("submissions")
    .update({ submission_status: status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
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
  const normalizedWeekId = typeof input.weekId === "string" ? input.weekId.trim() : "";
  const league = input.league === "jr" ? "jr" : input.league === "main" ? "main" : null;
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      name: input.name,
      email: normalizedEmail,
      kind: "weekly",
      season_id: input.seasonId || null,
      week_id: normalizedWeekId || null,
      submission_status: "new",
      rule_pack_id: input.rulePackId || null,
      league,
      weekly_banished: input.weeklyPredictions?.nextBanished || null,
      weekly_murdered: input.weeklyPredictions?.nextMurdered || null,
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
    })
    .select()
    .single();
  if (error) throw error;
  return data;
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
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      name: entry.name,
      email: normalizedEmail,
      kind: "draft",
      weekly_banished: entry.weeklyPredictions?.nextBanished || null,
      weekly_murdered: entry.weeklyPredictions?.nextMurdered || null,
      payload: entry as unknown as Database["public"]["Tables"]["submissions"]["Insert"]["payload"],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const submitGrowthEvent = async (input: {
  event: "invite_share_clicked" | "invite_link_opened";
  name?: string;
  email?: string;
  payload?: Record<string, unknown>;
}) => {
  const normalizedEmail = normalizeEmail(input.email || "");
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      name: input.name?.trim() || "growth",
      email: normalizedEmail || "growth@local",
      kind: "growth",
      payload: { event: input.event, ...input.payload } as unknown as Database["public"]["Tables"]["submissions"]["Insert"]["payload"],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};
