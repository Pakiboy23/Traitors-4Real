/**
 * Admin password recovery.
 *
 * The Supabase client in src/lib/supabase.ts is created with defaults:
 * implicit flow and detectSessionInUrl. resetPasswordForEmail therefore
 * returns the user to redirectTo with the session in the URL fragment
 * (`#access_token=…&type=recovery`), and the client emits PASSWORD_RECOVERY.
 * A `?code=` landing is classified too, in case a PKCE callback is ever
 * presented, but this app does not opt into PKCE.
 *
 * redirectTo is the current origin plus /reset-password so a preview
 * deployment returns to itself. Supabase ignores redirectTo unless that
 * exact URL is on the Auth redirect allow-list, and falls back to the
 * Site URL. The production URL that must be allow-listed is
 * https://traitorsfantasydraft.online/reset-password
 * The Site URL should stay the production origin. It is the fallback when
 * redirectTo is missing or rejected; it is not the reset page itself.
 */

export const CANONICAL_SITE_ORIGIN = "https://traitorsfantasydraft.online";

export const PASSWORD_RESET_PATH = "/reset-password";

/** Same admin entry the web app already documents. */
export const ADMIN_ENTRY_PATH = "/?admin=1";

export const PASSWORD_RECOVERY_STORAGE_KEY = "traitors_password_recovery";

export const RESET_LINK_SENT_MESSAGE =
  "If that email has an account, a reset link is on its way";

export const INVALID_RESET_LINK_MESSAGE =
  "This reset link is invalid or has expired. Request a new email below.";

export const PASSWORD_RESET_SEND_ERROR =
  "Could not send a reset email. Try again in a moment.";

export const PASSWORD_RESET_RATE_LIMIT_MESSAGE =
  "A reset email was requested recently. Wait a moment, then try again.";

/** Supabase's default minimum. A stricter project policy still fails in updateUser. */
export const MIN_PASSWORD_LENGTH = 6;

export type RecoveryUrlKind = "recovery" | "pkce" | "error" | "absent";

export interface RecoveryUrlClassification {
  kind: RecoveryUrlKind;
  errorCode: string | null;
  errorDescription: string | null;
}

export type RecoveryPhase = "checking" | "ready" | "invalid" | "request";

export interface RecoveryPhaseInput {
  url: RecoveryUrlClassification;
  recoveryEventSeen: boolean;
  hasSession: boolean;
  /** False until initialize() and getSession() have settled. */
  settled: boolean;
}

export interface PasswordResetNotice {
  tone: "neutral" | "error";
  message: string;
}

const readParams = (href: string): Record<string, string> => {
  const url = new URL(href);
  const result: Record<string, string> = {};
  if (url.hash.startsWith("#")) {
    new URLSearchParams(url.hash.slice(1)).forEach((value, key) => {
      result[key] = value;
    });
  }
  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

/**
 * Classify a recovery landing URL.
 *
 * Query params win over the fragment, matching the Supabase client's parser.
 * Implicit recovery is `#access_token` plus `type=recovery`. Expired links
 * arrive as `error` / `error_code` / `error_description` in either place.
 */
export const classifyRecoveryUrl = (href: string): RecoveryUrlClassification => {
  const absent: RecoveryUrlClassification = {
    kind: "absent",
    errorCode: null,
    errorDescription: null,
  };
  if (!href.trim()) return absent;

  let params: Record<string, string>;
  try {
    params = readParams(href);
  } catch {
    return absent;
  }

  const errorDescription = params.error_description ?? null;
  const errorCode = params.error_code ?? params.error ?? null;
  if (params.error || params.error_description || params.error_code) {
    return { kind: "error", errorCode, errorDescription };
  }
  if (params.type === "recovery" && params.access_token) {
    return { kind: "recovery", errorCode: null, errorDescription: null };
  }
  if (params.type === "recovery") {
    return { kind: "error", errorCode: "invalid_request", errorDescription: null };
  }
  if (params.code) {
    return { kind: "pkce", errorCode: null, errorDescription: null };
  }
  return absent;
};

export const resolveSiteOrigin = (origin?: string | null): string => {
  const candidate = origin?.trim() ?? "";
  if (!candidate) return CANONICAL_SITE_ORIGIN;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return CANONICAL_SITE_ORIGIN;
    return url.origin;
  } catch {
    return CANONICAL_SITE_ORIGIN;
  }
};

export const passwordResetRedirectUrl = (origin?: string | null): string =>
  `${resolveSiteOrigin(origin)}${PASSWORD_RESET_PATH}`;

export const adminEntryUrl = (origin?: string | null): string =>
  `${resolveSiteOrigin(origin)}${ADMIN_ENTRY_PATH}`;

export const resolveRecoveryPhase = (input: RecoveryPhaseInput): RecoveryPhase => {
  if (input.url.kind === "error") return "invalid";

  if (!input.settled) {
    if (
      input.url.kind === "recovery" ||
      input.url.kind === "pkce" ||
      input.recoveryEventSeen
    ) {
      return "checking";
    }
    return "request";
  }

  if (
    input.hasSession &&
    (input.recoveryEventSeen || input.url.kind === "recovery")
  ) {
    return "ready";
  }

  // A recovery or PKCE landing that settled without a session did not
  // produce PASSWORD_RECOVERY. Same for a refresh whose session is gone.
  if (input.url.kind === "recovery" || input.url.kind === "pkce") return "invalid";
  if (input.recoveryEventSeen && !input.hasSession) return "invalid";

  return "request";
};

export const validateNewPassword = (password: string, confirmation: string): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirmation) return "Passwords do not match.";
  return null;
};

const isAccountLookupError = (error: { code?: string; message?: string }): boolean => {
  const code = (error.code ?? "").toLowerCase();
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "user_not_found" ||
    message.includes("user not found") ||
    message.includes("email not found")
  );
};

const isRateLimitError = (error: { code?: string; message?: string }): boolean => {
  const code = (error.code ?? "").toLowerCase();
  const message = (error.message ?? "").toLowerCase();
  return code === "over_email_send_rate_limit" || /rate limit|only request this/.test(message);
};

/**
 * Success and "no such user" share one sentence so the form cannot be used
 * to learn whether an account exists. Other failures stay generic too.
 */
export const passwordResetRequestNotice = (
  error: { code?: string; message?: string } | null
): PasswordResetNotice => {
  if (!error || isAccountLookupError(error)) {
    return { tone: "neutral", message: RESET_LINK_SENT_MESSAGE };
  }
  if (isRateLimitError(error)) {
    return { tone: "error", message: PASSWORD_RESET_RATE_LIMIT_MESSAGE };
  }
  return { tone: "error", message: PASSWORD_RESET_SEND_ERROR };
};

export const passwordUpdateErrorMessage = (error: unknown): string => {
  let message = "";
  if (error instanceof Error && error.message) message = error.message;
  else if (error && typeof error === "object" && "message" in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === "string") message = value;
  }
  if (/session missing/i.test(message)) return INVALID_RESET_LINK_MESSAGE;
  const trimmed = message.trim();
  return trimmed || "Could not update the password. Try again.";
};
