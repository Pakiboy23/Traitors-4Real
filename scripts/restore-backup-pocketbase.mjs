import { readFileSync } from "fs";
import PocketBase from "pocketbase";

const url = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
const backupPath =
  process.argv[2] ||
  "/Users/haarisshariff/Downloads/traitors-game-state-2026-01-21T16_29_32.json";

if (!adminEmail || !adminPassword) {
  console.error("Missing POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD.");
  process.exit(1);
}

console.log("Reading backup from:", backupPath);
const backupData = JSON.parse(readFileSync(backupPath, "utf8"));
console.log(`Found ${backupData.players?.length || 0} players`);
console.log(`Found ${Object.keys(backupData.castStatus || {}).length} cast statuses`);

const pb = new PocketBase(url);

const getGameRecord = async () => {
  try {
    return await pb.collection("games").getFirstListItem('slug="default"');
  } catch (error) {
    if (error?.status === 404 || error?.response?.code === 404) return null;
    throw error;
  }
};

try {
  await pb.admins.authWithPassword(adminEmail, adminPassword);
  const existing = await getGameRecord();
  if (existing) {
    await pb.collection("games").update(existing.id, {
      slug: "default",
      state: backupData,
    });
  } else {
    await pb.collection("games").create({
      slug: "default",
      state: backupData,
    });
  }
  console.log("✅ Backup restored successfully to PocketBase!");
  process.exit(0);
} catch (error) {
  console.error("❌ Failed to restore:", error?.message || error);
  process.exit(1);
}
