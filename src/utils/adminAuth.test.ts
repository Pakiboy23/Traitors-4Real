import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_NOT_ADMIN_ERROR,
  adminAuthErrorMessage,
  applyAdminSessionResult,
  interpretAdminMembership,
  isConfirmedAdminMembership,
  createAdminLookupGeneration,
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
    expect(interpretAdminMembership({ data: null, error }, "user-9")).toEqual({
      status: "query_error",
      error,
      userId: "user-9",
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
  it("keeps the admin flag only when the failed lookup is the confirmed user", () => {
    expect(
      applyAdminSessionResult(
        { status: "query_error", error: { message: "permission denied" }, userId: "admin-1" },
        { isAuthenticated: true, authError: null, confirmedUserId: "admin-1" }
      )
    ).toEqual({
      isAuthenticated: true,
      authError: "permission denied",
      confirmedUserId: "admin-1",
    });
  });

  it("clears the admin flag when a query error has no attempted user", () => {
    expect(
      applyAdminSessionResult(
        { status: "query_error", error: { message: "timeout" } },
        { isAuthenticated: true, authError: null, confirmedUserId: "admin-1" }
      )
    ).toEqual({
      isAuthenticated: false,
      authError: "timeout",
      confirmedUserId: null,
    });
  });

  it("clears the admin flag when a different session's membership lookup fails", () => {
    // Otherwise a swapped tab session inherits AdminPanel under the new user.
    expect(
      applyAdminSessionResult(
        { status: "query_error", error: { message: "timeout" }, userId: "other-user" },
        { isAuthenticated: true, authError: null, confirmedUserId: "admin-1" }
      )
    ).toEqual({
      isAuthenticated: false,
      authError: "timeout",
      confirmedUserId: null,
    });
  });

  it("elevates only a confirmed admin and signs out a missing row", () => {
    expect(
      applyAdminSessionResult(
        { status: "admin", userId: "admin-1" },
        { isAuthenticated: false, authError: "stale", confirmedUserId: null }
      )
    ).toEqual({ isAuthenticated: true, authError: null, confirmedUserId: "admin-1" });
    expect(
      applyAdminSessionResult(
        { status: "not_admin" },
        { isAuthenticated: true, authError: null, confirmedUserId: "admin-1" }
      )
    ).toEqual({ isAuthenticated: false, authError: null, confirmedUserId: null });
  });
});

describe("createAdminLookupGeneration", () => {
  it("keeps the first token current until a newer lookup starts", () => {
    const generation = createAdminLookupGeneration();
    const first = generation.start();
    expect(generation.isCurrent(first)).toBe(true);
  });

  it("treats an older token as stale after a later lookup starts", () => {
    // getSession must stamp before it awaits. If SIGNED_IN starts afterward,
    // the empty session that settles late must not win.
    const generation = createAdminLookupGeneration();
    const getSessionToken = generation.start();
    const signedInToken = generation.start();
    expect(generation.isCurrent(getSessionToken)).toBe(false);
    expect(generation.isCurrent(signedInToken)).toBe(true);
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
    expect(supabaseAuth).toMatch(/interpretAdminMembership\(query, userId\)/);
    expect(supabaseAuth).not.toMatch(/callback\(\s*false\s*\)/);
    expect(appSource).toMatch(/applyAdminSessionResult/);
    expect(appSource).toMatch(/confirmedAdminUserIdRef/);
  });

  it("surfaces sign-in failures instead of swallowing them", () => {
    expect(appSource).not.toMatch(/catch\s*\{\s*return false;\s*\}/);
    expect(appSource).toMatch(/adminAuthError/);
    expect(appSource).toMatch(/adminAuthPending/);
  });

  it("stamps getSession before the promise settles", () => {
    expect(supabaseAuth).toMatch(/const initialToken = generation\.start\(\)/);
    expect(supabaseAuth).toMatch(/generation\.isCurrent\(initialToken\)/);
    expect(supabaseAuth).toMatch(/generation\.start\(\)/);
  });
});
