import { describe, expect, it } from "vitest";
import type {
  CastMemberStatus,
  GameState,
  PlayerEntry,
  WeeklyResults,
} from "../../types";
import { calculatePlayerScore, getFinaleTieBreakDistance } from "./scoring";
import {
  compareStandingEntries,
  currentStandings,
  homeStandingsBoard,
  leaderboardRankContext,
  resolveDisplayTotal,
  runningTotalsRecord,
  seasonTimeline,
  snapshotScoreRecords,
  weeklyResultsAreLive,
} from "./standings";
import { buildPublicWeeklyRecap } from "./weeklyRecap";

const cast = (overrides: Partial<CastMemberStatus> = {}): CastMemberStatus => ({
  isWinner: false,
  isFirstOut: false,
  isTraitor: false,
  isEliminated: false,
  ...overrides,
});

const player = (overrides: Partial<PlayerEntry> = {}): PlayerEntry => ({
  id: "p1",
  name: "Tester",
  email: "tester@example.com",
  picks: [],
  predFirstOut: "",
  predWinner: "",
  predTraitors: [],
  ...overrides,
});

/** The cleared week archiveWeeklyScores writes after it copies results onto the snapshot. */
const clearedWeek = (weekId: string): WeeklyResults => ({
  weekId,
  nextBanished: "",
  nextMurdered: "",
  bonusGames: {
    redemptionRoulette: "",
    shieldGambit: "",
    traitorTrio: [],
  },
  finaleResults: {
    finalWinner: "",
    lastFaithfulStanding: "",
    lastTraitorStanding: "",
    finalPotValue: null,
  },
});

const withPotEstimate = (estimate: number | null): PlayerEntry["weeklyPredictions"] => ({
  nextBanished: "",
  nextMurdered: "",
  finalePredictions: {
    finalWinner: "",
    lastFaithfulStanding: "",
    lastTraitorStanding: "",
    finalPotEstimate: estimate,
  },
});

/**
 * Same display total and sort the Leaderboard uses for row order.
 * The dossier point ledger is a separate calculation and is not involved.
 */
const rankedLikeLeaderboard = (game: GameState) => {
  const context = leaderboardRankContext(game);
  return game.players
    .map((entry) => {
      const scoring = calculatePlayerScore(game, entry);
      const scoringTotal = scoring.total;
      const displayTotal = resolveDisplayTotal(game, entry.id, scoringTotal, {
        draftPredictionPoints: scoring.draftPredictionPoints,
        weeklyCallPoints: scoring.weeklyCallPoints,
      });
      const tieBreakDistance =
        context.tieBreakActive && typeof context.pot === "number"
          ? getFinaleTieBreakDistance(entry, context.pot)
          : null;
      return {
        playerId: entry.id,
        name: entry.name,
        scoringTotal,
        displayTotal,
        tieBreakDistance,
      };
    })
    .sort((a, b) =>
      compareStandingEntries(
        {
          name: a.name,
          displayTotal: a.displayTotal,
          tieBreakDistance: a.tieBreakDistance,
        },
        {
          name: b.name,
          displayTotal: b.displayTotal,
          tieBreakDistance: b.tieBreakDistance,
        }
      )
    );
};

