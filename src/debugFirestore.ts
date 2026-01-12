import { doc, setDoc } from "firebase/firestore";
import { db } from "./lib/firebase";

export async function testFirestore() {
  await setDoc(doc(db, "debug", "alive"), {
    ok: true,
    timestamp: Date.now(),
  });
}
testFirestore();

