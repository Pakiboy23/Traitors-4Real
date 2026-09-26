import {
  ADMIN_NOT_ADMIN_ERROR,
  interpretAdminMembership,
  type AdminMembershipQuery,
} from "./adminAuth.ts";

export { ADMIN_NOT_ADMIN_ERROR };

export const LOCK_REMINDER_UNAUTHORIZED = "Missing or invalid authorization.";
export const LOCK_REMINDER_UNAVAILABLE = "Could not verify admin membership.";

export type LockReminderCaller =
  | { status: "admin"; userId: string }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "unavailable" };

/** Bearer token from an Authorization header. Non-Bearer values are missing. */
export const accessTokenFromAuthorization = (
  header: string | null | undefined
): string | null => {
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
};

/**
 * The anon key and the service-role key are both valid project JWTs, and the
 * gateway accepts them. Neither is a user, so they must not reach getUser.
 */
export const isProjectApiKey = (
  accessToken: string,
  anonKey: string | null | undefined,
  serviceRoleKey: string | null | undefined
): boolean => {
  if (anonKey && accessToken === anonKey) return true;
  if (serviceRoleKey && accessToken === serviceRoleKey) return true;
  return false;
};

/** Shape the admin_users row the same way the Admin tab's maybeSingle query does. */
export const adminMembershipQuery = (
  data: { user_id?: unknown } | null | undefined,
  error: { message?: string; code?: string } | null | undefined
): AdminMembershipQuery => ({
  data: typeof data?.user_id === "string" ? { user_id: data.user_id } : null,
  error: error ?? null,
});

/**
 * Same membership decision as the Admin tab: interpretAdminMembership on an
 * admin_users row for the verified user. A query failure stays distinct from
 * "not an admin" so a database error is not reported as a permissions denial.
 */
export const decideLockReminderCaller = (input: {
  accessToken: string | null;
  anonKey?: string | null;
  serviceRoleKey?: string | null;
  user: { id: string } | null;
  userError: boolean;
  membership: AdminMembershipQuery | null;
}): LockReminderCaller => {
  if (!input.accessToken) return { status: "unauthorized" };
  if (isProjectApiKey(input.accessToken, input.anonKey, input.serviceRoleKey)) {
    return { status: "unauthorized" };
  }
  if (input.userError || !input.user?.id) return { status: "unauthorized" };
  if (!input.membership) return { status: "unavailable" };

  const result = interpretAdminMembership(input.membership, input.user.id);
  switch (result.status) {
    case "query_error":
      return { status: "unavailable" };
    case "not_admin":
      return { status: "forbidden" };
    case "admin":
      return result.userId === input.user.id
        ? { status: "admin", userId: result.userId }
        : { status: "forbidden" };
    default: {
      const unreachable: never = result;
      return unreachable;
    }
  }
};