describe("archived finale pot", () => {
  const finaleState = (pot: number): GameState => ({
    activeWeekId: "week-after",
    finaleConfig: {
      enabled: true,
      label: "Finale",
      lockAt: "2026-12-01T00:00:00.000Z",
    },
    players: [
      player({
        id: "avery",
        name: "Avery Chen",
        email: "avery@example.com",
        league: "jr",
        portraitUrl: "/portraits/avery.png",
        weeklyPredictions: withPotEstimate(250000),
      }),
      player({
        id: "blair",
        name: "Blair Ortiz",
        email: "blair@example.com",
        league: "main",
        portraitUrl: "/portraits/blair.png",
        weeklyPredictions: withPotEstimate(null),
      }),
      player({
        id: "casey",
        name: "Casey Diaz",
        email: "casey@example.com",
        league: "main",
        portraitUrl: "/portraits/casey.png",
        weeklyPredictions: withPotEstimate(200000),
      }),
    ],
    castStatus: {},
    weeklyResults: clearedWeek("week-after"),
    weeklyScoreHistory: [
      {
        id: "finale-snap",
        label: "Finale",
        createdAt: "2026-12-01T00:00:00.000Z",
        weeklyResults: {
          weekId: "finale",
          finaleResults: { finalPotValue: pot },
        },
        totals: { avery: 40, casey: 40, blair: 12 },
      },
    ],
    weeklyRecaps: [
      { weekId: "finale", intro: "Finale night.", published: true },
    ],
  });

  it("breaks a tie on the snapshot pot and feeds that order to Home", () => {
    const nearCasey = finaleState(210000);
    const nearAvery = finaleState(260000);

    expect(weeklyResultsAreLive(nearCasey.weeklyResults)).toBe(false);
    expect(nearCasey.weeklyResults?.finaleResults?.finalPotValue).toBeNull();
    for (const entry of nearCasey.players) {
      expect(calculatePlayerScore(nearCasey, entry).total).toBe(0);
    }

    const caseyOrder = currentStandings(nearCasey);
    const averyOrder = currentStandings(nearAvery);
    expect(caseyOrder.map((row) => row.name)).toEqual([
      "Casey Diaz",
      "Avery Chen",
      "Blair Ortiz",
    ]);
    expect(averyOrder.map((row) => row.name)).toEqual([
      "Avery Chen",
      "Casey Diaz",
      "Blair Ortiz",
    ]);
    expect(caseyOrder.map((row) => row.score)).toEqual([40, 40, 12]);
    expect(averyOrder.map((row) => row.score)).toEqual([40, 40, 12]);

    const caseyHome = homeStandingsBoard(nearCasey);
    const averyHome = homeStandingsBoard(nearAvery);
    expect(caseyHome.finalStandings).toEqual([
      {
        name: "Casey Diaz",
        score: 40,
        portraitUrl: "/portraits/casey.png",
        league: "main",
      },
      {
        name: "Avery Chen",
        score: 40,
        portraitUrl: "/portraits/avery.png",
        league: "jr",
      },
      {
        name: "Blair Ortiz",
        score: 12,
        portraitUrl: "/portraits/blair.png",
        league: "main",
      },
    ]);
    expect(caseyHome.mvp).toEqual({
      name: "Casey Diaz",
      score: 40,
      portraitUrl: "/portraits/casey.png",
      label: "Season MVP",
    });
    expect(averyHome.finalStandings.map((row) => row.name)).toEqual(
      averyOrder.map((row) => row.name)
    );
    expect(averyHome.finalStandings.map((row) => row.score)).toEqual(
      averyOrder.map((row) => row.score)
    );
    expect(averyHome.mvp).toEqual({
      name: "Avery Chen",
      score: 40,
      portraitUrl: "/portraits/avery.png",
      label: "Season MVP",
    });

    expect(rankedLikeLeaderboard(nearCasey).map((row) => row.displayTotal)).toEqual([
      40, 40, 12,
    ]);
    expect(rankedLikeLeaderboard(nearCasey).map((row) => row.playerId)).toEqual(
      caseyOrder.map((row) => row.playerId)
    );
    expect(rankedLikeLeaderboard(nearAvery).map((row) => row.playerId)).toEqual(
      averyOrder.map((row) => row.playerId)
    );

    const recap = buildPublicWeeklyRecap(nearCasey, "finale");
    expect(recap?.standings.map((row) => row.name)).toEqual(
      caseyOrder.map((row) => row.name)
    );
    expect(recap?.standings.map((row) => row.score)).toEqual(
      caseyOrder.map((row) => row.score)
    );
  });
});

