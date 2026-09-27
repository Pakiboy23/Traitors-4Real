import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_ENTRY_PATH,
  CANONICAL_SITE_ORIGIN,
  INVALID_RESET_LINK_MESSAGE,
  PASSWORD_RESET_PATH,
  PASSWORD_RESET_RATE_LIMIT_MESSAGE,
  PASSWORD_RESET_SEND_ERROR,
  RESET_LINK_SENT_MESSAGE,
  adminEntryUrl,
  classifyRecoveryUrl,
  passwordResetRedirectUrl,
  passwordResetRequestNotice,
  passwordUpdateErrorMessage,
  resolveRecoveryPhase,
  validateNewPassword,
  type RecoveryPhaseInput,
} from "./passwordReset";

const repoRoot = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

const phase = (overrides: Partial<RecoveryPhaseInput> = {}): RecoveryPhaseInput => ({
  url: { kind: "absent", errorCode: null, errorDescription: null },
  recoveryEventSeen: false,
  hasSession: false,
  settled: true,
  ...overrides,
});

describe("password reset redirect", () => {
  it("uses the production origin when no origin is available", () => {
    expect(passwordResetRedirectUrl()).toBe(
      `${CANONICAL_SITE_ORIGIN}${PASSWORD_RESET_PATH}`
    );
    expect(passwordResetRedirectUrl("")).toBe(
      "https://traitorsfantasydraft.online/reset-password"
    );
    expect(passwordResetRedirectUrl(null)).toBe(
      "https://traitorsfantasydraft.online/reset-password"
    );
  });

  it("builds the redirect from the current origin so previews return to themselves", () => {
    expect(passwordResetRedirectUrl("https://traitors-abc123.vercel.app")).toBe(
      "https://traitors-abc123.vercel.app/reset-password"
    );
    expect(passwordResetRedirectUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/reset-password"
    );
  });

  it("drops a non-http origin instead of sending it to Supabase", () => {
    expect(passwordResetRedirectUrl("javascript:alert(1)")).toBe(
      "https://traitorsfantasydraft.online/reset-password"
    );
  });

  it("sends a finished reset into the admin tab", () => {
    expect(ADMIN_ENTRY_PATH).toBe("/?admin=1&tab=admin");
    expect(adminEntryUrl("https://traitorsfantasydraft.online")).toBe(
      `https://traitorsfantasydraft.online${ADMIN_ENTRY_PATH}`
    );
  });
});

describe("classifyRecoveryUrl", () => {
  it("recognizes an implicit recovery fragment", () => {
    expect(
      classifyRecoveryUrl(
        "https://traitorsfantasydraft.online/reset-password#access_token=tok&refresh_token=ref&type=recovery"
      )
    ).toEqual({ kind: "recovery", errorCode: null, errorDescription: null });
  });

  it("recognizes a PKCE code callback", () => {
    expect(
      classifyRecoveryUrl("https://traitorsfantasydraft.online/reset-password?code=abc")
    ).toEqual({ kind: "pkce", errorCode: null, errorDescription: null });
  });

  it("recognizes an expired link in the fragment or the query", () => {
    expect(
      classifyRecoveryUrl(
        "https://traitorsfantasydraft.online/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
      )
    ).toMatchObject({ kind: "error", errorCode: "otp_expired" });
    expect(
      classifyRecoveryUrl(
        "https://traitorsfantasydraft.online/reset-password?error_code=otp_expired&error_description=expired"
      ).kind
    ).toBe("error");
  });

  it("treats a bare visit as absent", () => {
    expect(classifyRecoveryUrl("https://traitorsfantasydraft.online/reset-password").kind).toBe(
      "absent"
    );
    expect(classifyRecoveryUrl("").kind).toBe("absent");
  });
});

describe("resolveRecoveryPhase", () => {
  it("waits while a recovery URL has not settled", () => {
    expect(
      resolveRecoveryPhase(
        phase({
          settled: false,
          url: { kind: "recovery", errorCode: null, errorDescription: null },
        })
      )
    ).toBe("checking");
  });

  it("shows the new-password form once the implicit session is stored", () => {
    expect(
      resolveRecoveryPhase(
        phase({
          hasSession: true,
          url: { kind: "recovery", errorCode: null, errorDescription: null },
        })
      )
    ).toBe("ready");
  });

  it("shows the form again on refresh after the fragment was cleared", () => {
    expect(
      resolveRecoveryPhase(phase({ hasSession: true, recoveryEventSeen: true }))
    ).toBe("ready");
  });

  it("does not treat an ordinary signed-in session as a recovery", () => {
    expect(resolveRecoveryPhase(phase({ hasSession: true }))).toBe("request");
  });

  it("asks for a new email on an expired or failed link", () => {
    expect(
      resolveRecoveryPhase(
        phase({
          url: { kind: "error", errorCode: "otp_expired", errorDescription: "expired" },
          hasSession: true,
        })
      )
    ).toBe("invalid");
    expect(
      resolveRecoveryPhase(
        phase({
          url: { kind: "recovery", errorCode: null, errorDescription: null },
        })
      )
    ).toBe("invalid");
  });

  it("offers a request form on a direct visit", () => {
    expect(resolveRecoveryPhase(phase({ settled: false }))).toBe("request");
    expect(resolveRecoveryPhase(phase())).toBe("request");
  });
});

