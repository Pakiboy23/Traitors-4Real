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
  | { status: "query_error"; error: { message?: string; code?: string } };

export const interpretAdminMembership = (
  query: AdminMembershipQuery
): AdminMembershipResult => {
  if (query.error) {
    return { status: "query_error", error: query.error };
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
