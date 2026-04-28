import PocketBase from "pocketbase";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

// PocketBase uses 15-char alphanumeric IDs; Supabase expects uuid.
// Generate a deterministic uuid v5-style from the PocketBase id so re-runs are idempotent.
const pbIdToUuid = (id) => {
  const h = createHash("sha256").update(`pb:${id}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

const pocketBaseUrl =
  process.env.POCKETBASE_URL ||
  process.env.VITE_POCKETBASE_URL ||
  "http://127.0.0.1:8090";
const pocketBaseAdminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const pocketBaseAdminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.env.DRY_RUN === "1";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const pb = new PocketBase(pocketBaseUrl);
pb.autoCancellation(false);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const formatError = (error) => {
  const status = error?.status ?? error?.response?.code ?? "unknown";
  const message =
    error?.response?.message || error?.message || "Unknown error";
  const data = error?.response?.data;
  const dataSummary =
    data && Object.keys(data).length > 0 ? ` data=${JSON.stringify(data)}` : "";
  return `[status=${status}] ${message}${dataSummary}`;
};

const isNotFound = (error) =>
  error?.status === 404 || error?.response?.code === 404;

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeEmail = (value) => normalizeString(value).toLowerCase();

const normalizeStatus = (value) => {
  const status = normalizeString(value);
  return ["draft", "live", "finalized", "archived"].includes(status)
    ? status
    : "draft";
};

const normalizeSubmissionStatus = (value) => {
  const status = normalizeString(value);
  return ["new", "merged", "skipped_late", "skipped_stale"].includes(status)
    ? status
    : "new";
};

const normalizeKind = (value) => {
  const kind = normalizeString(value);
  return ["draft", "weekly", "weekly_merged", "growth"].includes(kind)
    ? kind
    : "weekly";
};

const normalizeLeague = (value) => {
  const league = normalizeString(value);
  return ["main", "jr"].includes(league) ? league : null;
};

const authPocketBaseIfConfigured = async () => {
  if (!pocketBaseAdminEmail || !pocketBaseAdminPassword) {
    console.warn("PocketBase admin credentials not set. Public collections only will be readable.");
    return;
  }

  try {
    await pb.admins.authWithPassword(pocketBaseAdminEmail, pocketBaseAdminPassword);
    return;
  } catch (adminsError) {
    try {
      await pb
        .collection("_superusers")
        .authWithPassword(pocketBaseAdminEmail, pocketBaseAdminPassword);
      console.log("Authenticated to PocketBase through _superusers.");
      return;
    } catch (superusersError) {
      throw new Error(
        `PocketBase admin auth failed. admins endpoint: ${formatError(
          adminsError
        )}; _superusers endpoint: ${formatError(superusersError)}`
      );
    }
  }
};

const fetchAll = async (collection) => {
  try {
    return await pb.collection(collection).getFullList({
      perPage: 500,
      sort: "id",
    });
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
};

// Required non-null fields per table (mirrors Supabase schema NOT NULL constraints)
const REQUIRED_FIELDS = {
  games: ["slug", "state"],
  show_configs: ["slug", "config"],
  seasons: ["season_id", "label", "status", "timezone", "lock_schedule"],
  season_states: ["season_id", "state"],
  submissions: ["id", "name", "email", "kind", "submission_status"],
  score_adjustments: ["id", "season_id", "player_id", "reason", "points"],
  player_portraits: ["email"],
};

const ENUM_FIELDS = {
  seasons: { status: ["draft", "live", "finalized", "archived"] },
  submissions: {
    kind: ["draft", "weekly", "weekly_merged", "growth"],
    submission_status: ["new", "merged", "skipped_late", "skipped_stale"],
    league: ["main", "jr", null],
  },
};

const dryRunInspect = (table, rows) => {
  console.log(`\n── ${table}: ${rows.length} rows ──`);
  if (rows.length === 0) return;

  const issues = [];
  const required = REQUIRED_FIELDS[table] ?? [];
  const enums = ENUM_FIELDS[table] ?? {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (const field of required) {
      if (row[field] === null || row[field] === undefined || row[field] === "") {
        issues.push(`  row[${i}] MISSING required field "${field}": ${JSON.stringify(row)}`);
      }
    }
    for (const [field, allowed] of Object.entries(enums)) {
      if (field in row && !allowed.includes(row[field])) {
        issues.push(`  row[${i}] INVALID enum "${field}"=${JSON.stringify(row[field])} (allowed: ${allowed.map(String).join(", ")}): id=${row.id ?? row[Object.keys(row)[0]]}`);
      }
    }
  }

  console.log(`  sample[0]: ${JSON.stringify(rows[0])}`);
  if (rows.length > 1) console.log(`  sample[1]: ${JSON.stringify(rows[1])}`);
  if (issues.length > 0) {
    console.warn(`  ⚠ ${issues.length} issue(s):`);
    issues.forEach((msg) => console.warn(msg));
  } else {
    console.log(`  ✓ no shape issues`);
  }
};

const upsertRows = async (table, rows, onConflict) => {
  if (rows.length === 0) {
    console.log(`${table}: 0 rows`);
    return;
  }

  if (dryRun) {
    dryRunInspect(table, rows);
    return;
  }

  const cleaned = rows.map((row) => {
    const out = { ...row };
    if (out.created_at === null) delete out.created_at;
    if (out.updated_at === null) delete out.updated_at;
    return out;
  });
  const { error } = await supabase.from(table).upsert(cleaned, { onConflict });
  if (error) {
    throw new Error(`${table} upsert failed: ${error.message}`);
  }

  console.log(`${table}: upserted ${rows.length} rows`);
};

const ensureSeasonStubs = (seasonRows, seasonIds) => {
  const existing = new Set(seasonRows.map((row) => row.season_id));
  for (const seasonId of seasonIds) {
    if (!seasonId || existing.has(seasonId)) continue;
    seasonRows.push({
      season_id: seasonId,
      label: seasonId,
      status: "draft",
      timezone: "America/New_York",
      lock_schedule: {},
      active_week_id: null,
      finale_config: null,
      rule_pack_id: null,
    });
    existing.add(seasonId);
  }
};

try {
  await authPocketBaseIfConfigured();

  const [
    games,
    showConfigs,
    seasons,
    seasonStates,
    submissions,
    scoreAdjustments,
    playerPortraits,
  ] = await Promise.all([
    fetchAll("games"),
    fetchAll("showConfigs"),
    fetchAll("seasons"),
    fetchAll("seasonStates"),
    fetchAll("submissions"),
    fetchAll("scoreAdjustments"),
    fetchAll("playerPortraits"),
  ]);

  const gameRows = games.map((record) => ({
    slug: normalizeString(record.slug) || "default",
    state: record.state || {},
    created_at: toIsoOrNull(record.created),
    updated_at: toIsoOrNull(record.updated),
  }));

  const showConfigRows = showConfigs.map((record) => ({
    slug: normalizeString(record.slug) || "default",
    config: record.config || {},
    created_at: toIsoOrNull(record.created),
    updated_at: toIsoOrNull(record.updated),
  }));

  const seasonRows = seasons
    .map((record) => {
      const seasonId = normalizeString(record.seasonId || record.id);
      if (!seasonId) return null;
      return {
        season_id: seasonId,
        label: normalizeString(record.label) || seasonId,
        status: normalizeStatus(record.status),
        timezone: normalizeString(record.timezone) || "America/New_York",
        lock_schedule: record.lockSchedule || {},
        active_week_id: normalizeString(record.activeWeekId) || null,
        finale_config: record.finaleConfig || null,
        rule_pack_id: normalizeString(record.rulePackId) || null,
        created_at: toIsoOrNull(record.created),
        updated_at: toIsoOrNull(record.updated),
      };
    })
    .filter(Boolean);

  const seasonStateRows = seasonStates
    .map((record) => {
      const seasonId = normalizeString(record.seasonId);
      if (!seasonId) return null;
      return {
        season_id: seasonId,
        state: record.state || {},
        created_at: toIsoOrNull(record.created),
        updated_at: toIsoOrNull(record.updated),
      };
    })
    .filter(Boolean);

  ensureSeasonStubs(
    seasonRows,
    seasonStateRows.map((row) => row.season_id)
  );

  const submissionRows = submissions.map((record) => {
    const payload = record.payload && typeof record.payload === "object" ? record.payload : {};
    const payloadLeague = normalizeLeague(payload.league);
    return {
      id: pbIdToUuid(record.id),
      name: normalizeString(record.name) || "Unknown",
      email: normalizeEmail(record.email) || "unknown@example.invalid",
      kind: normalizeKind(record.kind),
      season_id: normalizeString(record.seasonId) || null,
      week_id: normalizeString(record.weekId) || null,
      submission_status: normalizeSubmissionStatus(record.submissionStatus),
      rule_pack_id: normalizeString(record.rulePackId) || null,
      league: normalizeLeague(record.league) || payloadLeague,
      weekly_banished: normalizeString(record.weeklyBanished) || null,
      weekly_murdered: normalizeString(record.weeklyMurdered) || null,
      payload,
      created_at: toIsoOrNull(record.created),
      updated_at: toIsoOrNull(record.updated),
    };
  });

  const scoreAdjustmentRows = scoreAdjustments
    .map((record) => {
      const seasonId = normalizeString(record.seasonId);
      const playerId = normalizeString(record.playerId);
      if (!seasonId || !playerId) return null;
      return {
        id: pbIdToUuid(record.id),
        season_id: seasonId,
        player_id: playerId,
        week_id: normalizeString(record.weekId) || null,
        reason: normalizeString(record.reason) || "Imported adjustment",
        points: Number.isFinite(Number(record.points)) ? Number(record.points) : 0,
        created_by_label: normalizeString(record.createdBy) || null,
        created_at: toIsoOrNull(record.created),
      };
    })
    .filter(Boolean);

  ensureSeasonStubs(
    seasonRows,
    scoreAdjustmentRows.map((row) => row.season_id)
  );

  const portraitRows = playerPortraits
    .map((record) => {
      const email = normalizeEmail(record.email);
      if (!email) return null;
      return {
        email,
        name: normalizeString(record.name) || null,
        portrait_url: normalizeString(record.portraitUrl) || null,
        portrait_path: null,
        created_at: toIsoOrNull(record.created),
        updated_at: toIsoOrNull(record.updated),
      };
    })
    .filter(Boolean);

  console.log(`PocketBase source: ${pocketBaseUrl}`);
  console.log(`Supabase target: ${supabaseUrl}`);
  if (dryRun) console.log("DRY_RUN=1: no Supabase writes will be made.");

  await upsertRows("games", gameRows, "slug");
  await upsertRows("show_configs", showConfigRows, "slug");
  await upsertRows("seasons", seasonRows, "season_id");
  await upsertRows("season_states", seasonStateRows, "season_id");
  await upsertRows("submissions", submissionRows, "id");
  await upsertRows("score_adjustments", scoreAdjustmentRows, "id");
  await upsertRows("player_portraits", portraitRows, "email");

  console.log("PocketBase to Supabase migration complete.");
  console.log("Admin auth users are not migrated. Create Supabase Auth users and seed public.admin_users.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
