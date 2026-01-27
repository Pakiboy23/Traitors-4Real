import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../src/lib/firebase";

const PLAYER_PORTRAITS_COLLECTION = "playerPortraits";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const fetchPlayerPortraits = async () => {
  const snapshot = await getDocs(collection(db, PLAYER_PORTRAITS_COLLECTION));
  const portraits: Record<string, string> = {};
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as { portraitUrl?: string };
    if (data.portraitUrl) portraits[docSnap.id] = data.portraitUrl;
  });
  return portraits;
};

export const savePlayerPortrait = async (email: string, name: string, portraitUrl: string) => {
  const docId = normalizeEmail(email);
  if (!docId) return;
  await setDoc(
    doc(db, PLAYER_PORTRAITS_COLLECTION, docId),
    {
      email: docId,
      name,
      portraitUrl,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