describe("password reset notices", () => {
  it("uses one neutral sentence for success and for a missing account", () => {
    expect(passwordResetRequestNotice(null)).toEqual({
      tone: "neutral",
      message: RESET_LINK_SENT_MESSAGE,
    });
    expect(passwordResetRequestNotice({ code: "user_not_found", message: "User not found" })).toEqual({
      tone: "neutral",
      message: RESET_LINK_SENT_MESSAGE,
    });
    expect(RESET_LINK_SENT_MESSAGE).toBe(
      "If that email has an account, a reset link is on its way"
    );
  });

  it("does not echo a lookup failure, and keeps rate limits generic", () => {
    expect(passwordResetRequestNotice({ message: "Email not found" }).message).toBe(
      RESET_LINK_SENT_MESSAGE
    );
    expect(
      passwordResetRequestNotice({ code: "over_email_send_rate_limit", message: "rate limit" })
        .message
    ).toBe(PASSWORD_RESET_RATE_LIMIT_MESSAGE);
    expect(passwordResetRequestNotice({ message: "Failed to fetch" }).message).toBe(
      PASSWORD_RESET_SEND_ERROR
    );
    expect(PASSWORD_RESET_SEND_ERROR.toLowerCase()).not.toContain("not found");
  });
});

describe("validateNewPassword", () => {
  it("requires a matching password of at least 6 characters", () => {
    expect(validateNewPassword("short", "short")).toMatch(/6 characters/);
    expect(validateNewPassword("long-enough", "different")).toBe("Passwords do not match.");
    expect(validateNewPassword("long-enough", "long-enough")).toBeNull();
  });
});

describe("passwordUpdateErrorMessage", () => {
  it("turns a missing recovery session into the expired-link message", () => {
    expect(passwordUpdateErrorMessage({ message: "Auth session missing!" })).toBe(
      INVALID_RESET_LINK_MESSAGE
    );
    expect(passwordUpdateErrorMessage(new Error("Password should be at least 8 characters."))).toBe(
      "Password should be at least 8 characters."
    );
  });
});

describe("password reset wiring", () => {
  it("snapshots the landing URL before the Supabase client is constructed", () => {
    const recovery = read("src/lib/passwordRecovery.ts");
    const captureAt = recovery.indexOf("./capturedRecoveryHref");
    const clientAt = recovery.indexOf("./supabase");
    expect(captureAt).toBeGreaterThan(-1);
    expect(clientAt).toBeGreaterThan(captureAt);
    expect(read("src/lib/capturedRecoveryHref.ts")).not.toMatch(/supabase/);
    expect(recovery).toMatch(/PASSWORD_RECOVERY/);
    expect(recovery).toMatch(/onAuthStateChange/);

    const page = read("src/app/reset-password/ResetPassword.tsx");
    const listenerAt = page.indexOf("../../lib/passwordRecovery");
    const requestAt = page.indexOf("PasswordResetRequest");
    expect(listenerAt).toBeGreaterThan(-1);
    expect(listenerAt).toBeLessThan(requestAt);
  });

  it("leaves the Supabase client on the implicit flow", () => {
    const client = read("src/lib/supabase.ts");
    expect(client).toMatch(/createClient<Database>\(supabaseUrl, supabaseAnonKey\)/);
    expect(client).not.toMatch(/flowType/);
  });

  it("sends resetPasswordForEmail at the reset route and updates the password there", () => {
    const services = read("services/supabase.ts");
    const signIn = services.slice(
      services.indexOf("export const signInAdmin"),
      services.indexOf("export const signOutAdmin")
    );
    expect(signIn).toMatch(/signInWithPassword/);
    expect(signIn).not.toMatch(/resetPasswordForEmail|updateUser/);

    const reset = services.slice(services.indexOf("export const requestAdminPasswordReset"));
    expect(reset).toMatch(/resetPasswordForEmail\(normalizeEmail\(email\), \{\s*redirectTo,\s*\}\)/);
    expect(reset).toMatch(/updateUser\(\{ password \}\)/);
    expect(reset).toMatch(/passwordResetRedirectUrl/);
  });

  it("adds Forgot password on the admin login without removing sign-in", () => {
    const auth = read("components/AdminAuth.tsx");
    expect(auth).toMatch(/Forgot password\?/);
    expect(auth).toMatch(/onAuthenticate\(email, password\)/);
    expect(auth).toMatch(/Sign In/);
  });

  it("is a file route, so a refresh is not an SPA rewrite", () => {
    expect(read("src/app/reset-password/page.tsx")).toMatch(/ResetPasswordClient/);
    const nextConfig = read("next.config.ts");
    expect(nextConfig).not.toMatch(/rewrites|redirects/);
    expect(nextConfig).not.toMatch(/reset-password/);
  });
});
