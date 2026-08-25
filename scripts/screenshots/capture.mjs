/**
 * Captures App Store screenshots at the 6.9" size (1320 x 2868).
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

// 440 x 956 at 3x is exactly the 1320 x 2868 Apple asks for.
const VIEWPORT = { width: 440, height: 956 };
const SCALE = 3;

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
      await scrollTo(page, "Draft Board");
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

/** Scrolls a heading to the top of the frame so the content leads the shot. */
const scrollTo = async (page, text) => {
  const target = page.getByText(text, { exact: false }).first();
  if (await target.count()) {
    await target.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(500);
  }
};

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  ...(CHROME ? { executablePath: CHROME } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  isMobile: true,
  hasTouch: true,
});

const state = buildDemoState();
await ctx.addInitScript(
  ([key, value, seasonKey, seasonId]) => {
    // Runs before the app's first render, which reads this key synchronously.
    window.localStorage.setItem(key, value);
    window.localStorage.setItem(seasonKey, seasonId);
  },
  ["traitors_db_v4", JSON.stringify(state), "traitors_active_season", state.seasonId]
);

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));

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

  const file = path.join(OUT, `${shot.name}.png`);
  await page.screenshot({ path: file });
  console.log(`  ${shot.name} -> ${file}`);
}

if (errors.length) {
  console.log("page errors:", errors.slice(0, 3));
}
await browser.close();
