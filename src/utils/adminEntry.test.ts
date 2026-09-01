import { describe, expect, it } from "vitest";
import {
  ADMIN_REVEAL_TAPS,
  ADMIN_REVEAL_WINDOW_MS,
  emptyAdminRevealTapState,
  isAdminRequestedByUrl,
  registerAdminRevealTap,
  shouldShowAdminTab,
} from "./adminEntry";

describe("isAdminRequestedByUrl", () => {
  it.each([
    ["?admin=1", ""],
    ["?admin=true", ""],
    ["?admin=yes", ""],
    ["?admin", ""],
    ["?admin=", ""],
    ["?season=x&admin=1", ""],
    ["", "#admin"],
    ["", "#ADMIN"],
  ])("opens the door for search=%o hash=%o", (search, hash) => {
    expect(isAdminRequestedByUrl(search, hash)).toBe(true);
  });

  it.each([
    ["", ""],
    ["?season=traitors-new-blood-s1", ""],
    ["?admin=0", ""],
    ["?admin=false", ""],
    ["?administrator=1", ""],
    ["", "#leaderboard"],
    // A tab named "admin" elsewhere in the hash must not count.
    ["", "#not-admin"],
  ])("stays shut for search=%o hash=%o", (search, hash) => {
    expect(isAdminRequestedByUrl(search, hash)).toBe(false);
  });

  it("survives a malformed query string", () => {
    expect(isAdminRequestedByUrl("?%%%", "")).toBe(false);
  });
});

describe("shouldShowAdminTab", () => {
  it("is hidden from an ordinary player", () => {
    expect(shouldShowAdminTab({ isAuthenticated: false })).toBe(false);
  });

  it("stays visible once signed in, without the URL", () => {
    // Otherwise the tab would vanish under the admin the moment they navigated.
    expect(shouldShowAdminTab({ isAuthenticated: true })).toBe(true);
  });

  it("appears for an unauthenticated admin who used the URL", () => {
    // This is the only route to the sign-in screen, so it has to work before
    // authentication or the panel is unreachable.
    expect(shouldShowAdminTab({ isAuthenticated: false, search: "?admin=1" })).toBe(true);
  });

  it("appears for a remembered footer reveal, with no URL at all", () => {
    // The iOS case: capacitor://localhost/index.html, no address bar, so the
    // URL can never carry the flag. Without this the panel is unreachable on
    // the only platform the league plays on.
    expect(shouldShowAdminTab({ isAuthenticated: false, isRevealed: true })).toBe(true);
  });
});

describe("registerAdminRevealTap", () => {
  const tapRepeatedly = (times: number, gapMs: number) => {
    let state = emptyAdminRevealTapState();
    let revealed = false;
    let now = 1_000;

    for (let i = 0; i < times; i += 1) {
      const result = registerAdminRevealTap(state, now);
      revealed = result.revealed;
      state = { count: result.count, lastTapAt: result.lastTapAt };
      now += gapMs;
    }

    return { state, revealed };
  };

  it("stays shut short of the full gesture", () => {
    expect(tapRepeatedly(ADMIN_REVEAL_TAPS - 1, 200).revealed).toBe(false);
  });

  it("opens on the last tap of a quick run", () => {
    expect(tapRepeatedly(ADMIN_REVEAL_TAPS, 200).revealed).toBe(true);
  });

  it("does not open when the taps are spread past the window", () => {
    // Otherwise a player who idly prods the footer over a whole season would
    // eventually land on the admin screen without ever asking for it.
    expect(tapRepeatedly(ADMIN_REVEAL_TAPS * 3, ADMIN_REVEAL_WINDOW_MS + 1).revealed).toBe(
      false
    );
  });

  it("restarts the count after a gap instead of resuming it", () => {
    const state = { count: ADMIN_REVEAL_TAPS - 1, lastTapAt: 1_000 };
    const result = registerAdminRevealTap(state, 1_000 + ADMIN_REVEAL_WINDOW_MS + 1);

    expect(result.revealed).toBe(false);
    expect(result.count).toBe(1);
  });

  it("clears its counter once it opens, so it cannot re-fire on one more tap", () => {
    const { state } = tapRepeatedly(ADMIN_REVEAL_TAPS, 200);
    expect(state.count).toBe(0);
  });
});