describe("live weekly results", () => {
  const liveState = (): GameState => ({
    activeWeekId: "week-2",
    players: [
      player({
        id: "alex",
        name: "Alex Rivera",
        email: "alex@example.com",
        league: "main",
        portraitUrl: "/portraits/alex.png",
        picks: [{ member: "Abbey Benjamin", rank: 1, role: "Faithful" }],
        predWinner: "Abbey Benjamin",
      }),
      player({
        id: "blair",
        name: "Blair Chen",
        email: "blair@example.com",
        league: "jr",
        portraitUrl: "/portraits/blair.png",
      }),
    ],
    castStatus: {
      "Abbey Benjamin": cast({ isWinner: true }),
    },
    weeklyResults: {
      weekId: "week-2",
      nextBanished: "Arisa Thomas",
    },
    weeklyScoreHistory: [
      {
        id: "snap-1",
        label: "Premiere",
        createdAt: "2026-09-18T00:00:00.000Z",
        weeklyResults: { weekId: "week-1", nextBanished: "Someone Else" },
        totals: { alex: 0, blair: 50 },
      },
    ],
    weeklyRecaps: [{ weekId: "week-2", intro: "This week.", published: true }],
  });

  it("uses calculatePlayerScore totals that match the Leaderboard display total", () => {
    const game = liveState();
    const alex = game.players[0];
    const blair = game.players[1];
    const alexTotal = calculatePlayerScore(game, alex).total;
    const blairTotal = calculatePlayerScore(game, blair).total;

    expect(weeklyResultsAreLive(game.weeklyResults)).toBe(true);
    expect(alexTotal).toBeGreaterThan(blairTotal);
    expect(alexTotal).not.toBe(0);
    expect(blairTotal).not.toBe(50);

    const standings = currentStandings(game);
    const leaderboard = rankedLikeLeaderboard(game);
    const home = homeStandingsBoard(game);

    expect(standings.map((row) => row.score)).toEqual([alexTotal, blairTotal]);
    expect(leaderboard.map((row) => row.displayTotal)).toEqual([alexTotal, blairTotal]);
    expect(leaderboard.map((row) => row.scoringTotal)).toEqual([alexTotal, blairTotal]);
    expect(standings.map((row) => row.playerId)).toEqual(
      leaderboard.map((row) => row.playerId)
    );
    expect(home.finalStandings).toEqual([
      {
        name: "Alex Rivera",
        score: alexTotal,
        portraitUrl: "/portraits/alex.png",
        league: "main",
      },
      {
        name: "Blair Chen",
        score: blairTotal,
        portraitUrl: "/portraits/blair.png",
        league: "jr",
      },
    ]);
    expect(home.mvp).toEqual({
      name: "Alex Rivera",
      score: alexTotal,
      portraitUrl: "/portraits/alex.png",
      label: "Season MVP",
    });

    const recap = buildPublicWeeklyRecap(game, "week-2");
    expect(recap?.standings.map((row) => row.score)).toEqual([alexTotal, blairTotal]);
    expect(recap?.standings.map((row) => row.name)).toEqual(
      standings.map((row) => row.name)
    );
  });
});

const publishedWeeks = (): NonNullable<GameState["weeklyScoreHistory"]> => [
  {
    id: "week-1789801840738",
    label: "Week 1",
    createdAt: "2026-09-18T00:00:00.000Z",
    weeklyResults: { weekId: "week-1", nextBanished: "Madeline Kostopulos" },
    totals: { serena: -1, connor: -1, haaris: 3 },
  },
  {
    id: "week-1790468216601",
    label: "Week 2",
    createdAt: "2026-09-25T00:00:00.000Z",
    weeklyResults: { weekId: "week-2", nextBanished: "Arisa Thomas" },
    totals: { serena: 0.5, connor: 0, haaris: 4 },
  },
];

const runningSeason = (overrides: Partial<GameState> = {}): GameState => ({
  seasonId: "traitors-new-blood-s1",
  activeWeekId: "week-3",
  players: [
    player({
      id: "serena",
      name: "Serena",
      email: "serena@example.com",
      league: "main",
      portraitUrl: "/portraits/serena.png",
    }),
    player({
      id: "connor",
      name: "Connor",
      email: "connor@example.com",
      league: "jr",
      portraitUrl: "/portraits/connor.png",
    }),
    player({
      id: "haaris",
      name: "Haaris",
      email: "haaris@example.com",
      league: "main",
      predTraitors: ["Joe Vanella", "Katie Fites"],
    }),
  ],
  castStatus: {
    "Joe Vanella": cast({ isTraitor: true }),
    "Katie Fites": cast({ isTraitor: true }),
  },
  weeklyResults: clearedWeek("week-3"),
  weeklyScoreHistory: publishedWeeks(),
  ...overrides,
});

