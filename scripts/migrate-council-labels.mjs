import PocketBase from "pocketbase";

const url = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error("Missing POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD.");
  process.exit(1);
}

const pb = new PocketBase(url);

const SKIP_KEYS = new Set(["name", "email", "id"]);
const SKIP_PATH_SEGMENTS = new Set(["players", "weeklySubmissionHistory"]);

const replaceCouncil = (value) =>
  value
    .replace(/\bCOUNSEL\b/g, "COUNCIL")
    .replace(/\bCounsel\b/g, "Council")
    .replace(/\bcounsel\b/g, "council");

const replaceInValue = (value, path = []) => {
  if (typeof value === "string") {
    return replaceCouncil(value);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      replaceInValue(item, [...path, String(index)])
    );
  }
  if (value && typeof value === "object") {
    if (path.length && SKIP_PATH_SEGMENTS.has(path[path.length - 1])) {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => {
        if (SKIP_KEYS.has(key)) return [key, val];
        return [key, replaceInValue(val, [...path, key])];
      })
    );
  }
  return value;
};

const valuesEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
};

const migrateGames = async () => {
  const records = await pb.collection("games").getFullList({ perPage: 200 });
  let updated = 0;

  for (const record of records) {
    const state = record?.state;
    if (!state) continue;
    const nextState = replaceInValue(state, ["state"]);
    if (valuesEqual(state, nextState)) continue;
    await pb.collection("games").update(record.id, { state: nextState });
    updated += 1;
  }

  return updated;
};

const migrateSubmissions = async () => {
  const records = await pb.collection("submissions").getFullList({ perPage: 500 });
  let updated = 0;

  for (const record of records) {
    if (!("payload" in record)) continue;
    const payload = record.payload;
    const nextPayload = replaceInValue(payload, ["payload"]);
    if (valuesEqual(payload, nextPayload)) continue;
    await pb.collection("submissions").update(record.id, { payload: nextPayload });
    updated += 1;
  }

  return updated;
};

try {
  await pb.admins.authWithPassword(adminEmail, adminPassword);

  const updatedGames = await migrateGames();
  const updatedSubmissions = await migrateSubmissions();

  console.log(
    `Council label migration complete. Updated ${updatedGames} game record(s) and ${updatedSubmissions} submission record(s).`
  );
} catch (error) {
  console.error("Council label migration failed:", error?.message || error);
  process.exit(1);
}
