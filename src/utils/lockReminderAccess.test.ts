import { describe, expect, it } from "vitest";
import { ADMIN_NOT_ADMIN_ERROR } from "./adminAuth";
import {
  LOCK_REMINDER_UNAUTHORIZED,
  LOCK_REMINDER_UNAVAILABLE,
  accessTokenFromAuthorization,
  adminMembershipQuery,
  decideLockReminderCaller,
  isProjectApiKey,
} from "./lockReminderAccess";

const anonKey = "anon-key";
const serviceRoleKey = "service-role-key";
const accessToken = "user-access-token";

const caller = (
  overrides: Partial<Parameters<typeof decideLockReminderCaller>[0]> = {}
) =>
  decideLockReminderCaller({
    accessToken,
    anonKey,
    serviceRoleKey,
    user: { id: "admin-1" },
    userError: false,
    membership: { data: { user_id: "admin-1" }, error: null },
    ...overrides,
  });

describe("accessTokenFromAuthorization", () => {
  it("reads a bearer token and rejects anything else", () => {
    expect(accessTokenFromAuthorization("Bearer user-access-token")).toBe(
      "user-access-token"
    );
    expect(accessTokenFromAuthorization("bearer user-access-token")).toBe(
      "user-access-token"
    );
    expect(accessTokenFromAuthorization(null)).toBeNull();
    expect(accessTokenFromAuthorization("")).toBeNull();
    expect(accessTokenFromAuthorization(anonKey)).toBeNull();
    expect(accessTokenFromAuthorization("Basic user-access-token")).toBeNull();
  });
});

describe("isProjectApiKey", () => {
  it("recognises the anon key and the service-role key", () => {
    expect(isProjectApiKey(anonKey, anonKey, serviceRoleKey)).toBe(true);
    expect(isProjectApiKey(serviceRoleKey, anonKey, serviceRoleKey)).toBe(true);
    expect(isProjectApiKey(accessToken, anonKey, serviceRoleKey)).toBe(false);
    expect(isProjectApiKey(accessToken, null, null)).toBe(false);
  });
});

describe("decideLockReminderCaller", () => {
  it("accepts a verified user whose admin_users row matches", () => {
    expect(caller()).toEqual({ status: "admin", userId: "admin-1" });
  });

  it("returns 401 inputs for a missing token, a project key, or a failed getUser", () => {
    expect(caller({ accessToken: null }).status).toBe("unauthorized");
    expect(caller({ accessToken: anonKey }).status).toBe("unauthorized");
    expect(caller({ accessToken: serviceRoleKey }).status).toBe("unauthorized");
    expect(caller({ userError: true, user: null, membership: null }).status).toBe(
      "unauthorized"
    );
    expect(caller({ user: null, membership: null }).status).toBe("unauthorized");
    expect(LOCK_REMINDER_UNAUTHORIZED).toMatch(/authorization/i);
  });

  it("does not treat a project key as an admin even if a user and a row are supplied", () => {
    expect(
      caller({
        accessToken: anonKey,
        user: { id: "admin-1" },
        membership: { data: { user_id: "admin-1" }, error: null },
      })
    ).toEqual({ status: "unauthorized" });
  });

  it("returns forbidden for a signed-in user with no admin_users row", () => {
    expect(caller({ membership: { data: null, error: null } })).toEqual({
      status: "forbidden",
    });
    expect(ADMIN_NOT_ADMIN_ERROR).toBe("Not an admin user");
  });

  it("refuses a membership row for a different user", () => {
    expect(
      caller({ membership: { data: { user_id: "someone-else" }, error: null } })
    ).toEqual({ status: "forbidden" });
  });

  it("keeps a membership query failure distinct from not-an-admin", () => {
    expect(
      caller({
        membership: adminMembershipQuery(null, { message: "permission denied", code: "42501" }),
      })
    ).toEqual({ status: "unavailable" });
    expect(caller({ membership: null })).toEqual({ status: "unavailable" });
    expect(LOCK_REMINDER_UNAVAILABLE).toBe("Could not verify admin membership.");
  });

  it("drops a row whose user_id is not a string", () => {
    expect(adminMembershipQuery({ user_id: 12 }, null)).toEqual({
      data: null,
      error: null,
    });
  });
});
