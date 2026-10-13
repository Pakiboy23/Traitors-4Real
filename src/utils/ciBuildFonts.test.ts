import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");

/**
 * Turbopack's next/font/google path does not retry a failed fonts.gstatic.com
 * fetch. CI has failed more than once with:
 *   Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
 * Webpack's font loader retries. Keep production and native builds on that path.
 */
describe("CI builds use webpack for Google Fonts", () => {
  it("passes --webpack to next build in package.json and the native export", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    expect(packageJson.scripts.build).toMatch(/next build --webpack\b/);

    const nativeBuild = readFileSync(
      path.join(repoRoot, "scripts/build-native-web.mjs"),
      "utf8"
    );
    expect(nativeBuild).toMatch(/next",\s*"build",\s*"--webpack"/);
    expect(nativeBuild).toMatch(/fonts\.gstatic\.com/);
  });
});
