/**
 * Admin autosave is a 500ms debounce over the whole season_states JSON.
 * Since #192/#195, every write to season_states *and* seasons broadcasts
 * season_state_changed, and the client refetches. A single saveSeasonState
 * writes both tables, so each save echoes back twice.
 *
 * That refetch used to flip adminSeasonReady off (which cancels the debounce
 * timer) and then replace gameState with the last committed snapshot. That
 * wiped whatever the commissioner had typed during the echo, and the edit was
 * never written.
 *
 * Rules:
 * - Public clients apply every refresh (they never write).
 * - The first admin load of a season (or the first load after signing in)
 *   still gates autosave and applies the fetch, so a redacted public board
 *   can never be autosaved over the archive.
 * - A background admin refresh never resets adminSeasonReady, and it does not
 *   replace the board if a local edit is waiting to save, a save is in flight,
 *   or the board was edited or saved at any point while the fetch was out
 *   (the snapshot may predate that edit).
 * - Only the newest fetch may apply, so out-of-order responses cannot roll
 *   the board back.
 */

/** Identifies which board is on screen: the season plus admin vs. public view. */
export function seasonBoardKey(seasonId: string, isAdminAuthenticated: boolean): string {
  return `${seasonId}:${isAdminAuthenticated ? "admin" : "public"}`;
}

/** True only on the first admin load of this board. Never on a broadcast echo. */
export function shouldResetAdminSeasonReady(input: {
  isAdminAuthenticated: boolean;
  appliedBoardKey: string | null;
  requestBoardKey: string;
}): boolean {
  return input.isAdminAuthenticated && input.appliedBoardKey !== input.requestBoardKey;
}

export type AdminSeasonRefreshDecision = {
  /** Replace local gameState with the fetched snapshot. */
  applyRemote: boolean;
  /** Allow autosave (setAdminSeasonReady(true)). */
  markAdminReady: boolean;
};

export function decideAdminSeasonRefresh(input: {
  isAdminAuthenticated: boolean;
  /** Board key of what is on screen now, or null if nothing has loaded. */
  appliedBoardKey: string | null;
  /** Board key this fetch was made for. */
  requestBoardKey: string;
  /** This response belongs to the newest fetch started for this board. */
  isLatestFetch: boolean;
  /** The autosave timer is waiting to flush. */
  hasDebouncedSave: boolean;
  /** A saveSeasonState call is in flight. */
  hasPendingWrite: boolean;
  /** Local edit/save revision when the fetch started, and now. */
  editRevisionAtFetchStart: number;
  editRevisionNow: number;
}): AdminSeasonRefreshDecision {
  if (!input.isLatestFetch) {
    return { applyRemote: false, markAdminReady: false };
  }

  if (!input.isAdminAuthenticated) {
    return { applyRemote: true, markAdminReady: false };
  }

  const isBackgroundRefresh = input.appliedBoardKey === input.requestBoardKey;
  if (!isBackgroundRefresh) {
    return { applyRemote: true, markAdminReady: true };
  }

  const localWorkOutstanding =
    input.hasDebouncedSave ||
    input.hasPendingWrite ||
    input.editRevisionNow !== input.editRevisionAtFetchStart;
  if (localWorkOutstanding) {
    // Keep the commissioner's board and keep autosave armed. What is on screen
    // is what was, or is about to be, saved. The next clean refetch (another
    // broadcast, or the season list refresh) brings in anyone else's change.
    return { applyRemote: false, markAdminReady: true };
  }

  return { applyRemote: true, markAdminReady: true };
}
