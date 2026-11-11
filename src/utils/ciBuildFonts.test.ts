import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");

const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

describe("bundled fonts do not fetch Google Fonts", () => {
  it("keeps the webpack production build and drops the Google loader", () => {
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(packageJson.scripts.build).toMatch(/next build --webpack\b/);

    const nativeBuild = read("scripts/build-native-web.mjs");
    expect(nativeBuild).toMatch(/next",\s*"build",\s*"--webpack"/);

    const layout = read("src/app/layout.tsx");
    const faces = read("src/fonts/faces.css");
    expect(layout).not.toContain("next/font/google");
    expect(layout).not.toContain("fonts.googleapis.com");
    expect(layout).not.toContain("fonts.gstatic.com");
    expect(faces).not.toMatch(/url\(\s*['"]?https?:\/\/fonts\.(googleapis|gstatic)\.com/);
    expect(nativeBuild).not.toContain("fonts.gstatic.com");
  });

  it("matches the vendored files, subsets, weights, and fallback metrics", () => {
    const manifest = JSON.parse(read("src/fonts/manifest.json")) as Array<{
      family: string;
      filename: string;
      sha256: string;
      bytes: number;
      subset: string;
      weights: string[];
    }>;
    const faces = read("src/fonts/faces.css");
    const subsets = new Set<string>();

    expect(manifest).toHaveLength(30);
    for (const file of manifest) {
      const bytes = readFileSync(path.join(repoRoot, "public/fonts", file.filename));
      expect(bytes.length).toBe(file.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
      expect(faces).toContain(`/fonts/${file.filename}`);
      subsets.add(`${file.family}:${file.subset}`);
      for (const weight of file.weights) {
        expect(faces).toContain(`font-weight: ${weight};`);
      }
    }

    expect([...subsets].sort()).toEqual(
      [
        "Fraunces:latin",
        "Fraunces:latin-ext",
        "Fraunces:vietnamese",
        "IBM Plex Mono:cyrillic",
        "IBM Plex Mono:cyrillic-ext",
        "IBM Plex Mono:latin",
        "IBM Plex Mono:latin-ext",
        "IBM Plex Mono:vietnamese",
        "IBM Plex Sans:cyrillic",
        "IBM Plex Sans:cyrillic-ext",
        "IBM Plex Sans:greek",
        "IBM Plex Sans:latin",
        "IBM Plex Sans:latin-ext",
        "IBM Plex Sans:vietnamese",
        "Manrope:cyrillic",
        "Manrope:cyrillic-ext",
        "Manrope:greek",
        "Manrope:latin",
        "Manrope:latin-ext",
        "Manrope:vietnamese",
      ].sort()
    );

    expect(faces).toContain("--font-fraunces: 'Fraunces', 'Fraunces Fallback'");
    expect(faces).toContain("--font-plex-sans: 'IBM Plex Sans', 'IBM Plex Sans Fallback'");
    expect(faces).toContain("--font-plex-mono: 'IBM Plex Mono', 'IBM Plex Mono Fallback'");
    expect(faces).toContain("--font-manrope: 'Manrope', 'Manrope Fallback'");
    expect(faces).toContain("src: local(\"Times New Roman\")");
    expect(faces).toContain("size-adjust: 115.45%");
    expect(faces).toContain("size-adjust: 101.17%");
    expect(faces).toContain("size-adjust: 134.59%");
    expect(faces).toContain("size-adjust: 103.19%");
    expect(faces).toContain("font-stretch: 100%");
    expect(faces).toContain("--font-fraunces:");
    expect(faces).toContain("--font-plex-sans:");
    expect(faces).toContain("--font-plex-mono:");
    expect(faces).toContain("--font-manrope:");

    for (const license of ["OFL-fraunces.txt", "OFL-ibm-plex.txt", "OFL-manrope.txt"]) {
      expect(read(`src/fonts/${license}`)).toContain("SIL OPEN FONT LICENSE Version 1.1");
    }
  });
});
