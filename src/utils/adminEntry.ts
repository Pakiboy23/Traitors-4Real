/**
 * Whether the Admin tab appears in the navigation.
 *
 * It used to appear for everyone. That is wrong twice over: players who can
 * never use it see a tab that only ever shows them a login wall, and an App
 * Review tester will tap it first — an unexplained password screen is the kind
 * of thing that draws a request for demo credentials, or a 2.1 rejection for
 * looking incomplete.
 *
 * Hiding it entirely is not an option either, because that tab is the only
 * route to the sign-in screen. So it stays hidden until asked for by URL, and
 * remains visible once signed in.
 *
 *   https://traitorsfantasydraft.online/?admin=1
 *   https://traitorsfantasydraft.online/#admin
 *
 * Neither is a security control — the admin panel is protected by Supabase
 * auth and row-level security, not by the tab being hard to find. This only
 * decides who has to look at it.
 */

export const ADMIN_QUERY_KEY = "admin";
export const ADMIN_HASH = "#admin";

export interface AdminEntryInput {
  isAuthenticated: boolean;
  /** location.search, e.g. "?admin=1" */
  search?: string;
  /** location.hash, e.g. "#admin" */
  hash?: string;
}

const truthy = new Set(["1", "true", "yes"]);

/** True when the URL is asking for the admin entry point. */
export const isAdminRequestedByUrl = (search = "", hash = ""): boolean => {
  if (hash.trim().toLowerCase() === ADMIN_HASH) return true;

  // A bare "?admin" counts: it is what someone types from memory, and treating
  // it as a miss would send them to a page that looks like it lost the setting.
  try {
    const params = new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search
    );
    if (!params.has(ADMIN_QUERY_KEY)) return false;
    const value = (params.get(ADMIN_QUERY_KEY) ?? "").trim().toLowerCase();
    return value === "" || truthy.has(value);
  } catch {
    return false;
  }
};

export const shouldShowAdminTab = ({
  isAuthenticated,
  search = "",
  hash = "",
}: AdminEntryInput): boolean =>
  isAuthenticated || isAdminRequestedByUrl(search, hash);
