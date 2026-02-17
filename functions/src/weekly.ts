import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

const adminApp = getApps().length ? getApps()[0] : initializeApp();
const adminDb = getFirestore(adminApp);

const FIRESTORE_COLLECTION = "games";
const FIRESTORE_DOC_ID = "default";

const clean = (value: string | undefined | null) => (value || "").trim();
const normalize = (value: string | undefined | null) => clean(value).toLowerCase();

const getEasternNowParts = () => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return {
    weekday: get("weekday"),
    year: Number(get("year") || 0),
    month: Number(get("month") || 0),
    day: Number(get("day") || 0),
    hour: Number(get("hour") || 0),
    minute: Number(get("minute") || 0),
  };
};

const isWeeklyVoteLocked = () => {
  const { weekday, year, month, day, hour, minute } = getEasternNowParts();
  const startYear = 2026;
  const startMonth = 2;
  const startDay = 5;
  const isOnOrAfterStartDate =
    year > startYear ||
    (year === startYear &&
      (month > startMonth || (month === startMonth && day >= startDay)));

  if (!isOnOrAfterStartDate || weekday !== "Thu") {
    return false;
  }

  const minutesSinceMidnight = hour * 60 + minute;
  const lockStart = 20 * 60 + 55;
  const lockEnd = 23 * 60;
  return minutesSinceMidnight >= lockStart && minutesSinceMidnight < lockEnd;
};

export const submitWeeklyVotes = onCall(async (request) => {
  if (isWeeklyVoteLocked()) {
    throw new HttpsError(
      "failed-precondition",
      "Weekly voting is closed between 8:55pm and 11pm ET on Thursdays. Please try again later."
    );
  }

  const name = clean(request.data?.name);
  const normalizedName = normalize(name);
  const email = normalize(request.data?.email);
  const league = normalize(request.data?.league) === "jr" ? "jr" : "main";
  const nextBanished = (request.data?.nextBanished || "").toString();
  const nextMurdered = (request.data?.nextMurdered || "").toString();

  if (!name) {
    throw new HttpsError("invalid-argument", "Name is required.");
  }
  if (!nextBanished && !nextMurdered) {
    throw new HttpsError(
      "invalid-argument",
      "Please select at least one weekly council prediction."
    );
  }

  const docRef = adminDb.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Game state not found.");
    }
    const data = snap.data();
    const state = data?.state;
    if (!state || !Array.isArray(state.players)) {
      throw new HttpsError("failed-precondition", "Invalid game state.");
    }

    const players = state.players as Array<any>;
    let target = players.find((p) => {
      const matchesLeague = league === "jr" ? p.league === "jr" : p.league !== "jr";
      return matchesLeague && normalize(p.name) === normalizedName;
    });
    if (!target && email) {
      target = players.find((p) => {
        const matchesLeague = league === "jr" ? p.league === "jr" : p.league !== "jr";
        return matchesLeague && normalize(p.email) === email;
      });
    }

    if (!target && league !== "jr") {
      throw new HttpsError(
        "not-found",
        "We couldn't find your draft entry. Please enter the exact name shown on the Leaderboard or the same email used for your draft."
      );
    }

    if (!target && league === "jr") {
      target = {
        id: `jr-${Date.now()}`,
        name,
        email,
        league: "jr",
        picks: [],
        predFirstOut: "",
        predWinner: "",
        predTraitors: [],
      };
    }

    const updatedPlayers = players.map((p) => {
      if (p.id !== target.id) return p;
      return {
        ...p,
        name,
        email,
        weeklyPredictions: {
          nextBanished,
          nextMurdered,
        },
      };
    });

    if (!players.some((p) => p.id === target.id)) {
      updatedPlayers.push({
        ...target,
        weeklyPredictions: {
          nextBanished,
          nextMurdered,
        },
      });
    }

    tx.set(
      docRef,
      {
        state: { ...state, players: updatedPlayers },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return { ok: true };
});
