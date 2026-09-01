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
 * route to the sign-in screen. So it stays hidden until asked for, and remains
 * visible once signed in.
 *
 * There are two ways to ask. On the web, the URL:
 *
 *   https://traitorsfantasydraft.online/?admin=1
 *   https://traitorsfantasydraft.online/#admin
 *
 * On iOS neither of those exists. The bundled build loads
 * `capacitor://localhost/index.html` inside a web view with no address bar, so
 * a URL-only gate makes the admin panel unreachable on the one platform this
 * league actually plays on. The second way is therefore a gesture: tap the
 * footer ADMIN_REVEAL_TAPS times inside ADMIN_REVEAL_WINDOW_MS. That answer is
 * remembered under ADMIN_REVEAL_STORAGE_KEY so it survives a relaunch, the way
 * signing in already did.
 *
 * None of this is a security control — the admin panel is protected by
 * Supabase auth and row-level security, not by the tab being hard to find.
 * This only decides who has to look at it.
 */

export const ADMIN_QUERY_KEY = "admin";
export const ADMIN_HASH = "#admin";

/** localStorage key holding the remembered footer-gesture reveal. */
export const ADMIN_REVEAL_STORAGE_KEY = "traitors_admin_revealed";

/** Taps needed to reveal the tab. High enough that nobody trips it browsing. */
export const ADMIN_REVEAL_TAPS = 5;

/**
 * The whole run of taps must land inside this window, measured from the first
 * tap — not from the previous one. A per-gap window silently accumulates: five
 * taps 2.9s apart would each be "in time" and reveal the tab after 11.6s,
 * which is idle prodding, not a gesture.
 */
export const ADMIN_REVEAL_WINDOW_MS = 3000;

export interface AdminEntryInput {
  isAuthenticated: boolean;
  /** location.search, e.g. "?admin=1" */
  search?: string;
  /** location.hash, e.g. "#admin" */
  hash?: string;
  /** A previously remembered footer-gesture reveal. */
  isRevealed?: boolean;
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
  isRevealed = false,
}: AdminEntryInput): boolean =>
  isAuthenticated || isRevealed || isAdminRequestedByUrl(search, hash);

export interface AdminRevealTapState {
  /** Taps counted so far in the current window. */
  count: number;
  /** When the current run started. The window is measured from here. */
  firstTapAt: number;
}

export interface AdminRevealTapResult extends AdminRevealTapState {
  /** True on the tap that completes the gesture. */
  revealed: boolean;
}

export const emptyAdminRevealTapState = (): AdminRevealTapState => ({
  count: 0,
  firstTapAt: 0,
});

/**
 * Fold one tap into the reveal gesture. Pure so the counting rules are testable
 * without a DOM — the suite here runs in plain Node.
 */
export const registerAdminRevealTap = (
  state: AdminRevealTapState,
  now: number
): AdminRevealTapResult => {
  // count > 0 is what distinguishes a run in progress from the empty state,
  // whose firstTapAt of 0 would otherwise read as "started long ago" for a
  // real clock and "started just now" for a small test one.
  const continuesRun =
    state.count > 0 && now - state.firstTapAt <= ADMIN_REVEAL_WINDOW_MS;

  const count = continuesRun ? state.count + 1 : 1;
  const firstTapAt = continuesRun ? state.firstTapAt : now;

  if (count >= ADMIN_REVEAL_TAPS) {
    return { ...emptyAdminRevealTapState(), revealed: true };
  }

  return { count, firstTapAt, revealed: false };
};
