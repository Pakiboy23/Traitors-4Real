import type { RecordModel } from "pocketbase";
import type { FinalePredictions, GameState } from "../types";
import { pb, pocketbaseUrl } from "../src/lib/pocketbase";

const GAME_COLLECTION = "games";
const GAME_SLUG = "default";
const PORTRAITS_COLLECTION = "playerPortraits";
const ADMIN_COLLECTION = "admins";
const SUBMISSIONS_COLLECTION = "submissions";
const SUBMISSIONS_SORT = "-id";

const escapeFilterValue = (value: string) =>
  value.replace(/["\\]/g, "\\$&");

const isNotFound = (error: any) =>
  error?.status === 404 || error?.response?.code === 404;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const onAdminAuthChange = (callback: (isAuthed: boolean) => void) => {
  return pb.authStore.onChange(() => {
    callback(pb.authStore.isValid);
  }, true);
};

export const signInAdmin = async (email: string, password: string) => {
  await pb.collection(ADMIN_COLLECTION).authWithPassword(email, password);
  return pb.authStore.isValid;
};

export const signOutAdmin = () => {
  pb.authStore.clear();
};

export const fetchGameState = async (): Promise<{
  state: GameState;
  updatedAt?: number;
} | null> => {
  try {
    const record = await pb
      .collection(GAME_COLLECTION)
      .getFirstListItem(`slug="${GAME_SLUG}"`);
    const updatedAt = record.updated
      ? new Date(record.updated as string).getTime()
      : undefined;
    return { state: record.state as GameState, updatedAt };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

export const saveGameState = async (state: GameState) => {
  let existing: { id: string } | null = null;
  try {
    const record = await pb
      .collection(GAME_COLLECTION)
      .getFirstListItem(`slug="${GAME_SLUG}"`);
    existing = { id: record.id };
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (existing) {
    return pb.collection(GAME_COLLECTION).update(existing.id, {
      slug: GAME_SLUG,
      state,
    });
  }
  return pb.collection(GAME_COLLECTION).create({
    slug: GAME_SLUG,
    state,
  });
};

export const subscribeToGameState = (
  handler: (state: GameState, updatedAt?: number) => void
) => {
  const callback = (event: any) => {
    if (!event?.record) return;
    if (event.record.slug !== GAME_SLUG) return;
    const updatedAt = event.record.updated
      ? new Date(event.record.updated as string).getTime()
      : undefined;
    handler(event.record.state as GameState, updatedAt);
  };

  pb.collection(GAME_COLLECTION).subscribe("*", callback).catch((error) => {
    console.warn("PocketBase subscription failed:", error);
  });

  return () => {
    pb.collection(GAME_COLLECTION).unsubscribe("*").catch(() => undefined);
  };
};

export const fetchPlayerPortraits = async () => {
  const records = await pb.collection(PORTRAITS_COLLECTION).getFullList({
    perPage: 500,
  });
  const portraits: Record<string, string> = {};
  records.forEach((record: any) => {
    const email = normalizeEmail(record.email || "");
    if (email && record.portraitUrl) {
      portraits[email] = record.portraitUrl as string;
    }
  });
  return portraits;
};

export const savePlayerPortrait = async (
  email: string,
  name: string,
  portraitUrl: string
) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  let existing: { id: string } | null = null;
  try {
    const record = await pb
      .collection(PORTRAITS_COLLECTION)
      .getFirstListItem(`email="${escapeFilterValue(normalized)}"`);
    existing = { id: record.id };
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (existing) {
    await pb.collection(PORTRAITS_COLLECTION).update(existing.id, {
      email: normalized,
      name,
      portraitUrl,
    });
  } else {
    await pb.collection(PORTRAITS_COLLECTION).create({
      email: normalized,
      name,
      portraitUrl,
    });
  }
};

          bonusGames?: {
            redemptionRoulette?: string;
            shieldGambit?: string;
            doubleOrNothing?: boolean;
            traitorTrio?: string[];
          };
          finalePredictions?: {
            finalWinner?: string;
            lastFaithfulStanding?: string;
            lastTraitorStanding?: string;
            finalPotEstimate?: number | null;
          };
        };
        bonusGames?: {
          redemptionRoulette?: string;
          shieldGambit?: string;
          doubleOrNothing?: boolean;
          traitorTrio?: string[];
        };
        finalePredictions?: {
          finalWinner?: string;
          lastFaithfulStanding?: string;
          lastTraitorStanding?: string;
          finalPotEstimate?: number | null;
  const bonusGames = payload?.weeklyPredictions?.bonusGames ?? payload?.bonusGames;
  const finalePredictions =
    payload?.weeklyPredictions?.finalePredictions ?? payload?.finalePredictions;

  const hasBonusPayload =
    typeof bonusGames?.redemptionRoulette === "string" ||
    typeof bonusGames?.shieldGambit === "string" ||
    Array.isArray(bonusGames?.traitorTrio) ||
    typeof bonusGames?.doubleOrNothing === "boolean";
  const hasFinalePayload =
    typeof finalePredictions?.finalWinner === "string" ||
    typeof finalePredictions?.lastFaithfulStanding === "string" ||
    typeof finalePredictions?.lastTraitorStanding === "string" ||
    typeof finalePredictions?.finalPotEstimate === "number";

  return hasWeeklyFields || hasWeeklyPayload || hasBonusPayload || hasFinalePayload;
  name: string;
  email: string;
  kind: string;
  league?: string;
  weeklyBanished?: string;
  weeklyMurdered?: string;
  payload?: unknown;
  created?: string;
  updated?: string;
}

const sortSubmissions = (items: SubmissionRecord[]) =>
  [...items].sort((a, b) => (b.id || "").localeCompare(a.id || ""));

const isWeeklySubmissionRecord = (item: SubmissionRecord) => {
  if (item.kind === "weekly") return true;

  // Some API responses can omit `kind`; keep weekly records visible by shape.
  const payload = item.payload as
    | {
        weeklyPredictions?: {
          nextBanished?: string;
          nextMurdered?: string;
        };
      }
    | undefined;

  const hasWeeklyFields =
    typeof item.weeklyBanished === "string" ||
    typeof item.weeklyMurdered === "string";
  const hasWeeklyPayload =
    typeof payload?.weeklyPredictions?.nextBanished === "string" ||
    typeof payload?.weeklyPredictions?.nextMurdered === "string";

  return hasWeeklyFields || hasWeeklyPayload;
};

const normalizeWeeklySubmissions = (items: unknown): SubmissionRecord[] => {
  if (!Array.isArray(items)) return [];
  return sortSubmissions(
    (items as SubmissionRecord[]).filter(
      (item) => Boolean(item) && isWeeklySubmissionRecord(item)
    )
  );
};

export const fetchWeeklySubmissions = async (): Promise<SubmissionRecord[]> => {
  try {
    const perPage = 200;
    const firstPage = await pb
      .collection(SUBMISSIONS_COLLECTION)
      .getList<SubmissionRecord>(1, perPage, {
        sort: SUBMISSIONS_SORT,
        filter: 'kind="weekly"',
      });
    const items = [...firstPage.items];
    for (let page = 2; page <= firstPage.totalPages; page += 1) {
      const nextPage = await pb
        .collection(SUBMISSIONS_COLLECTION)
        .getList<SubmissionRecord>(page, perPage, {
          sort: SUBMISSIONS_SORT,
          filter: 'kind="weekly"',
        });
      items.push(...nextPage.items);
    }
    const normalized = normalizeWeeklySubmissions(items);
    console.log(
      `fetchWeeklySubmissions: Loaded ${normalized.length} submissions via SDK`
    );
    return normalized;
  } catch (error) {
    console.warn("PocketBase SDK submissions fetch failed:", error);
  }

  // Fallback: use fetch with and without sort/filter variants.
  try {
    const headers: Record<string, string> = {};
    if (pb.authStore.token) {
      headers["Authorization"] = pb.authStore.token;
    }
    const queryVariants = [
      { perPage: "200", sort: SUBMISSIONS_SORT, filter: '(kind="weekly")' },
      { perPage: "200", filter: '(kind="weekly")' },
      { perPage: "200", sort: SUBMISSIONS_SORT },
      { perPage: "200" },
    ];

    for (const query of queryVariants) {
      const params = new URLSearchParams(query);
      const url = `${pocketbaseUrl}/api/collections/${SUBMISSIONS_COLLECTION}/records?${params.toString()}`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.warn(
          `Fallback submissions fetch failed (${response.status}) for ${params.toString()}`
        );
        continue;
      }
      const data = (await response.json()) as { items?: SubmissionRecord[] };
      const normalized = normalizeWeeklySubmissions(data.items);
      if (normalized.length > 0) {
        console.log(
          `fetchWeeklySubmissions: Loaded ${normalized.length} submissions via fallback`
        );
        return normalized;
      }
    }

    return [];
  } catch (fallbackError) {
    console.warn("Fallback submissions fetch failed:", fallbackError);
    return [];
  }
};

export const subscribeToWeeklySubmissions = (
  handler: (submission: SubmissionRecord) => void
) => {
  if (!pb.authStore.isValid) {
    console.warn("subscribeToWeeklySubmissions: Admin not authenticated, skipping subscription");
    return () => {};
  }

  const callback = (event: any) => {
    const record = event?.record as SubmissionRecord | undefined;
    if (!record || record.kind !== "weekly") return;
    if (event?.action !== "create") return;
    console.log("New weekly submission received:", record.id, record.name);
    handler(record);
  };

  pb.collection(SUBMISSIONS_COLLECTION).subscribe("*", callback).then(() => {
    console.log("Subscribed to weekly submissions");
  }).catch((error) => {
    console.warn("PocketBase submission subscription failed:", error);
  });

  return () => {
    pb.collection(SUBMISSIONS_COLLECTION).unsubscribe("*").catch(() => undefined);
  };
};

export const deleteSubmission = async (id: string) => {
  await pb.collection(SUBMISSIONS_COLLECTION).delete(id);
};

export const submitWeeklyCouncilVote = async (input: {
  name: string;
  email: string;
  weeklyPredictions: { nextBanished: string; nextMurdered: string };
  weekId?: string;
  bonusGames?: {
    redemptionRoulette?: string;
    doubleOrNothing?: boolean;
    shieldGambit?: string;
    traitorTrio?: string[];
  };
  finalePredictions?: FinalePredictions;
  league?: string;
}) => {
  const normalizedEmail = normalizeEmail(input.email || "");
  const normalizedWeekId =
    typeof input.weekId === "string" ? input.weekId.trim() : "";
  return pb.collection(SUBMISSIONS_COLLECTION).create({
    name: input.name,
    email: normalizedEmail,
    kind: "weekly",
    weeklyBanished: input.weeklyPredictions?.nextBanished || "",
    weeklyMurdered: input.weeklyPredictions?.nextMurdered || "",
    payload: {
      league: input.league || "main",
      weekId: normalizedWeekId,
      weeklyPredictions: {
        weekId: normalizedWeekId,
        nextBanished: input.weeklyPredictions?.nextBanished || "",
        nextMurdered: input.weeklyPredictions?.nextMurdered || "",
        bonusGames: {
          redemptionRoulette: input.bonusGames?.redemptionRoulette || "",
          doubleOrNothing: Boolean(input.bonusGames?.doubleOrNothing),
          shieldGambit: input.bonusGames?.shieldGambit || "",
          traitorTrio: input.bonusGames?.traitorTrio ?? [],
        },
        finalePredictions: {
          finalWinner: input.finalePredictions?.finalWinner || "",
          lastFaithfulStanding: input.finalePredictions?.lastFaithfulStanding || "",
          lastTraitorStanding: input.finalePredictions?.lastTraitorStanding || "",
          finalPotEstimate:
            typeof input.finalePredictions?.finalPotEstimate === "number" &&
            Number.isFinite(input.finalePredictions.finalPotEstimate)
              ? input.finalePredictions.finalPotEstimate
              : null,
        },
      },
    },
  });
};

export const submitDraftEntry = async (entry: {
  name: string;
  email: string;
  picks?: unknown;
  predFirstOut?: string;
  predWinner?: string;
  predTraitors?: unknown;
  weeklyPredictions?: { nextBanished: string; nextMurdered: string };
}) => {
  const normalizedEmail = normalizeEmail(entry.email || "");
  return pb.collection(SUBMISSIONS_COLLECTION).create({
    name: entry.name,
    email: normalizedEmail,
    kind: "draft",
    weeklyBanished: entry.weeklyPredictions?.nextBanished || "",
    weeklyMurdered: entry.weeklyPredictions?.nextMurdered || "",
    payload: entry,
  });
};

export const submitGrowthEvent = async (input: {
  event: "invite_share_clicked" | "invite_link_opened";
  name?: string;
  email?: string;
  payload?: Record<string, unknown>;
}) => {
  const normalizedEmail = normalizeEmail(input.email || "");
  return pb.collection(SUBMISSIONS_COLLECTION).create({
    name: input.name?.trim() || "growth",
    email: normalizedEmail || "growth@local",
    kind: "growth",
    payload: {
      event: input.event,
      ...input.payload,
    },
  });
};