describe("running season totals", () => {
  it("leaves a legacy-only history on the published week-2 numbers", () => {
    const game = runningSeason();
    const standings = currentStandings(game);
    const byName = Object.fromEntries(standings.map((row) => [row.name, row.score]));

    expect(byName.Serena).toBe(0.5);
    expect(byName.Connor).toBe(0);
    expect(byName.Haaris).toBe(4);
    expect(game.weeklyScoreHistory?.[0]?.totals).toEqual({ serena: -1, connor: -1, haaris: 3 });
    expect(game.weeklyScoreHistory?.[1]?.totals).toEqual({ serena: 0.5, connor: 0, haaris: 4 });
    expect(seasonTimeline(game, "serena").map((point) => point.total)).toEqual([-1, 0.5]);
    expect(homeStandingsBoard(game).mvp?.score).toBe(4);
  });

  it("adds week-3 calls, including Double or Nothing and negative calls, onto the week-2 total", () => {
    const serenaCalls = calculatePlayerScore(
      {
        activeWeekId: "week-3",
        players: [],
        castStatus: {},
        weeklyResults: {
          weekId: "week-3",
          nextBanished: "Arisa Thomas",
          nextMurdered: "Xavier Scruggs",
        },
      },
      player({
        id: "serena",
        weeklyPredictions: {
          weekId: "week-3",
          nextBanished: "Arisa Thomas",
          nextMurdered: "Xavier Scruggs",
          bonusGames: { doubleOrNothing: true },
        },
      })
    );
    const connorCalls = calculatePlayerScore(
      {
        activeWeekId: "week-3",
        players: [],
        castStatus: {},
        weeklyResults: {
          weekId: "week-3",
          nextBanished: "Arisa Thomas",
          nextMurdered: "Xavier Scruggs",
        },
      },
      player({
        id: "connor",
        weeklyPredictions: {
          weekId: "week-3",
          nextBanished: "Someone Else",
          nextMurdered: "Not Xavier",
          bonusGames: { doubleOrNothing: true },
        },
      })
    );

    expect(serenaCalls.draftPredictionPoints).toBe(0);
    expect(serenaCalls.weeklyCallPoints).toBe(4);
    expect(connorCalls.weeklyCallPoints).toBe(-2);

    const archived = snapshotScoreRecords({
      activeWeekId: "week-3",
      players: [
        player({
          id: "serena",
          weeklyPredictions: {
            weekId: "week-3",
            nextBanished: "Arisa Thomas",
            nextMurdered: "Xavier Scruggs",
            bonusGames: { doubleOrNothing: true },
          },
        }),
        player({
          id: "connor",
          weeklyPredictions: {
            weekId: "week-3",
            nextBanished: "Someone Else",
            nextMurdered: "Not Xavier",
            bonusGames: { doubleOrNothing: true },
          },
        }),
      ],
      castStatus: {},
      weeklyResults: {
        weekId: "week-3",
        nextBanished: "Arisa Thomas",
        nextMurdered: "Xavier Scruggs",
      },
    });
    expect(archived.weeklyCallPoints).toEqual({ serena: 4, connor: -2 });
    expect(archived.draftPredictionPoints).toEqual({ serena: 0, connor: 0 });

    const game = runningSeason({
      activeWeekId: "week-4",
      weeklyResults: clearedWeek("week-4"),
      weeklyRecaps: [{ weekId: "week-3", intro: "Week 3.", published: true }],
      weeklyScoreHistory: [
        ...publishedWeeks(),
        {
          id: "week-3-snap",
          label: "Week 3",
          createdAt: "2026-10-02T00:00:00.000Z",
          weeklyResults: { weekId: "week-3", nextBanished: "Arisa Thomas" },
          totals: { serena: 4, connor: -2, haaris: 7 },
          weeklyCallPoints: { serena: 4, connor: -2, haaris: 1 },
          draftPredictionPoints: { serena: 0, connor: 0, haaris: 3 },
        },
      ],
    });

    const standings = currentStandings(game);
    const byName = Object.fromEntries(standings.map((row) => [row.name, row.score]));
    expect(byName.Serena).toBe(0.5 + 4);
    expect(byName.Connor).toBe(0 + -2);
    expect(byName.Haaris).toBe(4 + 1 + (6 - 3));

    expect(homeStandingsBoard(game).finalStandings.map((row) => [row.name, row.score])).toEqual(
      standings.slice(0, 3).map((row) => [row.name, row.score])
    );
    expect(rankedLikeLeaderboard(game).map((row) => row.displayTotal)).toEqual(
      standings.map((row) => row.score)
    );

    const recap = buildPublicWeeklyRecap(game, "week-3");
    expect(recap?.standings.map((row) => row.score)).toEqual(standings.map((row) => row.score));
    expect(recap?.standings.find((row) => row.name === "Serena")?.weekDelta).toBe(4);
    expect(recap?.standings.find((row) => row.name === "Connor")?.weekDelta).toBe(-2);

    expect(seasonTimeline(game, "serena").map((point) => point.total)).toEqual([-1, 0.5, 4.5]);
    expect(seasonTimeline(game, "connor").map((point) => point.total)).toEqual([-1, 0, -2]);
  });

  it("counts a draft-prediction change once across later weeks", () => {
    const week3 = {
      id: "week-3-snap",
      label: "Week 3",
      createdAt: "2026-10-02T00:00:00.000Z",
      weeklyResults: { weekId: "week-3" },
      totals: { haaris: 7 },
      weeklyCallPoints: { haaris: 1 },
      draftPredictionPoints: { haaris: 3 },
    };
    const afterWeek3 = runningSeason({
      players: [
        player({
          id: "haaris",
          name: "Haaris",
          predTraitors: ["Joe Vanella", "Katie Fites"],
        }),
      ],
      activeWeekId: "week-4",
      weeklyResults: clearedWeek("week-4"),
      weeklyScoreHistory: [...publishedWeeks()!, week3],
    });
    expect(currentStandings(afterWeek3)[0]?.score).toBe(4 + 1 + (6 - 3));

    const afterWeek4 = runningSeason({
      players: afterWeek3.players,
      activeWeekId: "week-5",
      weeklyResults: clearedWeek("week-5"),
      weeklyScoreHistory: [
        ...publishedWeeks(),
        week3,
        {
          id: "week-4-snap",
          label: "Week 4",
          createdAt: "2026-10-09T00:00:00.000Z",
          weeklyResults: { weekId: "week-4" },
          totals: { haaris: 5.5 },
          weeklyCallPoints: { haaris: -0.5 },
          draftPredictionPoints: { haaris: 6 },
        },
      ],
    });
    expect(currentStandings(afterWeek4)[0]?.score).toBe(4 + 1 + -0.5 + (6 - 3));
    expect(seasonTimeline(afterWeek3, "haaris", 6).map((point) => point.total)).toEqual([3, 4, 8]);
    expect(seasonTimeline(afterWeek4, "haaris", 6).map((point) => point.total)).toEqual([
      3, 4, 5, 7.5,
    ]);
  });

  it("accumulates several weeks of calls after the legacy baseline", () => {
    const game = runningSeason({
      players: [player({ id: "serena", name: "Serena" })],
      activeWeekId: "week-6",
      weeklyResults: clearedWeek("week-6"),
      castStatus: {},
      weeklyScoreHistory: [
        ...publishedWeeks(),
        {
          id: "week-3-snap",
          label: "Week 3",
          createdAt: "2026-10-02T00:00:00.000Z",
          totals: { serena: 2.5 },
          weeklyCallPoints: { serena: 2 },
          draftPredictionPoints: { serena: 0 },
        },
        {
          id: "week-4-snap",
          label: "Week 4",
          createdAt: "2026-10-09T00:00:00.000Z",
          totals: { serena: 1.5 },
          weeklyCallPoints: { serena: -1 },
          draftPredictionPoints: { serena: 0 },
        },
        {
          id: "week-5-snap",
          label: "Week 5",
          createdAt: "2026-10-16T00:00:00.000Z",
          totals: { serena: 2 },
          weeklyCallPoints: { serena: 0.5 },
          draftPredictionPoints: { serena: 0 },
        },
      ],
    });

    expect(currentStandings(game)[0]?.score).toBe(0.5 + 2 + -1 + 0.5);
    expect(seasonTimeline(game, "serena").map((point) => point.total)).toEqual([
      -1, 0.5, 2.5, 1.5, 2,
    ]);
  });

  it("adds the open week's calls on top of the archived running total", () => {
    const game = runningSeason({
      players: [
        player({
          id: "serena",
          name: "Serena",
          weeklyPredictions: {
            weekId: "week-4",
            nextBanished: "Arisa Thomas",
            nextMurdered: "",
          },
        }),
      ],
      castStatus: {},
      activeWeekId: "week-4",
      weeklyResults: { weekId: "week-4", nextBanished: "Arisa Thomas" },
      weeklyScoreHistory: [
        ...publishedWeeks(),
        {
          id: "week-3-snap",
          label: "Week 3",
          createdAt: "2026-10-02T00:00:00.000Z",
          totals: { serena: 1.5 },
          weeklyCallPoints: { serena: 1 },
          draftPredictionPoints: { serena: 0 },
        },
      ],
    });

    expect(currentStandings(game)[0]?.score).toBe(0.5 + 1 + 1);
  });

  it("keeps a season-wide score adjustment on the board after the week-3 archive", () => {
    const game = runningSeason({
      players: [player({ id: "serena", name: "Serena" })],
      activeWeekId: "week-4",
      weeklyResults: clearedWeek("week-4"),
      castStatus: {},
      scoreAdjustments: [
        {
          id: "adj-1",
          seasonId: "traitors-new-blood-s1",
          playerId: "serena",
          reason: "Manual correction",
          points: 5,
          createdBy: "admin",
          createdAt: "2026-10-08T00:00:00.000Z",
        },
      ],
      weeklyScoreHistory: [
        ...publishedWeeks(),
        {
          id: "week-3-snap",
          label: "Week 3",
          createdAt: "2026-10-02T00:00:00.000Z",
          totals: { serena: 1.5 },
          weeklyCallPoints: { serena: 1 },
          draftPredictionPoints: { serena: 0 },
        },
      ],
    });

    const scored = calculatePlayerScore(game, game.players[0]);
    expect(scored.total).toBe(5);
    expect(scored.draftPredictionPoints).toBe(0);
    expect(scored.weeklyCallPoints).toBe(0);
    expect(currentStandings(game)[0]?.score).toBe(0.5 + 1 + 5);
    expect(homeStandingsBoard(game).mvp?.score).toBe(0.5 + 1 + 5);
  });

  const seasonWideAdjustment = (createdAt: string) => ({
    id: `adj-${createdAt}`,
    seasonId: "traitors-new-blood-s1",
    playerId: "serena",
    reason: "Manual correction",
    points: 5,
    createdBy: "admin",
    createdAt,
  });

  const week3ComponentSeason = (adjustmentCreatedAt: string): GameState => {
    const base = runningSeason({
      players: [player({ id: "serena", name: "Serena" })],
      activeWeekId: "week-4",
      weeklyResults: clearedWeek("week-4"),
      castStatus: {},
      scoreAdjustments: [seasonWideAdjustment(adjustmentCreatedAt)],
    });
    // Week 3 is archived the way Archive Week does it, with the adjustment
    // already on the season, so its draft bucket is whatever scoring puts there.
    const archived = snapshotScoreRecords(base);
    return {
      ...base,
      weeklyScoreHistory: [
        ...publishedWeeks(),
        {
          id: "week-3-snap",
          label: "Week 3",
          createdAt: "2026-10-02T00:00:00.000Z",
          totals: { serena: archived.totals.serena + 1 },
          weeklyCallPoints: { serena: 1 },
          draftPredictionPoints: archived.draftPredictionPoints,
        },
      ],
    };
  };

  it("keeps an adjustment entered between the last legacy archive and the first component archive", () => {
    // Week 2 (legacy) archived 25 Sep, correction entered 28 Sep, week 3 (first
    // component snapshot) archived 2 Oct. The legacy baseline predates it, so
    // the board has to add it once.
    const game = week3ComponentSeason("2026-09-28T00:00:00.000Z");

    expect(currentStandings(game)[0]?.score).toBe(0.5 + 1 + 5);
    expect(homeStandingsBoard(game).mvp?.score).toBe(0.5 + 1 + 5);
    expect(seasonTimeline(game, "serena").map((point) => point.total)).toEqual([-1, 0.5, 6.5]);
    expect(runningTotalsRecord(game.weeklyScoreHistory!, 2, ["serena"], game).serena).toBe(6.5);
  });

  it("does not count an adjustment already in the published legacy total twice", () => {
    // Entered 20 Sep, before week 2 was archived, so week 2's published 0.5
    // already includes it.
    const game = week3ComponentSeason("2026-09-20T00:00:00.000Z");

    expect(currentStandings(game)[0]?.score).toBe(0.5 + 1);
    expect(seasonTimeline(game, "serena").map((point) => point.total)).toEqual([-1, 0.5, 1.5]);
  });
});
