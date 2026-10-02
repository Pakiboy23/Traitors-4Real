import type { GameState } from "../../types";
import { supabase } from "../lib/supabase";
import { createSupabaseAdmin } from "../lib/supabaseAdmin";
import {
  buildPublicRecapIndex,
  buildPublicWeeklyRecap,
  emptyPublicRecapIndex,
  isShortRecapWeek,
  type PublicRecapIndex,
  type PublicWeeklyRecap,
} from "./weeklyRecap";

export type LoadedPublicRecap =
  | { status: "published"; recap: PublicWeeklyRecap }
  | { status: "unpublished" }
  | { status: "missing" }
  | { status: "error" };

interface RecapRpcPayload {
  found?: boolean;
  published?: boolean;
  state?: GameState;
}

const functionIsMissing = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  const message = error.message ?? "";
  return /published_weekly_recap/i.test(message) || /schema cache/i.test(message);
};

/** Anon cannot execute the function. Fall back to the existing season read. */
const functionIsForbidden = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (error.code === "42501" || error.code === "PGRST301") return true;
  return /permission denied/i.test(error.message ?? "");
};

const fromState = (state: GameState | null | undefined, seasonId: string, weekId: string): LoadedPublicRecap => {
  if (!state) return { status: "missing" };
  const recap = buildPublicWeeklyRecap({ ...state, seasonId }, weekId);
  if (!recap) return { status: "missing" };
  if (!recap.published) return { status: "unpublished" };
  return { status: "published", recap };
};

const fromRpcPayload = (
  data: unknown,
  seasonId: string,
  weekId: string
): LoadedPublicRecap => {
  if (!data || typeof data !== "object") return { status: "error" };
  const payload = data as RecapRpcPayload;
  if (payload.found === false) return { status: "missing" };
  if (payload.published !== true) return { status: "unpublished" };
  return fromState(payload.state, seasonId, weekId);
};

/**
 * Anonymous recap read.
 *
 * Prefers published_weekly_recap() with the service-role key. That function
 * returns nothing useful until the week is published, and it is not granted
 * to anon. Until the migration is applied, or when the server key is unset,
 * falls back to season_states and strips the public projection in
 * buildPublicWeeklyRecap before anything is rendered. That projection drops
 * every email, pick, and prediction whether or not the row still stores them.
 * Draft #183 moves the email strip into the database; this page does not
 * wait on that view.
 */
export const loadPublicWeeklyRecap = async (
  seasonId: string,
  weekId: string
): Promise<LoadedPublicRecap> => {
  try {
    const client = createSupabaseAdmin() ?? supabase;
    const rpc = await client.rpc("published_weekly_recap", {
      p_season_id: seasonId,
      p_week_id: weekId,
    });
    if (rpc.error) {
      if (!functionIsMissing(rpc.error) && !functionIsForbidden(rpc.error)) {
        return { status: "error" };
      }
      return loadFromSeasonState(seasonId, weekId);
    }
    return fromRpcPayload(rpc.data, seasonId, weekId);
  } catch {
    return { status: "error" };
  }
};

const loadFromSeasonState = async (
  seasonId: string,
  weekId: string
): Promise<LoadedPublicRecap> => {
  const { data, error } = await supabase
    .from("season_states")
    .select("state")
    .eq("season_id", seasonId)
    .maybeSingle();
  if (error) return { status: "error" };
  if (!data?.state) return { status: "missing" };
  return fromState(data.state as unknown as GameState, seasonId, weekId);
};

export const loadLiveSeasonId = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from("seasons")
      .select("season_id")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error || !data?.[0]) return null;
    return data[0].season_id;
  } catch {
    return null;
  }
};

export type LoadedPublicRecapIndex =
  | { status: "ready"; index: PublicRecapIndex }
  | { status: "missing" }
  | { status: "error" };

const relationIsMissing = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  const message = error.message ?? "";
  return /schema cache/i.test(message) && /not found/i.test(message);
};

const stateFromRow = (value: unknown): GameState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as GameState;
};

/**
 * Season row the public recap hub reads.
 *
 * Week pages call published_weekly_recap() for one week. That function reads
 * the same season_states JSON and returns nothing until weeklyRecaps marks
 * the week published. The hub needs every published week, so it reads
 * season_states_public (emails already stripped) and projects with
 * buildPublicRecapIndex. A missing view falls back to season_states, the
 * same fallback the week page uses. The returned index is only week labels,
 * intros, and dates — players, picks, and emails stay off it.
 */
const readRecapIndexState = async (
  seasonId: string
): Promise<{ status: "ready"; state: GameState } | { status: "missing" } | { status: "error" }> => {
  const primary = await supabase
    .from("season_states_public")
    .select("state")
    .eq("season_id", seasonId)
    .maybeSingle();
  if (!primary.error) {
    const state = stateFromRow(primary.data?.state);
    return state ? { status: "ready", state } : { status: "missing" };
  }
  if (!relationIsMissing(primary.error)) return { status: "error" };

  const fallback = await supabase
    .from("season_states")
    .select("state")
    .eq("season_id", seasonId)
    .maybeSingle();
  if (fallback.error) return { status: "error" };
  const state = stateFromRow(fallback.data?.state);
  return state ? { status: "ready", state } : { status: "missing" };
};

const readSeasonLabel = async (
  seasonId: string
): Promise<{ status: "ready"; label: string } | { status: "missing" } | { status: "error" }> => {
  const { data, error } = await supabase
    .from("seasons")
    .select("label")
    .eq("season_id", seasonId)
    .maybeSingle();
  if (error) return { status: "error" };
  if (!data) return { status: "missing" };
  const label = typeof data.label === "string" ? data.label.trim() : "";
  return { status: "ready", label: label || seasonId };
};

export const loadPublicRecapIndex = async (
  seasonIdInput: string
): Promise<LoadedPublicRecapIndex> => {
  const seasonId = seasonIdInput.trim();
  if (!seasonId || isShortRecapWeek(seasonId)) return { status: "missing" };
  try {
    const loaded = await readRecapIndexState(seasonId);
    if (loaded.status === "error") return { status: "error" };
    if (loaded.status === "ready") {
      const index = buildPublicRecapIndex(loaded.state, seasonId);
      return index ? { status: "ready", index } : { status: "missing" };
    }
    const season = await readSeasonLabel(seasonId);
    if (season.status === "error") return { status: "error" };
    if (season.status === "missing") return { status: "missing" };
    return { status: "ready", index: emptyPublicRecapIndex(seasonId, season.label) };
  } catch {
    return { status: "error" };
  }
};
