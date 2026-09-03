import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const pbxproj = readFileSync(path.join(repoRoot, "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
const infoPlist = readFileSync(path.join(repoRoot, "ios/App/App/Info.plist"), "utf8");
const entitlements = readFileSync(path.join(repoRoot, "ios/App/App/App.entitlements"), "utf8");
const privacy = readFileSync(path.join(repoRoot, "ios/App/App/PrivacyInfo.xcprivacy"), "utf8");
const capacitorConfig = readFileSync(path.join(repoRoot, "capacitor.config.ts"), "utf8");
const envProduction = readFileSync(path.join(repoRoot, ".env.production"), "utf8");
const verifyScript = readFileSync(path.join(repoRoot, "ios/App/Scripts/verify-web-assets.sh"), "utf8");

/** App Store Connect version 2.0; newest processed TestFlight build is 1.0 (34). */
const MARKETING_VERSION = "2.0";
const MIN_BUILD_NUMBER = 35;
const BUNDLE_ID = "com.roundtabledraft.app";

function appTargetSettings(name: "Debug" | "Release"): string {
  const match = pbxproj.match(
    new RegExp(
      `504EC31[78]1FED79650016851F /\\* ${name} \\*/ = \\{[\\s\\S]*?PRODUCT_BUNDLE_IDENTIFIER = [^;]+;[\\s\\S]*?name = ${name};`,
    ),
  );
  if (!match) {
    throw new Error(`Could not find the App target ${name} configuration`);
  }
  return match[0];
}

describe("iOS 2.0 release identity", () => {
  it.each(["Debug", "Release"] as const)(
    "sets MARKETING_VERSION 2.0 and CURRENT_PROJECT_VERSION >= 35 on App %s",
    (name) => {
      const settings = appTargetSettings(name);
      expect(settings).toMatch(new RegExp(`MARKETING_VERSION = ${MARKETING_VERSION};`));
      const build = settings.match(/CURRENT_PROJECT_VERSION = (\d+);/);
      expect(build, `${name} must set CURRENT_PROJECT_VERSION`).not.toBeNull();
      expect(Number(build![1])).toBeGreaterThanOrEqual(MIN_BUILD_NUMBER);
      expect(settings).toContain(`PRODUCT_BUNDLE_IDENTIFIER = ${BUNDLE_ID};`);
      expect(settings).toContain("IPHONEOS_DEPLOYMENT_TARGET = 15.0;");
      expect(settings).not.toContain("RECOMMENDED_IPHONEOS_DEPLOYMENT_TARGET");
    },
  );

  it("lets Info.plist inherit marketing and build numbers from the project", () => {
    expect(infoPlist).toContain("<key>CFBundleShortVersionString</key>");
    expect(infoPlist).toContain("<string>$(MARKETING_VERSION)</string>");
    expect(infoPlist).toContain("<key>CFBundleVersion</key>");
    expect(infoPlist).toContain("<string>$(CURRENT_PROJECT_VERSION)</string>");
    expect(infoPlist).toContain("<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>");
    expect(infoPlist).toContain("<string>Round Table Draft</string>");
  });

  it("declares export-compliance exemption and push background mode", () => {
    expect(infoPlist).toMatch(
      /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/,
    );
    expect(infoPlist).toContain("<string>remote-notification</string>");
  });
});

describe("iOS release shipping guards", () => {
  it("keeps verify-web-assets.sh as the App target's first build phase", () => {
    expect(verifyScript).toContain("INDEX_FILE=");
    expect(verifyScript).toContain("server.url");
    expect(pbxproj).toContain('shellScript = "\\"$SRCROOT/Scripts/verify-web-assets.sh\\"\\n";');
    expect(pbxproj).toMatch(
      /buildPhases = \(\s*C0FFEE0000000000000000B1 \/\* Verify bundled web assets \*\//,
    );
  });

  it("keeps the Capacitor app id and only adds server.url off the bundled path", () => {
    expect(capacitorConfig).toContain(`appId: "${BUNDLE_ID}"`);
    expect(capacitorConfig).toContain('appName: "Round Table Draft"');
    expect(capacitorConfig).toContain("isBundledBuild");
    expect(capacitorConfig).toMatch(/isBundledBuild[\s\S]*server:/);
  });

  it("ships push entitlements and the privacy manifest with the app target", () => {
    expect(entitlements).toContain("<key>aps-environment</key>");
    expect(privacy).toContain("<key>NSPrivacyTracking</key>");
    expect(privacy).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
    expect(pbxproj).toContain("PrivacyInfo.xcprivacy in Resources");
    expect(pbxproj).toContain("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;");
  });

  it("keeps the generated App Store icon and launch images on disk", () => {
    const icon = path.join(
      repoRoot,
      "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    );
    const splash = path.join(
      repoRoot,
      "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
    );
    expect(existsSync(icon), icon).toBe(true);
    expect(existsSync(splash), splash).toBe(true);
  });

  it("does not commit service-role or APNs secrets in the production env file", () => {
    const assignments = envProduction
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("#"));
    expect(assignments.some((line) => /SERVICE_ROLE/.test(line))).toBe(false);
    expect(assignments.some((line) => /^APNS_/.test(line))).toBe(false);
    expect(envProduction).toContain("NEXT_PUBLIC_SUPABASE_URL=");
    expect(envProduction).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY=");
  });
});
