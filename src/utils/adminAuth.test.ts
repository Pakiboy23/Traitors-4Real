import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_NOT_ADMIN_ERROR,
  adminAuthErrorMessage,
  applyAdminSessionResult,
  interpretAdminMembership,
  isConfirmedAdminMembership,
  shouldApplyInitialSessionLookup,
  settleAdminSignInMembership,
} from "./adminAuth";

const repoRoot = path.resolve(__dirname, "../..");
const supabaseAuth = readFileSync(path.join(repoRoot, "services/supabase.ts"), "utf8");
const appSource = readFileSync(path.join(repoRoot, "App.tsx"), "utf8");

const adminRow = { user_id: "admin-1" };

describe("interpretAdminMembership", () => {
  it("confirms a present admin_users row", () => {
    expect(interpretAdminMembership({ data: adminRow, error: null })).toEqual({
      status: "admin",
      userId: "admin-1",
    });
  });

  it("treats maybeSingle empty data as not an admin, not a query failure", () => {
    expect(interpretAdminMembership({ data: null, error: null })).toEqual({
      status: "not_admin",
    });
  });

  it("keeps a query error distinct from a missing row", () => {
    const error = { message: "permission denied", code: "42501" };
    expect(interpretAdminMembership({ data: null, error })).toEqual({
      status: "query_error",
      error,
    });
  });
});

describe("isConfirmedAdminMembership", () => {
  it("elevates only after membership is confirmed", () => {
    expect(isConfirmedAdminMembership({ data: adminRow, error: null })).toBe(true);
    expect(isConfirmedAdminMembership({ data: null, error: null })).toBe(false);
    expect(
      isConfirmedAdminMembership({ data: null, error: { message: "timeout" } })
    ).toBe(false);
  });
});

describe("settleAdminSignInMembership", () => {
  it("does not sign out when the membership query fails", async () => {
    const signOut = vi.fn();
    const error = { message: "JWT expired", code: "PGRST301" };

    await expect(
      settleAdminSignInMembership({ data: null, error }, signOut)
    ).rejects.toEqual(error);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out and throws a clear error when there is no admin row", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);

    await expect(
      settleAdminSignInMembership({ data: null, error: null }, signOut)
    ).rejects.toThrow(ADMIN_NOT_ADMIN_ERROR);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("resolves for a confirmed admin without signing out", async () => {
    const signOut = vi.fn();

    await expect(
      settleAdminSignInMembership({ data: adminRow, error: null }, signOut)
    ).resolves.toBeUndefined();
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("applyAdminSessionResult", () => {
  it("does not treat a membership query failure as signed-out", () => {
    expect(
      applyAdminSessionResult(
        { status: "query_error", error: { message: "permission denied" } },
        { isAuthenticated: true, authError: null }
      )
    ).toEqual({ isAuthenticated: true, authError: "permission denied" });
    expect(
      applyAdminSessionResult(
        { status: "query_error", error: { message: "timeout" } },
        { isAuthenticated: false, authError: null }
      )
    ).toEqual({ isAuthenticated: false, authError: "timeout" });
  });

  it("elevates only a confirmed admin and signs out a missing row", () => {
    expect(
      applyAdminSessionResult(
        { status: "admin", userId: "admin-1" },
        { isAuthenticated: false, authError: "stale" }
      )
    ).toEqual({ isAuthenticated: true, authError: null });
    expect(
      applyAdminSessionResult(
        { status: "not_admin" },
        { isAuthenticated: true, authError: null }
      )
    ).toEqual({ isAuthenticated: false, authError: null });
  });
});

describe("shouldApplyInitialSessionLookup", () => {
  it("accepts the initial getSession only while it is still the latest lookup", () => {
    expect(
      shouldApplyInitialSessionLookup({ stampedId: 1, latestId: 1, authEventSeen: false })
    ).toBe(true);
  });

  it("discards a late getSession after SIGNED_IN has already been seen", () => {
    // Otherwise a slow empty getSession overwrites a confirmed admin and
    // bounces them back to the login form.
    expect(
      shouldApplyInitialSessionLookup({ stampedId: 1, latestId: 2, authEventSeen: true })
    ).toBe(false);
    expect(
      shouldApplyInitialSessionLookup({ stampedId: 1, latestId: 1, authEventSeen: true })
    ).toBe(false);
  });
});

describe("adminAuthErrorMessage", () => {
  it("keeps Error and Postgrest-shaped messages readable", () => {
    expect(adminAuthErrorMessage(new Error(ADMIN_NOT_ADMIN_ERROR))).toBe(
      ADMIN_NOT_ADMIN_ERROR
    );
    expect(adminAuthErrorMessage({ message: "Invalid login credentials" })).toBe(
      "Invalid login credentials"
    );
    expect(adminAuthErrorMessage({})).toBe("Authentication failed");
  });
});

describe("admin session wiring", () => {
  it("does not elevate the admin UI on a raw Supabase session", () => {
    // The remount bounce: SIGNED_IN swapped AdminAuth for AdminPanel before
    // admin_users was checked, then signOut remounted an empty form.
    expect(supabaseAuth).not.toMatch(/callback\(\s*!!session\?\.user\s*\)/);
    expect(supabaseAuth).toMatch(/admin_users[\s\S]*?maybeSingle\(\)/);
  });

  it("keeps auth-state membership failures distinct from unauthenticated", () => {
    expect(supabaseAuth).toMatch(/interpretAdminMembership/);
    expect(supabaseAuth).not.toMatch(/callback\(\s*false\s*\)/);
    expect(appSource).toMatch(/status === "query_error"/);
    expect(appSource).toMatch(/setAdminAuthError\(adminAuthErrorMessage/);
    expect(appSource).not.toMatch(
      /status === "query_error"[\s\S]*?setIsAdminAuthenticated\(false\)/
    );
  });

  it("surfaces sign-in failures instead of swallowing them", () => {
    expect(appSource).not.toMatch(/catch\s*\{\s*return false;\s*\}/);
    expect(appSource).toMatch(/adminAuthError/);
    expect(appSource).toMatch(/adminAuthPending/);
  });

  it("stamps getSession before the promise settles", () => {
    expect(supabaseAuth).toMatch(/const initialId = \+\+requestId/);
    expect(supabaseAuth).toMatch(/shouldApplyInitialSessionLookup/);
    expect(supabaseAuth).toMatch(/authEventSeen = true/);
  });
});
