import { RECAP_PUBLIC_ORIGIN } from "./weeklyRecap";

const RECAP_HOSTS = new Set([
  "traitorsfantasydraft.online",
  "www.traitorsfantasydraft.online",
]);

export interface RecapDeepLink {
  seasonId: string | null;
  weekId: string;
  url: string;
}

/**
 * Accept only an https recap URL on the public site. The lock-reminder
 * function is reachable with the anon key, so an arbitrary URL would let
 * anyone push a link to every registered phone.
 *
 * Keep the host and path checks in send-lock-reminder in step with this.
 */
export const sanitizePushDeepLink = (input: unknown): string | null => {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!RECAP_HOSTS.has(url.hostname)) return null;
  if (!url.pathname.startsWith("/recap/")) return null;
  url.hash = "";
  return url.toString();
};

const decodeSegment = (value: string): string | null => {
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
};

/** Pull season and week out of a recap URL. A one-segment path is week-only. */
export const parseRecapDeepLink = (input: unknown): RecapDeepLink | null => {
  const sanitized = sanitizePushDeepLink(input);
  if (!sanitized) return null;
  const url = new URL(sanitized);
  const segments = url.pathname.split("/").filter((part) => part.length > 0);
  if (segments[0] !== "recap") return null;
  if (segments.length === 2) {
    const weekId = decodeSegment(segments[1] ?? "");
    if (!weekId) return null;
    return { seasonId: null, weekId, url: sanitized };
  }
  if (segments.length === 3) {
    const seasonId = decodeSegment(segments[1] ?? "");
    const weekId = decodeSegment(segments[2] ?? "");
    if (!seasonId || !weekId) return null;
    return { seasonId, weekId, url: sanitized };
  }
  return null;
};

export const recapDeepLinkUrl = (seasonId: string, weekId: string): string =>
  `${RECAP_PUBLIC_ORIGIN}/recap/${encodeURIComponent(seasonId)}/${encodeURIComponent(weekId)}`;
