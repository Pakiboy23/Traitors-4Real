import PocketBase from "pocketbase";

const url = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
const showSlug = process.env.SHOW_SLUG || "default";
const seasonId = process.env.SEASON_ID || "season-legacy";
const seasonLabel = process.env.SEASON_LABEL || "Season Legacy";

if (!adminEmail || !adminPassword) {
  console.error("Missing POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD.");
  process.exit(1);
}

const pb = new PocketBase(url);

const formatError = (error) => {
  const status = error?.status ?? error?.response?.code ?? "unknown";
  const message =
    error?.response?.message || error?.message || "Unknown PocketBase error";
  const data = error?.response?.data;
  const dataSummary =
    data && Object.keys(data).length > 0 ? ` data=${JSON.stringify(data)}` : "";
  return `[status=${status}] ${message}${dataSummary}`;
};

const authAsSuperuser = async () => {
  try {
    await pb.admins.authWithPassword(adminEmail, adminPassword);
    return;
  } catch (adminsError) {
    try {
      await pb.collection("_superusers").authWithPassword(adminEmail, adminPassword);
      console.log(
        "Authenticated via _superusers endpoint (fallback from admins endpoint)."
      );
      return;
    } catch (superusersError) {
      throw new Error(
        `Superuser authentication failed. admins endpoint: ${formatError(
          adminsError
        )}; _superusers endpoint: ${formatError(superusersError)}`
      );
    }
  }
};

const isNotFound = (error) =>
  error?.status === 404 || error?.response?.code === 404;

const toObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const upsertByFilter = async (collection, filter, payload) => {
  try {
    const existing = await pb.collection(collection).getFirstListItem(filter);
    return pb.collection(collection).update(existing.id, payload);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  return pb.collection(collection).create(payload);
};

const getAll = async (collection, perPage = 200) => {
  const first = await pb.collection(collection).getList(1, perPage, {
    sort: "-created",
  });
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await pb.collection(collection).getList(page, perPage, {
      sort: "-created",
    });
    items.push(...next.items);
  }
  return items;
};

const ensureRequiredCollections = async () => {
  const required = [
    "games",
    "showConfigs",
    "seasons",
    "seasonStates",
    "scoreAdjustments",
    "submissions",
  ];
  const existing = await pb.collections.getFullList();
  const existingNames = new Set(existing.map((collection) => collection.name));
  const missing = required.filter((name) => !existingNames.has(name));
  if (missing.length === 0) return;
  throw new Error(
    `Missing required PocketBase collections: ${missing.join(
      ", "
    )}. Run 'node scripts/pocketbase-init.mjs' first.`
  );
};

try {
  await authAsSuperuser();
  await ensureRequiredCollections();

  const game = await pb
    .collection("games")
    .getFirstListItem(`slug="${showSlug.replace(/"/g, '\\"')}"`);
  const state = toObject(game?.state);
  const castNames = Object.keys(toObject(state.castStatus));

  const showConfig = {
    slug: showSlug,
    showName: "Traitors Fantasy Draft",
    shortName: "Traitors Fantasy",
    branding: {
      headerKicker: "Traitors Fantasy Draft",
      appTitle: "Round Table Command Desk",
      footerCopy: "Traitors Fantasy Draft workspace.",
    },
    terminology: {
      weeklyCouncilLabel: "Weekly Council",
      jrCouncilLabel: "Jr. Council",
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
    castNames,
  };

  await upsertByFilter(
    "showConfigs",
    `slug="${showSlug.replace(/"/g, '\\"')}"`,
    {
      slug: showSlug,
      config: showConfig,
    }
  );

  const finaleResults = toObject(toObject(state.weeklyResults).finaleResults);
  const isFinalized = Boolean(
    normalizeString(finaleResults.finalWinner) &&
      normalizeString(finaleResults.lastFaithfulStanding) &&
      normalizeString(finaleResults.lastTraitorStanding)
  );

  await upsertByFilter(
    "seasons",
    `seasonId="${seasonId.replace(/"/g, '\\"')}"`,
    {
      seasonId,
      label: seasonLabel,
      status: isFinalized ? "finalized" : "live",
      timezone: "America/New_York",
      lockSchedule: {
        finaleLockAt: normalizeString(toObject(state.finaleConfig).lockAt) || null,
      },
      activeWeekId: normalizeString(state.activeWeekId) || "week-1",
      finaleConfig: toObject(state.finaleConfig),
      rulePackId: normalizeString(state.rulePackId) || "traitors-classic",
    }
  );

  await upsertByFilter(
    "seasonStates",
    `seasonId="${seasonId.replace(/"/g, '\\"')}"`,
    {
      seasonId,
      state: {
        ...state,
        seasonId,
      },
    }
  );

  const submissions = await getAll("submissions");
  let updatedSubmissions = 0;
  for (const submission of submissions) {
    const payload = toObject(submission.payload);
    const payloadWeekly = toObject(payload.weeklyPredictions);
    const detectedWeekId =
      normalizeString(submission.weekId) ||
      normalizeString(payload.weekId) ||
      normalizeString(payloadWeekly.weekId);
    const nextStatus = normalizeString(submission.submissionStatus)
      ? submission.submissionStatus
      : submission.kind === "weekly_merged"
      ? "merged"
      : submission.kind === "weekly"
      ? "new"
      : "";

    const nextPayload = {
      seasonId,
      ...payload,
    };

    const shouldUpdate =
      !normalizeString(submission.seasonId) ||
      !normalizeString(submission.weekId) ||
      !normalizeString(submission.submissionStatus);

    if (!shouldUpdate) continue;

    await pb.collection("submissions").update(submission.id, {
      seasonId,
      weekId: detectedWeekId,
      submissionStatus: nextStatus,
      payload: nextPayload,
    });
    updatedSubmissions += 1;
  }

  console.log(
    `Migration complete for show=${showSlug}, season=${seasonId}. Updated submissions: ${updatedSubmissions}.`
  );
} catch (error) {
  console.error("Migration failed:", formatError(error));
  console.error(
    "Hint: use PocketBase superuser credentials (not app admin credentials) and run scripts/pocketbase-init.mjs before migrating."
  );
  process.exit(1);
}
