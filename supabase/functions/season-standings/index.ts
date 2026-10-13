import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { DEFAULT_SHOW_SLUG } from "../../../src/config/defaultShowConfig.ts";
import { redactPublicSeasonState } from "../../../src/utils/publicRedaction.ts";
import {
  collectScoreAdjustmentRows,
  scoreAdjustmentsFromRows,
  standingsResponseFromRecords,
  stateWithAuthoritativeAdjustments,
  type ScoreAdjustmentRow,
  type SeasonStandingsRecord,
} from "../../../src/utils/publishedStandings.ts";

/**
 * Public standings for one season.
 *
 * Home and the Leaderboard render this payload instead of scoring on the
 * device. The math is publishedStandings.ts, the same module the website
 * uses. Deploying this
 * function is what ships a scoring change to every app build that calls it.
 * There is no SQL migration.
 *
 * Do not deploy from a pull request. After the commit is on main:
 *
 *   supabase functions deploy season-standings --project-ref tpjiqegneohtbcxapqnq
 *
 * Verify, with the anon key (standings are public; this does not use the
 * service role outside the function):
 *
 *   curl -sS -X POST "$SUPABASE_URL/functions/v1/season-standings" \
 *     -H "Authorization: Bearer $ANON_KEY" \
 *     -H "apikey: $ANON_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{"seasonId":"traitors-new-blood-s1"}'
 *
 * Order:
 *   1. Deploy this function from the main commit that contains it.
 *   2. The Vercel deploy of that same commit starts calling it. Until the
 *      function exists, the site keeps the local board (current behavior).
 *   3. The next App Store binary includes the client. Further scoring
 *      changes need this function redeployed. They do not need a new binary.
 *
 * The gateway still requires the anon JWT. The function reads with the
 * service role through season_states_public and score_adjustments, and
 * returns only scores, names, ranks, and week deltas. Player ids in that
 * payload are public roster ids, never email addresses.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const SEASON_COLUMNS =
  "season_id,label,status,timezone,lock_schedule,active_week_id,finale_config,rule_pack_id";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Use POST." });
  }

  let seasonId = "";
  try {
    const body = (await req.json()) as { seasonId?: unknown };
    seasonId = typeof body.seasonId === "string" ? body.seasonId.trim() : "";
  } catch {
    seasonId = "";
  }
  if (!seasonId) {
    return json(400, { error: "Season id is required." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Standings are unavailable." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const seasonResult = await supabase
    .from("seasons")
    .select(SEASON_COLUMNS)
    .eq("season_id", seasonId)
    .maybeSingle();
  if (seasonResult.error) {
    console.error("season-standings season read failed:", seasonResult.error.message);
    return json(500, { error: "Standings are unavailable." });
  }
  if (!seasonResult.data) {
    return json(404, { error: "Season not found." });
  }

  const stateResult = await supabase
    .from("season_states_public")
    .select("state")
    .eq("season_id", seasonId)
    .maybeSingle();
  if (stateResult.error) {
    console.error("season-standings state read failed:", stateResult.error.message);
    return json(500, { error: "Standings are unavailable." });
  }

  const showResult = await supabase
    .from("show_configs")
    .select("config")
    .eq("slug", DEFAULT_SHOW_SLUG)
    .maybeSingle();
  if (showResult.error) {
    console.error("season-standings show config read failed:", showResult.error.message);
  }

  const adjustmentsResult = await collectScoreAdjustmentRows(async (from, to) => {
    const page = await supabase
      .from("score_adjustments")
      .select("id,season_id,player_id,week_id,reason,points,created_by_label,created_at")
      .eq("season_id", seasonId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    return {
      data: (page.data ?? null) as ScoreAdjustmentRow[] | null,
      error: page.error ? { message: page.error.message } : null,
    };
  });
  if ("error" in adjustmentsResult) {
    console.error("season-standings adjustments read failed:", adjustmentsResult.error);
    return json(500, { error: "Standings are unavailable." });
  }

  const storedState = stateResult.data?.state ?? { players: [] };
  const stateForStandings = stateWithAuthoritativeAdjustments(
    storedState,
    scoreAdjustmentsFromRows(adjustmentsResult.rows)
  );

  const standings = standingsResponseFromRecords(
    {
      season: seasonResult.data as SeasonStandingsRecord,
      state: redactPublicSeasonState(stateForStandings),
      showConfig: showResult.error ? null : showResult.data?.config ?? null,
    },
    Date.now()
  );
  return json(200, standings);
});
