/**
 * Renders every icon the app ships from one piece of source art.
 *
 * Both platforms were still carrying the Capacitor placeholder — a blue logo on
 * white — which is an App Review rejection on its own and, on the launch
 * screen, a white flash before a dark app. Generating them here means the icon,
 * the splash and the favicon can never drift apart from each other.
 *
 *   npm run icons:build
 *
 * Source: design/app-icon.svg. Edit that, re-run this, commit the output.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(repoRoot, "design/app-icon.svg");

/** Matches --bg-base in src/index.css. */
const BACKGROUND = "#0d1118";

/** The one line that paints the icon's own background field. */
const FIELD_RECT = '  <rect width="1024" height="1024" fill="url(#field)"/>\n';

const icon = await readFile(SOURCE, "utf8");

// The splash needs the shield on a flat field of its own size, so it is drawn
// from the same art with the background rect taken out. Asserted rather than
// best-effort: silently rendering a mark with a 1024px box baked into the
// middle of a 2732px splash is exactly the kind of thing nobody notices until
// it is on a phone.
if (!icon.includes(FIELD_RECT)) {
  throw new Error(
    `design/app-icon.svg no longer contains the background rect this script strips:\n  ${FIELD_RECT.trim()}`
  );
}
const mark = icon.replace(FIELD_RECT, "");

const render = (svg, size) =>
  sharp(Buffer.from(svg), { density: 384 }).resize(size, size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

const write = async (target, buffer) => {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
  console.log(`  ${path.relative(repoRoot, target)}`);
};

console.log("App icon");
// App Store icons must have no alpha channel at all, so this one is flattened
// and stripped rather than merely drawn opaque.
await write(
  path.join(repoRoot, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"),
  await render(icon, 1024).flatten({ background: BACKGROUND }).removeAlpha().png().toBuffer()
);

console.log("Launch screen");
// Capacitor scales this square to aspect-fill, so on a tall phone only the
// middle band is ever seen. The mark stays well inside it.
const SPLASH = 2732;
const splashMark = await render(mark, 1120).png().toBuffer();
const splash = await sharp({
  create: {
    width: SPLASH,
    height: SPLASH,
    channels: 4,
    background: BACKGROUND,
  },
})
  .composite([{ input: splashMark, gravity: "centre" }])
  .removeAlpha()
  .png()
  .toBuffer();

for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await write(path.join(repoRoot, "ios/App/App/Assets.xcassets/Splash.imageset", name), splash);
}

console.log("Web");
for (const [name, size] of [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
]) {
  await write(
    path.join(repoRoot, "public", name),
    await render(icon, size).flatten({ background: BACKGROUND }).png().toBuffer()
  );
}

await write(path.join(repoRoot, "public/icon.svg"), Buffer.from(icon));
