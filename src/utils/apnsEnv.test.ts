import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const reminder = readFileSync(
  path.join(repoRoot, "supabase/functions/send-lock-reminder/index.ts"),
  "utf8"
);
const picker = readFileSync(path.join(repoRoot, "components/CastPicker.tsx"), "utf8");

describe("send-lock-reminder live-send guard", () => {
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
});

describe("CastPicker collapsed trigger", () => {
  it("uses describeCastMember so hometown is visible before the list opens", () => {
    expect(picker).toMatch(/const summary = selected \? describeCastMember\(selected\)/);
    expect(picker).not.toMatch(/summariseCastMember/);
  });
});
