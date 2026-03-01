import PocketBase from "pocketbase";

const url = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
const seedEmail = process.env.POCKETBASE_APP_ADMIN_EMAIL;
const seedPassword = process.env.POCKETBASE_APP_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error("Missing POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD.");
  process.exit(1);
}

const pb = new PocketBase(url);

const ensureCollection = async (name, definition) => {
  const collections = await pb.collections.getFullList();
  const existing = collections.find((c) => c.name === name);
  if (!existing) {
    await pb.collections.create(definition);
    console.log(`Created collection: ${name}`);
    return;
  }
  await pb.collections.update(existing.id, definition);
  console.log(`Updated collection: ${name}`);
};

try {
  await pb.admins.authWithPassword(adminEmail, adminPassword);

  await ensureCollection("admins", {
    name: "admins",
    type: "auth",
    fields: [
      {
        name: "name",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 120, pattern: "" },
      },
    ],
    listRule: '@request.auth.collectionName = "admins"',
    viewRule: '@request.auth.collectionName = "admins"',
    createRule: '@request.auth.collectionName = "admins"',
    updateRule: '@request.auth.collectionName = "admins"',
    deleteRule: '@request.auth.collectionName = "admins"',
    authRule: "",
  });

  await ensureCollection("games", {
    name: "games",
    type: "base",
    fields: [
      {
        name: "slug",
        type: "text",
        required: true,
        unique: true,
        options: { min: 1, max: 120, pattern: "" },
      },
      {
        name: "state",
        type: "json",
        required: true,
        unique: false,
        options: { maxSize: 5000000 },
      },
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.collectionName = "admins"',
    updateRule: '@request.auth.collectionName = "admins"',
    deleteRule: '@request.auth.collectionName = "admins"',
  });

  await ensureCollection("showConfigs", {
    name: "showConfigs",
    type: "base",
    fields: [
      {
        name: "slug",
        type: "text",
        required: true,
        unique: true,
        options: { min: 1, max: 120, pattern: "" },
      },
      {
        name: "config",
        type: "json",
        required: true,
        unique: false,
        options: { maxSize: 5000000 },
      },
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.collectionName = "admins"',
    updateRule: '@request.auth.collectionName = "admins"',
    deleteRule: '@request.auth.collectionName = "admins"',
  });

  await ensureCollection("seasons", {
    name: "seasons",
    type: "base",
    fields: [
      {
        name: "seasonId",
        type: "text",
        required: true,
        unique: true,
        options: { min: 1, max: 120, pattern: "" },
      },
      {
        name: "label",
        type: "text",
        required: true,
        unique: false,
        options: { min: 1, max: 200, pattern: "" },
      },
      {
        name: "status",
        type: "text",
        required: true,
        unique: false,
        options: { min: 1, max: 40, pattern: "" },
      },
      {
        name: "timezone",
        type: "text",
        required: true,
        unique: false,
        options: { min: 1, max: 120, pattern: "" },
      },
      {
        name: "lockSchedule",
        type: "json",
        required: false,
        unique: false,
        options: { maxSize: 5000000 },
      },
      {
        name: "activeWeekId",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 120, pattern: "" },
      },
      {
        name: "finaleConfig",
        type: "json",
        required: false,
        unique: false,
        options: { maxSize: 5000000 },
      },
      {
        name: "rulePackId",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 120, pattern: "" },
      },
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.collectionName = "admins"',
    updateRule: '@request.auth.collectionName = "admins"',
    deleteRule: '@request.auth.collectionName = "admins"',
  });

  await ensureCollection("seasonStates", {
    name: "seasonStates",
    type: "base",
    fields: [
      {
        name: "seasonId",
        type: "text",
        required: true,
        unique: true,
        options: { min: 1, max: 120, pattern: "" },
      },
      {
        name: "state",
        type: "json",
        required: true,
        unique: false,
        options: { maxSize: 5000000 },
      },
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.collectionName = "admins"',
    updateRule: '@request.auth.collectionName = "admins"',
    deleteRule: '@request.auth.collectionName = "admins"',
  });

  await ensureCollection("scoreAdjustments", {
    name: "scoreAdjustments",
    type: "base",
    fields: [
      {
        name: "seasonId",
        type: "text",
        required: true,
        unique: false,
        options: { min: 1, max: 120, pattern: "" },
      },
      {
        name: "playerId",
        type: "text",
        required: true,
        unique: false,
        options: { min: 1, max: 120, pattern: "" },
      },
      {
        name: "weekId",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 120, pattern: "" },
      },
      {
        name: "reason",
        type: "text",
        required: true,
        unique: false,
        options: { min: 1, max: 500, pattern: "" },
      },
      {
        name: "points",
        type: "number",
        required: true,
        unique: false,
        options: {
          min: -100000,
          max: 100000,
          noDecimal: false,
        },
      },
      {
        name: "createdBy",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 200, pattern: "" },
      },
    ],
    listRule: '@request.auth.collectionName = "admins"',
    viewRule: '@request.auth.collectionName = "admins"',
    createRule: '@request.auth.collectionName = "admins"',
    updateRule: '@request.auth.collectionName = "admins"',
    deleteRule: '@request.auth.collectionName = "admins"',
  });

  await ensureCollection("playerPortraits", {
    name: "playerPortraits",
    type: "base",
    fields: [
      {
        name: "email",
        type: "text",
        required: true,
        unique: true,
        options: { min: 3, max: 200, pattern: "" },
      },
      {
        name: "name",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 200, pattern: "" },
      },
      {
        name: "portraitUrl",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 2048, pattern: "" },
      },
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.collectionName = "admins"',
    updateRule: '@request.auth.collectionName = "admins"',
    deleteRule: '@request.auth.collectionName = "admins"',
  });

  await ensureCollection("submissions", {
    name: "submissions",
    type: "base",
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
        unique: false,
        options: { min: 1, max: 200, pattern: "" },
      },
      {
        name: "email",
        type: "text",
        required: true,
        unique: false,
        options: { min: 3, max: 200, pattern: "" },
      },
      {
        name: "kind",
        type: "text",
        required: true,
        unique: false,
        options: { min: 1, max: 50, pattern: "" },
      },
      {
        name: "seasonId",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 120, pattern: "" },
      },
      {
        name: "weekId",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 120, pattern: "" },
      },
      {
        name: "submissionStatus",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 40, pattern: "" },
      },
      {
        name: "rulePackId",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 120, pattern: "" },
      },
      {
        name: "weeklyBanished",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 200, pattern: "" },
      },
      {
        name: "weeklyMurdered",
        type: "text",
        required: false,
        unique: false,
        options: { min: 0, max: 200, pattern: "" },
      },
      {
        name: "payload",
        type: "json",
        required: false,
        unique: false,
        options: { maxSize: 5000000 },
      },
    ],
    listRule: '@request.auth.collectionName = "admins"',
    viewRule: '@request.auth.collectionName = "admins"',
    createRule: "",
    updateRule: '@request.auth.collectionName = "admins"',
    deleteRule: '@request.auth.collectionName = "admins"',
  });

  if (seedEmail && seedPassword) {
    try {
      await pb.collection("admins").create({
        email: seedEmail,
        password: seedPassword,
        passwordConfirm: seedPassword,
      });
      console.log("Seeded admin auth user.");
    } catch (error) {
      console.warn("Seed admin user skipped:", error?.message || error);
    }
  }

  console.log("PocketBase schema ready.");
} catch (error) {
  console.error("PocketBase init failed:", error?.message || error);
  process.exit(1);
}
