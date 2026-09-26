import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const reminder = readFileSync(
  path.join(repoRoot, "supabase/functions/send-lock-reminder/index.ts"),
  "utf8"
);
const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
const picker = readFileSync(path.join(repoRoot, "components/CastPicker.tsx"), "utf8");

const handler = reminder.slice(reminder.indexOf("Deno.serve"));

describe("send-lock-reminder live-send guard", () => {
  it("requires a verified admin before it reads, sends, or deletes tokens", () => {
    const at = (needle: string) => handler.indexOf(needle);
    const token = at("accessTokenFromAuthorization");
    const projectKey = at("isProjectApiKey");
    const rejectAnon = at("json(401,");
    const getUser = at("auth.getUser(");
    const membership = at('.from("admin_users")');
    const decision = at("decideLockReminderCaller");
    const forbidden = at("json(403,");
    const tokenRead = at('.from("push_tokens").select');
    const dryRun = at("if (payload.dryRun)");
    const productionGuard = at('APNS_ENV !== "production"');
    const sendLoop = at("for (const row of audience)");
    const prune = at('.from("push_tokens").delete()');

    for (const index of [
      token,
      projectKey,
      rejectAnon,
      getUser,
      membership,
      decision,
      forbidden,
      tokenRead,
      dryRun,
      productionGuard,
      sendLoop,
      prune,
    ]) {
      expect(index).toBeGreaterThan(-1);
    }

    expect(token).toBeLessThan(projectKey);
    expect(projectKey).toBeLessThan(rejectAnon);
    expect(rejectAnon).toBeLessThan(getUser);
    expect(getUser).toBeLessThan(membership);
    expect(membership).toBeLessThan(decision);
    expect(decision).toBeLessThan(forbidden);
    expect(forbidden).toBeLessThan(tokenRead);
    expect(tokenRead).toBeLessThan(dryRun);
    expect(dryRun).toBeLessThan(productionGuard);
    expect(productionGuard).toBeLessThan(sendLoop);
    expect(sendLoop).toBeLessThan(prune);

    expect(handler).toMatch(/\.maybeSingle\(\)/);
    expect(handler).toMatch(/interpretAdminMembership|decideLockReminderCaller/);
    expect(handler).toContain('error: "Could not read the device list."');
    expect(handler).toContain("LOCK_REMINDER_UNAVAILABLE");
    expect(handler).not.toMatch(/json\(\s*500,\s*\{[^}]*error\.message/);
    expect(handler).not.toMatch(/json\(\s*401,\s*\{[^}]*error\.message/);
  });

  it("documents an admin access token, not the anon key, as the caller", () => {
    expect(readme).toMatch(/Authorization:\s*Bearer\s+\$ADMIN_ACCESS_TOKEN/);
    expect(readme).not.toMatch(/Authorization:\s*Bearer\s+\$ANON_KEY/);
  });

  it("refuses a live send unless APNS_ENV is production", () => {
    // dryRun is the verification path and must keep working with the secret unset.
    expect(reminder).toMatch(/if \(payload\.dryRun\)/);
    // The production check sits after dryRun so a sandbox/unset env still
    // answers the audience query, and before the APNs loop so it cannot
    // prune tokens on a BadDeviceToken mismatch.
    const dryRun = reminder.indexOf("if (payload.dryRun)");
    const productionGuard = reminder.indexOf('APNS_ENV !== "production"');
    const sendLoop = reminder.indexOf("for (const row of audience)");
    expect(productionGuard).toBeGreaterThan(dryRun);
    expect(sendLoop).toBeGreaterThan(productionGuard);
  });

  it("sends to every registered phone only when audience is all", () => {
    expect(reminder).toMatch(/payload\.audience !== "all"/);
  });

  it("answers the browser preflight so the admin tab can call it", () => {
    expect(reminder).toMatch(/req\.method === "OPTIONS"/);
    expect(reminder).toMatch(/Access-Control-Allow-Origin/);
  });
});

describe("CastPicker collapsed trigger", () => {
  it("uses describeCastMember so hometown is visible before the list opens", () => {
    expect(picker).toMatch(/const summary = selected \? describeCastMember\(selected\)/);
    expect(picker).not.toMatch(/summariseCastMember/);
  });
});
