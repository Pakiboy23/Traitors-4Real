/**
 * Captures App Store screenshots at both iPhone sizes App Store Connect asks
 * for: 6.9" (1320 x 2868) and 6.5" (1242 x 2688). One run emits both, into
 * screenshots/iphone-6.9/ and screenshots/iphone-6.5/.
 *
 * Both are needed. The 6.5" slot rejects a 1320 x 2868 asset outright, so a
 * 6.9"-only run leaves that slot empty and the version cannot be submitted.
 *
 * Run a production build first, serve it, then point this at it:
 *
 *   npm i -D playwright && npx playwright install chromium
 *   npx next build && npx next start -p 3222
 *   node scripts/screenshots/capture.mjs http://127.0.0.1:3222
 *
 * The build needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * They are inlined at build time, so an unset pair reaches createClient() as ""
 * and the app dies on load with "Application error: a client-side exception".
 * Nothing here notices — you get six screenshots of the error page. Either keep
 * them in .env.local, or use the placeholders CI builds with:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key \
 *   npx next build
 *
 * Placeholders are fine: the season is injected into localStorage and no
 * request needs to succeed.
 *
 * Playwright is not a dependency of the app — install it only when capturing.
 * Output lands in ./screenshots (override with SHOT_DIR).
 *
 * The sample season is injected into localStorage before the app boots, so
 * nothing is written to Supabase and the live season is untouched. See
 * demo-season.mjs for why that matters.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { buildDemoState } from "./demo-season.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3222";
const OUT = process.env.SHOT_DIR ?? "screenshots";
const CHROME_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROME,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));

/**
 * Each entry is a logical viewport at 3x, which is how the pixel sizes Apple
 * lists are reached: 440 x 956 -> 1320 x 2868, and 414 x 896 -> 1242 x 2688.
 * Layout differs between the two, so nothing here may assume a fixed offset —
 * scrollTo measures the live page for exactly this reason.
 */
const SIZES = [
  { name: "iphone-6.9", viewport: { width: 440, height: 956 }, scale: 3 },
  { name: "iphone-6.5", viewport: { width: 414, height: 896 }, scale: 3 },
];

/**
 * `prepare` runs after the tab is open and before the shot. Screens that start
 * as an empty form are driven first — an App Store screenshot of "Choose
 * player..." repeated ten times sells nothing.
 */
const SHOTS = [
  { name: "01-overview", tab: null },
  {
    name: "02-draft",
    tab: "Draft",
    prepare: async (page) => {
      const autoFill = page.getByRole("button", { name: /auto fill/i }).first();
      if (await autoFill.count()) {
        await autoFill.click();
        await page.waitForTimeout(800);
      }
      await scrollTo(page, "Draft Board", { keepNav: true });
    },
  },
  {
    name: "03-cast-picker",
    tab: "Draft",
    prepare: async (page) => {
      // The picker is the reason the cast is modelled as data rather than
      // names, so it is worth a screenshot of its own.
      // Shot 02 auto-filled and sealed every pick, and that progress is
      // restored on load — a sealed picker will not open. Clear it first.
      const startOver = page.getByRole("button", { name: /start over/i }).first();
      if (await startOver.count()) {
        await startOver.click();
        await page.waitForTimeout(800);
      }

      const trigger = page.locator('[aria-haspopup="listbox"]').first();
      if (await trigger.count()) {
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        // Wait for the popover itself rather than a fixed delay, so a slow
        // frame cannot produce a screenshot of a half-open list.
        await page.locator('[role="listbox"]').first().waitFor({ timeout: 4000 });
        await page.waitForTimeout(400);
      }
    },
  },
  { name: "04-weekly", tab: "Weekly Council" },
  { name: "05-leaderboard", tab: "Leaderboard", prepare: (page) => scrollTo(page, "Table Leader") },
  { name: "06-rules", tab: "Rules" },
];

/**
 * Scrolls `text` toward the top of the frame, leaving `gutter` CSS px above it
 * so the shot does not start flush against the target.
 *
 * A flush `scrollIntoView({ block: "start" })` gets two things wrong here. It
 * pins the target to y=0, which clips anything that overflows the target's own
 * box upward — the leaderboard's headline value shares a row with its label but
 * is taller, so it lost its top edge. And the tab bar is `position: static`, so
 * on a long screen a flush scroll carries the app header and the tabs out of
 * frame entirely, which is how 02-draft ended up reading as a bare list rather
 * than a screen of the app. `keepNav` caps the scroll so the tabs stay in shot.
 */
const scrollTo = async (page, text, { gutter = 40, keepNav = false } = {}) => {
  const target = page.getByText(text, { exact: false }).first();
  if (!(await target.count())) return;

  // Cap at the tab bar's own offset: scrolling past it is what removes it.
  const cap = keepNav
    ? await page.evaluate(() => {
        const nav = document.querySelector("nav.premium-tabs");
        return nav ? nav.getBoundingClientRect().top + window.scrollY : Number.MAX_SAFE_INTEGER;
      })
    : Number.MAX_SAFE_INTEGER;

  await target.evaluate((el, [g, limit]) => {
    const y = el.getBoundingClientRect().top + window.scrollY - g;
    window.scrollTo({ top: Math.max(0, Math.min(y, limit)), behavior: "instant" });
  }, [gutter, cap]);
  await page.waitForTimeout(500);
};

const browser = await chromium.launch({
  ...(CHROME ? { executablePath: CHROME } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const state = buildDemoState();
const errors = [];

/** Captures the full set at one device size, into its own subdirectory. */
const captureSize = async (size) => {
  const dir = path.join(OUT, size.name);
  await mkdir(dir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: size.viewport,
    deviceScaleFactor: size.scale,
    isMobile: true,
    hasTouch: true,
  });

  await ctx.addInitScript(
    ([key, value, seasonKey, seasonId]) => {
      // Runs before the app's first render, which reads this key synchronously.
      window.localStorage.setItem(key, value);
      window.localStorage.setItem(seasonKey, seasonId);
    },
    ["traitors_db_v4", JSON.stringify(state), "traitors_active_season", state.seasonId]
  );

  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${size.name}: ${e.message.slice(0, 200)}`));

  /**
   * A build with no Supabase env vars throws on load and renders Next's error
   * boundary. Every shot after that is a screenshot of that message, and the
   * pageerror log at the bottom is too late to save the run — so stop on the
   * first one instead of producing six unusable PNGs.
   */
  const assertAppRendered = async () => {
    const body = await page.locator("body").innerText();
    if (/Application error:/i.test(body)) {
      throw new Error(
        "The app failed to boot — see the env note at the top of this file. " +
          "Rebuild with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set."
      );
    }
  };

  const { width, height } = size.viewport;
  console.log(`${size.name} (${width * size.scale} x ${height * size.scale})`);

  let checked = false;
  for (const shot of SHOTS) {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    if (!checked) {
      await assertAppRendered();
      checked = true;
    }

    if (shot.tab) {
      const tab = page.locator("nav.premium-tabs button", { hasText: shot.tab }).first();
      if ((await tab.count()) === 0) {
        console.log(`  ${shot.name}: SKIPPED — no tab named ${shot.tab}`);
        continue;
      }
      await tab.click();
      await page.waitForTimeout(1500);
    }

    if (shot.prepare) await shot.prepare(page);

    const file = path.join(dir, `${shot.name}.png`);
    await page.screenshot({ path: file });
    console.log(`  ${shot.name} -> ${file}`);
  }

  await ctx.close();
};

for (const size of SIZES) await captureSize(size);

if (errors.length) {
  console.log("page errors:", errors.slice(0, 3));
}
await browser.close();
