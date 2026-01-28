import { readFileSync } from "fs";
import PocketBase from "pocketbase";
import admin from "firebase-admin";

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT || process.argv[2];
const firestoreProjectId = process.env.FIREBASE_PROJECT_ID;
const pocketbaseUrl = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const pocketbaseAdminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const pocketbaseAdminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!serviceAccountPath) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT (path to service account json).");
  process.exit(1);
}
if (!pocketbaseAdminEmail || !pocketbaseAdminPassword) {
  console.error("Missing POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD.");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: firestoreProjectId || serviceAccount.project_id,
});

const db = admin.firestore();
const pb = new PocketBase(pocketbaseUrl);

const getGameState = async () => {
  const doc = await db.collection("games").doc("default").get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  return data.state ?? data;
};

const getPortraits = async () => {
  const snapshot = await db.collection("playerPortraits").get();
  const portraits = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() || {};
    portraits.push({
      email: (data.email || docSnap.id || "").toString().toLowerCase(),
      name: data.name || "",
      portraitUrl: data.portraitUrl || "",
    });
  });
  return portraits;
};

const upsertGameState = async (state) => {
  try {
    const existing = await pb
      .collection("games")
      .getFirstListItem('slug="default"');
    await pb.collection("games").update(existing.id, {
      slug: "default",
      state,
    });
  } catch (error) {
    if (error?.status !== 404 && error?.response?.code !== 404) throw error;
    await pb.collection("games").create({
      slug: "default",
      state,
    });
  }
};

const upsertPortrait = async (portrait) => {
  if (!portrait.email) return;
  try {
    const existing = await pb
      .collection("playerPortraits")
      .getFirstListItem(`email="${portrait.email.replace(/\"/g, '\\"')}"`);
    await pb.collection("playerPortraits").update(existing.id, portrait);
  } catch (error) {
    if (error?.status !== 404 && error?.response?.code !== 404) throw error;
    await pb.collection("playerPortraits").create(portrait);
  }
};

try {
  await pb.admins.authWithPassword(
    pocketbaseAdminEmail,
    pocketbaseAdminPassword
  );

  const gameState = await getGameState();
  if (gameState) {
    await upsertGameState(gameState);
    console.log("✅ Migrated game state.");
  } else {
    console.log("⚠️ No game state found in Firestore.");
  }

  const portraits = await getPortraits();
  if (portraits.length) {
    for (const portrait of portraits) {
      await upsertPortrait(portrait);
    }
    console.log(`✅ Migrated ${portraits.length} player portraits.`);
  } else {
    console.log("⚠️ No player portraits found in Firestore.");
  }

  process.exit(0);
} catch (error) {
  console.error("❌ Migration failed:", error?.message || error);
  process.exit(1);
}
