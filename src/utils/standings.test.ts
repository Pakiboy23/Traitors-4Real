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
      const scoringTotal = calculatePlayerScore(game, entry).total;
      const displayTotal = resolveDisplayTotal(game, entry.id, scoringTotal);
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
