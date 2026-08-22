/**
 * A sample season, used only to capture App Store screenshots.
 *
 * Why this exists rather than a seeded row in Supabase: `listSeasons` orders
 * seasons newest-first and the app defaults to the first non-archived one, so
 * a demo season in production would become the default for every player who
 * has not already picked one. This fixture is injected into localStorage in a
 * throwaway browser profile instead, and nothing is written to the database.
 *
 * Everything here is invented. The cast are not real people, the players are
 * not real people, and the league name is not the real one — screenshots are
 * the most public surface the app has, and none of those belong on it.
 */

export const DEMO_LEAGUE_NAME = "The Sunday Table";

const cast = [
  ["Nora Whitfield", 34, "Paramedic", "Portland, OR"],
  ["Desmond Achebe", 41, "Architect", "Newark, NJ"],
  ["Priya Raman", 29, "Data Analyst", "Austin, TX"],
  ["Colm Byrne", 52, "Fisherman", "Gloucester, MA"],
  ["Talia Ferreira", 26, "Barista", "Miami, FL"],
  ["Wendell Hart", 47, "Locksmith", "Cleveland, OH"],
  ["Ingrid Solberg", 38, "Veterinarian", "Duluth, MN"],
  ["Marcus Delacroix", 31, "Sommelier", "New Orleans, LA"],
  ["Bea Nakamura", 44, "Air Traffic Controller", "Honolulu, HI"],
  ["Ravi Chatterjee", 27, "Stunt Performer", "Burbank, CA"],
  ["Signe Larsen", 35, "Cartographer", "Anchorage, AK"],
  ["Otis Pruitt", 59, "Beekeeper", "Asheville, NC"],
  ["Camille Boateng", 33, "Prosecutor", "Atlanta, GA"],
  ["Hugo Marchetti", 45, "Butcher", "Providence, RI"],
  ["Junie Alvarez", 24, "Tattoo Artist", "Tucson, AZ"],
  ["Fenwick Oyelaran", 39, "Radiologist", "Detroit, MI"],
  ["Rosalind Pike", 50, "Auctioneer", "Charleston, SC"],
  ["Dmitri Vasquez", 28, "Welder", "Pittsburgh, PA"],
];

/** Banished or murdered so far — gives the Overview tile a real count. */
const eliminated = new Set(["Talia Ferreira", "Hugo Marchetti", "Junie Alvarez"]);
const traitors = new Set(["Wendell Hart", "Camille Boateng", "Ravi Chatterjee"]);

export const CAST_NAMES = cast.map(([name]) => name);

const castStatus = Object.fromEntries(
  cast.map(([name, age, occupation, hometown]) => [
    name,
    {
      age,
      occupation,
      hometown,
      portraitUrl: null,
      isEliminated: eliminated.has(name),
      isTraitor: traitors.has(name),
      isFirstOut: name === "Talia Ferreira",
      isWinner: false,
    },
  ])
);

// Eight entrants with a spread of scores, so the leaderboard shows a race
// rather than a wall of zeroes.
const roster = [
  ["Nadia Brooks", 31.5],
  ["Theo Lindqvist", 28],
  ["Marisol Vega", 26.5],
  ["Ike Adeyemi", 22],
  ["Rowan Fitzgerald", 19.5],
  ["Yuki Tanaka", 17],
  ["Sam Okafor", 12.5],
  ["Priya Kaur", 9],
];

const pickFor = (offset) =>
  Array.from({ length: 10 }, (_, i) => {
    const member = CAST_NAMES[(offset * 3 + i * 2) % CAST_NAMES.length];
    return { member, rank: i + 1, role: traitors.has(member) ? "Traitor" : "Faithful" };
  });

export const players = roster.map(([name, _score], index) => ({
  id: `demo-${index + 1}`,
  name,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
  league: "main",
  picks: pickFor(index),
  predFirstOut: "Talia Ferreira",
  predWinner: CAST_NAMES[(index * 5) % CAST_NAMES.length],
  predTraitors: [CAST_NAMES[index % 18], CAST_NAMES[(index + 6) % 18], CAST_NAMES[(index + 11) % 18]],
  weeklyPredictions: {
    weekId: "week-4",
    nextBanished: CAST_NAMES[(index + 2) % 18],
    nextMurdered: CAST_NAMES[(index + 9) % 18],
    bonusGames: {
      doubleOrNothing: index % 3 === 0,
      shieldGambit: "",
      redemptionRoulette: "",
      traitorTrio: [],
    },
  },
}));

/** Three scored weeks, so the leaderboard has movement behind it. */
const weekTotals = (weekIndex) =>
  Object.fromEntries(
    roster.map(([, total], i) => [`demo-${i + 1}`, Number((total / 3 + (weekIndex - 1) * 0.5 - i * 0.25).toFixed(1))])
  );

export const weeklyScoreHistory = [1, 2, 3].map((week) => ({
  id: `demo-week-${week}`,
  label: `Week ${week}`,
  createdAt: `2026-09-${String(10 + week * 7).padStart(2, "0")}T02:00:00.000Z`,
  totals: weekTotals(week),
  weeklyResults: {
    nextBanished: CAST_NAMES[week * 4],
    nextMurdered: CAST_NAMES[week * 3 + 1],
    bonusGames: { traitorTrio: [], shieldGambit: "", redemptionRoulette: "" },
  },
}));

export const buildDemoState = () => ({
  seasonId: "demo-preview",
  activeWeekId: "week-4",
  rulePackId: "traitors-classic",
  players,
  castStatus,
  weeklyScoreHistory,
  weeklyResults: {
    weekId: "week-4",
    nextBanished: "",
    nextMurdered: "",
    bonusGames: { traitorTrio: [], shieldGambit: "", redemptionRoulette: "" },
  },
  weeklySubmissionHistory: [],
  scoreAdjustments: [],
  seasonConfig: {
    seasonId: "demo-preview",
    label: "Sample Season",
    status: "live",
    timezone: "America/New_York",
    lockSchedule: { draftLockAt: "2026-09-17T01:00:00.000Z" },
    activeWeekId: "week-4",
    rulePackId: "traitors-classic",
  },
  showConfig: {
    slug: "default",
    showName: "Round Table Draft",
    shortName: "Round Table",
    leagueName: DEMO_LEAGUE_NAME,
    castNames: CAST_NAMES,
    branding: {
      headerKicker: "Round Table Draft",
      appTitle: "Round Table Command Desk",
      footerCopy: "Round Table Draft workspace.",
    },
    featureToggles: {
      draftEnabled: true,
      jrLeagueEnabled: true,
      finaleEnabled: true,
      scoreAdjustmentsEnabled: true,
      seasonArchivingEnabled: true,
    },
  },
});
