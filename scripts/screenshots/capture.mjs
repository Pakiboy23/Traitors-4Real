/**
 * Captures App Store screenshots at both iPhone sizes App Store Connect asks
 * for: 6.9" (1320 x 2868) and 6.5" (1242 x 2688). One run emits both, into
 * store/screenshots/iphone-6.9/ and store/screenshots/iphone-6.5/.
 *
 * Both are needed. The 6.5" slot rejects a 1320 x 2868 asset outright, so a
 * 6.9"-only run leaves that slot empty and the version cannot be submitted.
 * The app is iPhone-only (`TARGETED_DEVICE_FAMILY = 1`), so iPad slots are
 * not required.
 *
 * Run a production build first, serve it, then point this at it:
 *
 *   npx playwright install chromium
 *   npx next build && npx next start -p 3222
 *   node scripts/screenshots/capture.mjs http://127.0.0.1:3222
 *
 * Or: `npm run screenshots:capture` after the production server is up.
 *
 * The build needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * They are inlined at build time, so an unset pair reaches createClient() as ""
 * and the app dies on load with "Application error: a client-side exception".
 * `.env.production` already has them.
 *
 * Live Supabase is blocked in this browser. Without that, `listSeasons` would
 * replace the injected sample season with the live roster — real names and the
 * private league title on the most public surface the app has. Fonts and the
 * app origin still load.
 *
 * Playwright is a devDependency so the import resolves after `npm ci`.
 * Chromium still needs `npx playwright install chromium` before capture.
 * Output lands in ./store/screenshots (override with SHOT_DIR).
 *
 * The sample season is injected into localStorage before the app boots. See
 * demo-season.mjs for why that matters.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { CAST_NAMES, DEMO_LEAGUE_NAME, buildDemoState } from "./demo-season.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3222";
const OUT = process.env.SHOT_DIR ?? "store/screenshots";
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
 *
 * Tab labels must match `components/Layout.tsx` after `sanitizeShowConfig`
 * fills terminology defaults: Home, Draft, Weekly Council, Leaderboard.
 * Rules is a utility-bar button, not a tab (#137).
 */
const SHOTS = [
  { name: "01-home", tab: null },
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
      // Shot 02 auto-filled and sealed every pick, and that progress is
      // restored on load — a sealed picker will not open. Clear it first.
      // "Start over" only appears once restored progress is on screen.
      const startOver = page.getByRole("button", { name: /start over/i }).first();
      if (await startOver.count()) {
        await startOver.click();
        await page.waitForTimeout(800);
      }

      const trigger = page.locator('[aria-haspopup="listbox"]').first();
      if (await trigger.count()) {
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        await page.locator('[role="listbox"]').first().waitFor({ timeout: 4000 });
        await page.waitForTimeout(400);
      }
    },
  },
  {
    name: "04-weekly",
    tab: "Weekly Council",
    prepare: async (page) => {
      const name = page.getByPlaceholder("Name").first();
      if (await name.count()) {
        await name.fill("Nadia Brooks");
      }
      const email = page.getByPlaceholder("Email").first();
      if (await email.count()) {
        await email.fill("nadia.brooks@example.com");
      }
      const banished = page.getByLabel("Main next banished");
      if (await banished.count()) {
        const option = CAST_NAMES.find((member) => member !== "Talia Ferreira");
        if (option) await banished.selectOption(option);
      }
      const murdered = page.getByLabel("Main next murdered");
      if (await murdered.count()) {
        await murdered.selectOption(CAST_NAMES[5] ?? "Wendell Hart");
      }
      // Filling the email field leaves a focus ring. An App Store shot of a
      // mid-edit field reads as unfinished.
      await page.locator("h3.premium-section-title").first().click();
      await scrollTo(page, "Weekly Council", { keepNav: true });
    },
  },
  {
    name: "05-leaderboard",
    tab: "Leaderboard",
    prepare: (page) => scrollTo(page, "Table Leader", { keepNav: true }),
  },
  {
    name: "06-rules",
    tab: null,
    prepare: async (page) => {
      const rules = page.getByRole("button", { name: /^Rules$/ }).first();
      if ((await rules.count()) === 0) {
        throw new Error("Rules utility-bar button is missing — screenshot 06 cannot open the guide");
      }
      await rules.click();
      await page.waitForTimeout(1200);
    },
  },
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
    colorScheme: "dark",
    reducedMotion: "reduce",
  });

  await ctx.route("**/*", (route) => {
    const url = route.request().url();
    if (/supabase\.(co|in)/i.test(url) || /supabase\.co/i.test(url)) {
      return route.abort();
    }
    return route.continue();
  });

  await ctx.addInitScript(
    ([key, value, seasonKey, seasonId]) => {
      window.localStorage.setItem(key, value);
      window.localStorage.setItem(seasonKey, seasonId);
    },
    ["traitors_db_v4", JSON.stringify(state), "traitors_active_season", state.seasonId]
  );

  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${size.name}: ${e.message.slice(0, 200)}`));

  const assertAppRendered = async () => {
    const body = await page.locator("body").innerText();
    if (/Application error:/i.test(body)) {
      throw new Error(
        "The app failed to boot — see the env note at the top of this file. " +
          "Rebuild with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set."
      );
    }
    // CSS uppercases the kicker, so match the league name case-insensitively.
    if (!/Home/i.test(body) || !new RegExp(DEMO_LEAGUE_NAME, "i").test(body)) {
      throw new Error(
        "Demo season did not render. Live Supabase may have overwritten it, or the Home tab is missing."
      );
    }
  };

  const { width, height } = size.viewport;
  console.log(`${size.name} (${width * size.scale} x ${height * size.scale})`);

  let checked = false;
  for (const shot of SHOTS) {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.locator("nav.premium-tabs").waitFor({ timeout: 8000 });
    await page.waitForTimeout(800);

    if (!checked) {
      await assertAppRendered();
      checked = true;
    }

    if (shot.tab) {
      const tab = page.locator("nav.premium-tabs button", { hasText: shot.tab }).first();
      if ((await tab.count()) === 0) {
        throw new Error(`${shot.name}: no tab named ${shot.tab}`);
      }
      await tab.click();
      await page.waitForTimeout(1000);
    }

    if (shot.prepare) await shot.prepare(page);

    const file = path.join(dir, `${shot.name}.png`);
    await page.screenshot({ path: file });
    console.log(`  ${shot.name} -> ${file}`);
  }

  await ctx.close();
};

await mkdir(OUT, { recursive: true });
for (const size of SIZES) {
  await captureSize(size);
}

if (errors.length) {
  console.log("page errors:", errors.slice(0, 3));
}
await browser.close();
