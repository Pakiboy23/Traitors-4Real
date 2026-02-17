import PocketBase from "pocketbase";

/**
 * Resolves the PocketBase URL from environment variables
 * Falls back to localhost in development, but fails in production if not set
 */
const resolvePocketBaseUrl = (): string => {
  const envUrl = (import.meta.env.VITE_POCKETBASE_URL as string | undefined)?.trim();

  // If URL is provided, use it
  if (envUrl) {
    return envUrl;
  }

  // In production, fail fast if URL is not set
  if (import.meta.env.PROD) {
    throw new Error(
      'VITE_POCKETBASE_URL environment variable is required in production. ' +
      'Please set it to your PocketBase server URL.'
    );
  }

  // In development, fall back to localhost
  console.warn('VITE_POCKETBASE_URL not set, using default: http://127.0.0.1:8090');
  return "http://127.0.0.1:8090";
};

export const pocketbaseUrl = resolvePocketBaseUrl();
export const pb = new PocketBase(pocketbaseUrl);

// Prevent overlapping requests from canceling each other in React renders.
pb.autoCancellation(false);
