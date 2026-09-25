import type { GameState } from "../../types";
import { supabase } from "../lib/supabase";
import { createSupabaseAdmin } from "../lib/supabaseAdmin";
import {
  buildPublicWeeklyRecap,
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
 * buildPublicWeeklyRecap before anything is rendered.
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
