import PocketBase from "pocketbase";

const resolvedUrl =
  (import.meta.env.VITE_POCKETBASE_URL as string | undefined)?.trim() ||
  "http://127.0.0.1:8090";

export const pocketbaseUrl = resolvedUrl;
export const pb = new PocketBase(resolvedUrl);

// Prevent overlapping requests from canceling each other in React renders.
pb.autoCancellation(false);
