import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
const adminApp = getApps().length ? getApps()[0] : initializeApp();
const adminDb = getFirestore(adminApp);
const FIRESTORE_COLLECTION = "games";
const FIRESTORE_DOC_ID = "default";
const normalize = (value) => (value || "").trim().toLowerCase();
const getEasternNowParts = () => {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    return {
        weekday: get("weekday"),
        hour: Number(get("hour") || 0),
        minute: Number(get("minute") || 0),
    };
};
const isWeeklyVoteLocked = () => {
    const { weekday, hour } = getEasternNowParts();
    return weekday === "Thu" && hour >= 21;
};
export const submitWeeklyVotes = onCall(async (request) => {
    if (isWeeklyVoteLocked()) {
        throw new HttpsError("failed-precondition", "Weekly voting locks after 9pm ET on Thursdays. Please try again later.");
    }
    const name = normalize(request.data?.name);
    const email = normalize(request.data?.email);
    const nextBanished = (request.data?.nextBanished || "").toString();
    const nextMurdered = (request.data?.nextMurdered || "").toString();
    if (!name) {
        throw new HttpsError("invalid-argument", "Name is required.");
    }
    if (!nextBanished && !nextMurdered) {
        throw new HttpsError("invalid-argument", "Please select at least one weekly council prediction.");
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
        const players = state.players;
        let target = players.find((p) => normalize(p.name) === name);
        if (!target && email) {
            target = players.find((p) => normalize(p.email) === email);
        }
        if (!target) {
            throw new HttpsError("not-found", "We couldn't find your draft entry. Please enter the exact name shown on the Leaderboard or the same email used for your draft.");
        }
        const updatedPlayers = players.map((p) => {
            if (p.id !== target.id)
                return p;
            return {
                ...p,
                weeklyPredictions: {
                    nextBanished,
                    nextMurdered,
                },
            };
        });
        tx.set(docRef, {
            state: { ...state, players: updatedPlayers },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    return { ok: true };
});
