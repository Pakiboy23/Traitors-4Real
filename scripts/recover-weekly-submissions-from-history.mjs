import PocketBase from "pocketbase";

const url = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error("Missing POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD.");
  process.exit(1);
}

const pb = new PocketBase(url);

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const toObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const getDefaultGameRecord = async () => {
  try {
    return await pb.collection("games").getFirstListItem('slug="default"');
  } catch (error) {
    if (error?.status === 404 || error?.response?.code === 404) return null;
    throw error;
  }
};

const getAllSubmissions = async () => {
  const perPage = 200;
  const firstPage = await pb.collection("submissions").getList(1, perPage, {
    sort: "-id",
  });
  const items = [...firstPage.items];
  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const nextPage = await pb.collection("submissions").getList(page, perPage, {
      sort: "-id",
    });
    items.push(...nextPage.items);
  }
  return items;
};

try {
  await pb.admins.authWithPassword(adminEmail, adminPassword);

  const gameRecord = await getDefaultGameRecord();
  if (!gameRecord) {
    console.error("No default games record found (slug=\"default\").");
    process.exit(1);
  }

  const state = toObject(gameRecord.state);
  const history = Array.isArray(state.weeklySubmissionHistory)
    ? state.weeklySubmissionHistory
    : [];

  if (history.length === 0) {
    console.log("No weeklySubmissionHistory entries found. Nothing to recover.");
    process.exit(0);
  }

  const existingSubmissions = await getAllSubmissions();
  const existingSourceIds = new Set();
  existingSubmissions.forEach((record) => {
    if (typeof record.id === "string" && record.id) {
      existingSourceIds.add(record.id);
    }
    const payload = toObject(record.payload);
    const sourceSubmissionId = normalizeString(payload.sourceSubmissionId);
    if (sourceSubmissionId) {
      existingSourceIds.add(sourceSubmissionId);
    }
  });

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of history) {
    const sourceSubmissionId = normalizeString(entry?.id);
    if (!sourceSubmissionId || existingSourceIds.has(sourceSubmissionId)) {
      skipped += 1;
      continue;
    }

    const bonusGames = toObject(entry?.bonusGames);
    const finalePredictions = toObject(entry?.finalePredictions);
    const weekId = normalizeString(entry?.weekId);
    const weeklyBanished = normalizeString(entry?.weeklyBanished);
    const weeklyMurdered = normalizeString(entry?.weeklyMurdered);

    try {
      await pb.collection("submissions").create({
        name: normalizeString(entry?.name) || "Recovered submission",
        email: normalizeString(entry?.email) || "recovered@local",
        kind: "weekly_merged",
        weeklyBanished,
        weeklyMurdered,
        payload: {
          sourceSubmissionId,
          recoveredFromHistory: true,
          mergedAt: normalizeString(entry?.mergedAt),
          originalCreatedAt: normalizeString(entry?.created),
          league: normalizeString(entry?.league) || "main",
          weekId,
          weeklyPredictions: {
            weekId,
            nextBanished: weeklyBanished,
            nextMurdered: weeklyMurdered,
            bonusGames: {
              redemptionRoulette:
                normalizeString(bonusGames.redemptionRoulette),
              doubleOrNothing: Boolean(bonusGames.doubleOrNothing),
              shieldGambit: normalizeString(bonusGames.shieldGambit),
              traitorTrio: Array.isArray(bonusGames.traitorTrio)
                ? bonusGames.traitorTrio
                    .map((pick) => normalizeString(pick))
                    .filter(Boolean)
                : [],
            },
            finalePredictions: {
              finalWinner: normalizeString(finalePredictions.finalWinner),
              lastFaithfulStanding: normalizeString(
                finalePredictions.lastFaithfulStanding
              ),
              lastTraitorStanding: normalizeString(
                finalePredictions.lastTraitorStanding
              ),
              finalPotEstimate:
                typeof finalePredictions.finalPotEstimate === "number" &&
                Number.isFinite(finalePredictions.finalPotEstimate)
                  ? finalePredictions.finalPotEstimate
                  : null,
            },
          },
        },
      });
      created += 1;
      existingSourceIds.add(sourceSubmissionId);
    } catch (error) {
      failed += 1;
      console.warn(
        `Failed to recover ${sourceSubmissionId}:`,
        error?.message || error
      );
    }
  }

  console.log(
    `Recovery complete. Created: ${created}, skipped: ${skipped}, failed: ${failed}.`
  );
} catch (error) {
  console.error("Recovery failed:", error?.message || error);
  process.exit(1);
}
