import type { PublicWeeklyRecap } from "./weeklyRecap";

/** Dev-only sample so the recap layout can be opened without publishing a real week. */
export const RECAP_FIXTURE: PublicWeeklyRecap = {
  seasonId: "traitors-new-blood-s1",
  seasonLabel: "New Blood",
  leagueName: "UPRV Fantasy League",
  weekId: "week-2",
  weekLabel: "Week 2",
  intro: "The round table got loud, the shield actually mattered, and the table moved.",
  published: true,
  results: {
    banished: "Arisa Thomas",
    murdered: "Xavier Scruggs",
    shield: "Clyde Moser",
    newTraitors: ["Lisa Rinna"],
  },
  standings: [
    { rank: 1, name: "Alex Rivera", score: 18, weekDelta: 6, rankDelta: 2 },
    { rank: 2, name: "Blair Chen", score: 15, weekDelta: -2, rankDelta: -1 },
    { rank: 3, name: "Casey Morgan", score: 15, weekDelta: 0, rankDelta: 0 },
    { rank: 4, name: "Devon Blake", score: 9, weekDelta: 4, rankDelta: 1 },
    { rank: 5, name: "Eden Brooks", score: 7, weekDelta: null, rankDelta: null },
  ],
};
