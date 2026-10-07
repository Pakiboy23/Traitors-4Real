import { describe, expect, it } from "vitest";
import { decideAdminSeasonRefresh } from "./adminSeasonRefresh";

describe("decideAdminSeasonRefresh", () => {
  it("lets public clients apply every broadcast", () => {
    expect(
      decideAdminSeasonRefresh({
        isAdminAuthenticated: false,
        isBackgroundRefresh: true,
        hasDebouncedSave: true,
        hasPendingWrite: true,
      })
    ).toEqual({ resetAdminReady: false, applyRemote: true });
  });

  it("gates autosave on the first admin load so a redacted board cannot save", () => {
    expect(
      decideAdminSeasonRefresh({
        isAdminAuthenticated: true,
        isBackgroundRefresh: false,
        hasDebouncedSave: false,
        hasPendingWrite: false,
      })
    ).toEqual({ resetAdminReady: true, applyRemote: true });
  });

  it("does not cancel a pending debounce or overwrite local edits on a self-echo", () => {
    expect(
      decideAdminSeasonRefresh({
        isAdminAuthenticated: true,
        isBackgroundRefresh: true,
        hasDebouncedSave: true,
        hasPendingWrite: false,
      })
    ).toEqual({ resetAdminReady: false, applyRemote: false });
  });

  it("does not replace the board while a save is in flight", () => {
    expect(
      decideAdminSeasonRefresh({
        isAdminAuthenticated: true,
        isBackgroundRefresh: true,
        hasDebouncedSave: false,
        hasPendingWrite: true,
      })
    ).toEqual({ resetAdminReady: false, applyRemote: false });
  });

  it("still applies a clean background refresh so another tab can land", () => {
    expect(
      decideAdminSeasonRefresh({
        isAdminAuthenticated: true,
        isBackgroundRefresh: true,
        hasDebouncedSave: false,
        hasPendingWrite: false,
      })
    ).toEqual({ resetAdminReady: false, applyRemote: true });
  });
});
