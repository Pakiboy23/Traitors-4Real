import { describe, expect, it } from "vitest";
import { isAdminRequestedByUrl, shouldShowAdminTab } from "./adminEntry";

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
});
