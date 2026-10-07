/**
 * Admin autosave is a 500ms debounce over the whole season_states JSON.
 * After #192/#195 every write to season_states *and* seasons broadcasts
 * season_state_changed, and the client refetches. That refetch used to flip
 * adminSeasonReady off (which cancels the debounce timer) and then replace
 * gameState with the last committed snapshot — wiping the next edit the
 * commissioner typed during the echo.
 *
 * Public clients still apply every refresh. Admin first-load still gates
 * autosave so a redacted public board cannot be written over the archive.
 */

export type AdminSeasonRefreshDecision = {
  /** Flip adminSeasonReady to false before the fetch. First load only. */
  resetAdminReady: boolean;
  /** Replace local gameState with the fetched snapshot. */
  applyRemote: boolean;
};

export function decideAdminSeasonRefresh(input: {
  isAdminAuthenticated: boolean;
  /** This season is already on screen; this call is a broadcast or list refresh. */
  isBackgroundRefresh: boolean;
  /** Autosave timer is waiting to flush. */
  hasDebouncedSave: boolean;
  /** saveSeasonState is in flight. */
  hasPendingWrite: boolean;
}): AdminSeasonRefreshDecision {
  if (!input.isAdminAuthenticated) {
    return { resetAdminReady: false, applyRemote: true };
  }

  if (!input.isBackgroundRefresh) {
    return { resetAdminReady: true, applyRemote: true };
  }

  if (input.hasDebouncedSave || input.hasPendingWrite) {
    return { resetAdminReady: false, applyRemote: false };
  }

  return { resetAdminReady: false, applyRemote: true };
}
