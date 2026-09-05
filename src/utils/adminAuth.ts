/**
 * Admin UI access is membership, not a Supabase session.
 *
 * signInWithPassword emits SIGNED_IN before we know whether the account is in
 * admin_users. Treating that event as authenticated remounts AdminPanel, then
 * a failed membership check signs out and remounts an empty AdminAuth — the
 * error dies with the unmounted form. These helpers keep that distinction
 * explicit so a query failure cannot be mistaken for "not an admin".
 */

export const ADMIN_NOT_ADMIN_ERROR = "Not an admin user";

export type AdminMembershipRow = { user_id: string };

export type AdminMembershipQuery = {
  data: AdminMembershipRow | null;
  error: { message?: string; code?: string } | null;
};

export type AdminMembershipResult =
  | { status: "admin"; userId: string }
  | { status: "not_admin" }
  | {
      status: "query_error";
      error: { message?: string; code?: string };
      userId?: string;
    };

export const interpretAdminMembership = (
  query: AdminMembershipQuery,
  attemptedUserId?: string
): AdminMembershipResult => {
  if (query.error) {
    return {
      status: "query_error",
      error: query.error,
      ...(attemptedUserId ? { userId: attemptedUserId } : {}),
    };
  }
  if (!query.data?.user_id) {
    return { status: "not_admin" };
  }
  return { status: "admin", userId: query.data.user_id };
};

/** Only a confirmed admin_users row elevates the admin UI. */
export const isConfirmedAdminMembership = (query: AdminMembershipQuery): boolean =>
  interpretAdminMembership(query).status === "admin";

export const adminAuthErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Authentication failed";
};

export type AdminUiAuthState = {
  isAuthenticated: boolean;
  authError: string | null;
  confirmedUserId: string | null;
};

/**
 * Apply an auth-listener result to the admin UI flags.
 * A query failure keeps the admin flag only when it belongs to the same
 * confirmed user; a different session must not inherit a stale AdminPanel.
 */
export const applyAdminSessionResult = (
  result: AdminMembershipResult,
  current: AdminUiAuthState
): AdminUiAuthState => {
  if (result.status === "query_error") {
    const sameUser =
      Boolean(current.confirmedUserId) && result.userId === current.confirmedUserId;
    return {
      isAuthenticated: sameUser ? current.isAuthenticated : false,
      authError: adminAuthErrorMessage(result.error),
      confirmedUserId: sameUser ? current.confirmedUserId : null,
    };
  }
  if (result.status === "admin") {
    return { isAuthenticated: true, authError: null, confirmedUserId: result.userId };
  }
  return {
    isAuthenticated: false,
    authError: current.authError,
    confirmedUserId: null,
  };
};

/**
 * Sequence for overlapping session lookups. Call start() before any await;
 * ignore a result whose token is no longer current when it settles.
 */
export const createAdminLookupGeneration = () => {
  let latest = 0;
  return {
    start: () => ++latest,
    isCurrent: (token: number) => token === latest,
  };
};

/**
 * After a password sign-in: throw query errors without signing out; a missing
 * row signs out and throws a stable "not an admin" error.
 */
export const settleAdminSignInMembership = async (
  query: AdminMembershipQuery,
  signOut: () => Promise<unknown>
): Promise<void> => {
  const result = interpretAdminMembership(query);
  if (result.status === "query_error") {
    throw query.error;
  }
  if (result.status === "not_admin") {
    await signOut();
    throw new Error(ADMIN_NOT_ADMIN_ERROR);
  }
};
