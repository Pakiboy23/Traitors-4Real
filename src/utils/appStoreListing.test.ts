import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const metadataDir = path.join(repoRoot, "store/metadata/en-US");
const captureScript = readFileSync(
  path.join(repoRoot, "scripts/screenshots/capture.mjs"),
  "utf8",
);
const layout = readFileSync(path.join(repoRoot, "components/Layout.tsx"), "utf8");

const readMeta = (name: string) =>
  readFileSync(path.join(metadataDir, name), "utf8").trim();

const SHOTS = [
  "01-home",
  "02-draft",
  "03-cast-picker",
  "04-weekly",
  "05-leaderboard",
  "06-rules",
] as const;

const SIZES = [
  { name: "iphone-6.9", width: 1320, height: 2868 },
  { name: "iphone-6.5", width: 1242, height: 2688 },
] as const;

describe("App Store listing copy", () => {
  it("keeps the public name on Round Table Draft and inside Apple's limits", () => {
    const name = readMeta("name.txt");
    const subtitle = readMeta("subtitle.txt");
    const keywords = readMeta("keywords.txt");
    const promo = readMeta("promotional_text.txt");
    const description = readMeta("description.txt");
    const releaseNotes = readMeta("release_notes.txt");

    expect(name).toBe("Round Table Draft");
    expect(name.length).toBeLessThanOrEqual(30);
    expect(subtitle.length).toBeGreaterThan(0);
    expect(subtitle.length).toBeLessThanOrEqual(30);
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.length).toBeLessThanOrEqual(100);
    expect(promo.length).toBeGreaterThan(0);
    expect(promo.length).toBeLessThanOrEqual(170);
    expect(description.length).toBeGreaterThan(200);
    expect(description.length).toBeLessThanOrEqual(4000);
    expect(releaseNotes.length).toBeGreaterThan(40);
    expect(releaseNotes.length).toBeLessThanOrEqual(4000);

    const publicCopy = [name, subtitle, keywords, promo].join("\n");
    expect(publicCopy).not.toMatch(/Traitors/i);
    expect(description).toMatch(/not affiliated/i);
    expect(releaseNotes).toMatch(/not affiliated/i);
  });

  it("points App Review at the in-app privacy and support routes", () => {
    expect(readMeta("support_url.txt")).toBe(
      "https://traitorsfantasydraft.online/support",
    );
    expect(readMeta("privacy_url.txt")).toBe(
      "https://traitorsfantasydraft.online/privacy",
    );
    expect(readMeta("marketing_url.txt")).toBe(
      "https://traitorsfantasydraft.online",
    );
    expect(readMeta("primary_category.txt")).toBe("ENTERTAINMENT");
    expect(readMeta("secondary_category.txt")).toBe("SPORTS");
  });

  it("keeps review notes aligned with the privacy manifest", () => {
    const notes = readFileSync(path.join(repoRoot, "store/review_notes.txt"), "utf8");
    expect(notes).toMatch(/not affiliated/i);
    expect(notes).toMatch(/2\.0/);
    expect(notes).toMatch(/build 35/i);
    expect(notes).toMatch(/com\.roundtabledraft\.app/);
    expect(notes.length).toBeLessThanOrEqual(4000);
  });

  it("discloses gameplay content next to the privacy manifest and policy", () => {
    const answers = readFileSync(
      path.join(repoRoot, "store/privacy_answers.md"),
      "utf8",
    );
    const privacy = readFileSync(
      path.join(repoRoot, "ios/App/App/PrivacyInfo.xcprivacy"),
      "utf8",
    );
    const policy = readFileSync(
      path.join(repoRoot, "src/app/privacy/page.tsx"),
      "utf8",
    );

    expect(answers).toMatch(/Gameplay Content/);
    expect(answers).toMatch(/picks and weekly predictions/i);
    expect(answers).toMatch(/linked to the user/i);
    expect(answers).toMatch(/not used for tracking/i);
    expect(answers).toMatch(/App Functionality/);

    expect(privacy).toContain("NSPrivacyCollectedDataTypeGameplayContent");
    expect(privacy).toMatch(
      /NSPrivacyCollectedDataTypeGameplayContent[\s\S]*?NSPrivacyCollectedDataTypeLinked<\/key>\s*<true\/>/,
    );
    expect(privacy).toMatch(
      /NSPrivacyCollectedDataTypeGameplayContent[\s\S]*?NSPrivacyCollectedDataTypeTracking<\/key>\s*<false\/>/,
    );
    expect(privacy).toMatch(
      /NSPrivacyCollectedDataTypeGameplayContent[\s\S]*?NSPrivacyCollectedDataTypePurposeAppFunctionality/,
    );

    expect(policy).toMatch(/Your picks and predictions/);
  });
});

describe("App Store screenshot capture", () => {
  it("targets the current nav, not the pre-#137 tab bar", () => {
    expect(layout).toContain('label: "Home"');
    expect(layout).toContain('onTabChange("rules")');
    expect(captureScript).toContain('tab: "Draft"');
    expect(captureScript).toContain('tab: "Weekly Council"');
    expect(captureScript).toContain('tab: "Leaderboard"');
    expect(captureScript).toContain('name: "01-home"');
    expect(captureScript).toContain('name: "06-rules"');
    expect(captureScript).toContain('name: /^Rules$/');
    expect(captureScript).not.toContain('tab: "Overview"');
    expect(captureScript).not.toContain('tab: "Rules"');
    expect(captureScript).toContain("supabase");
    expect(captureScript).toContain("iphone-6.9");
    expect(captureScript).toContain("iphone-6.5");
  });

  it("commits both iPhone sizes App Store Connect will accept", async () => {
    for (const size of SIZES) {
      const dir = path.join(repoRoot, "store/screenshots", size.name);
      expect(existsSync(dir), `${dir} is missing — run npm run screenshots:capture`).toBe(
        true,
      );
      const files = readdirSync(dir).filter((name) => name.endsWith(".png")).sort();
      expect(files).toEqual(SHOTS.map((name) => `${name}.png`));
      for (const shot of SHOTS) {
        const file = path.join(dir, `${shot}.png`);
        const meta = await sharp(file).metadata();
        expect(meta.width, file).toBe(size.width);
        expect(meta.height, file).toBe(size.height);
      }
    }
  });
});
