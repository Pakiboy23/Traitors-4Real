import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  CastMemberStatus,
  GameState,
  PlayerEntry,
  WeeklyResults,
} from "../../types";
import { normalizeFinaleConfig, normalizeGameState } from "./normalizeGameState";
import { redactPublicSeasonState } from "./publicRedaction";
import { calculatePlayerScore } from "./scoring";
import {
  currentStandings,
  displayedWeekDelta,
  homeStandingsBoard,
  seasonTimeline,
  snapshotScoreRecords,
} from "./standings";
import {
  collectScoreAdjustmentRows,
  gameStateForStandings,
  homeBoardFromStandings,
  homeWeekMovement,
  orderByPublishedStandings,
  parsePublishedStandings,
  publicRosterIds,
  publishedStandingsFromGameState,
  publishedWeekMovement,
  sameStandingRoster,
  scoreAdjustmentsFromRows,
  standingsResponseFromRecords,
  stateWithAuthoritativeAdjustments,
  usablePublishedStandings,
  type PublishedStandings,
  type ScoreAdjustmentRow,
  type SeasonStandingsRecord,
} from "./publishedStandings";

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

const seasonRecord = (
  overrides: Partial<SeasonStandingsRecord> = {}
): SeasonStandingsRecord => ({
  season_id: "traitors-new-blood-s1",
  label: "The Traitors: New Blood",
  status: "live",
  timezone: "America/New_York",
  lock_schedule: {},
  active_week_id: "week-4",
  finale_config: { enabled: false, label: "Finale", lockAt: "2026-12-01T00:00:00.000Z" },
  rule_pack_id: "traitors-classic",
  ...overrides,
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
  activeWeekId: "week-4",
  players: [
    player({ id: "serena", name: "Serena", email: "serena@example.com", league: "main" }),
    player({ id: "connor", name: "Connor", email: "connor@example.com", league: "jr" }),
    player({ id: "haaris", name: "Haaris", email: "haaris@example.com", league: "main" }),
  ],
  castStatus: {},
  weeklyResults: clearedWeek("week-4"),
  weeklyScoreHistory: publishedWeeks(),
  ...overrides,
});

const seasonWideAdjustment = (createdAt: string, points = 5) => ({
  id: `adj-${createdAt}`,
  seasonId: "traitors-new-blood-s1",
  playerId: "serena",
  reason: "Manual correction",
  points,
  createdBy: "admin",
  createdAt,
});

/**
 * Server payload against the standings.ts board for the same prepared state.
 * Scores, order, tie-break, week delta, and timeline all have to match.
 */
const expectServerMatchesStandings = (
  state: GameState,
  season: SeasonStandingsRecord = seasonRecord(),
  showConfig?: unknown
) => {
  const prepared = gameStateForStandings({ season, state, showConfig });
  const server = standingsResponseFromRecords({ season, state, showConfig });
  const local = currentStandings(prepared);
  const rosterIds = publicRosterIds(prepared.players);

  expect(server.seasonId).toBe("traitors-new-blood-s1");
  expect(server.rows.map((row) => row.playerId)).toEqual(
    local.map((row) => rosterIds[row.playerIndex] ?? row.playerId)
  );
  expect(server.rows.map((row) => row.name)).toEqual(local.map((row) => row.name));
  expect(server.rows.map((row) => row.score)).toEqual(local.map((row) => row.score));
  expect(server.rows.map((row) => row.tieBreakDistance)).toEqual(
    local.map((row) => row.tieBreakDistance)
  );
  expect(server.rows.map((row) => row.weekDelta)).toEqual(
    local.map((row) => displayedWeekDelta(prepared, row.playerId, row.score))
  );
  expect(server.rows.map((row) => row.rank)).toEqual(local.map((_, index) => index + 1));

  for (const row of server.rows) {
    const index = rosterIds.indexOf(row.playerId);
    const entry = index >= 0 ? prepared.players[index] : undefined;
    const draft = entry ? calculatePlayerScore(prepared, entry).draftPredictionPoints : 0;
    expect(row.timeline).toEqual(seasonTimeline(prepared, entry?.id ?? row.playerId, draft));
  }

  expect(homeBoardFromStandings(prepared, server)).toEqual(homeStandingsBoard(prepared));
  expect(publishedStandingsFromGameState(prepared)).toEqual(server);
  return { prepared, server, local };
};

describe("season-standings matches standings.ts", () => {
  it("leaves a legacy-only history on the published week-2 numbers", () => {
    const state = runningSeason({
      activeWeekId: "week-3",
      weeklyResults: clearedWeek("week-3"),
    });
    const { server } = expectServerMatchesStandings(
      state,
      seasonRecord({ active_week_id: "week-3" })
    );
    const byName = Object.fromEntries(server.rows.map((row) => [row.name, row.score]));
    expect(byName.Serena).toBe(0.5);
    expect(byName.Connor).toBe(0);
    expect(byName.Haaris).toBe(4);
  });

  it("keeps a season-wide adjustment on the board after the week-3 archive", () => {
    const state = runningSeason({
      players: [
        player({
          id: "serena",
          name: "Serena",
          email: "serena@example.com",
          portraitUrl: "/portraits/serena.png",
        }),
      ],
      scoreAdjustments: [seasonWideAdjustment("2026-10-08T00:00:00.000Z")],
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

    const { server } = expectServerMatchesStandings(state);
    expect(server.rows).toHaveLength(1);
    expect(server.rows[0]?.score).toBe(0.5 + 1 + 5);
    expect(server.rows[0]?.weekDelta).toBe(displayedWeekDelta(
      gameStateForStandings({ season: seasonRecord(), state }),
      "serena",
      0.5 + 1 + 5
    ));
    expect(server.rows[0]?.name).toBe("Serena");
  });

  it("keeps an adjustment entered between the last legacy archive and the first component archive", () => {
    const base = runningSeason({
      players: [player({ id: "serena", name: "Serena", email: "serena@example.com" })],
      scoreAdjustments: [seasonWideAdjustment("2026-09-28T00:00:00.000Z")],
    });
    const archived = snapshotScoreRecords(base);
    const state: GameState = {
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

    const { server } = expectServerMatchesStandings(state);
    expect(server.rows[0]?.score).toBe(0.5 + 1 + 5);
    expect(server.rows[0]?.timeline.map((point) => point.total)).toEqual([-1, 0.5, 6.5]);
  });

  it("does not count an adjustment already inside the published legacy total twice", () => {
    const base = runningSeason({
      players: [player({ id: "serena", name: "Serena", email: "serena@example.com" })],
      scoreAdjustments: [seasonWideAdjustment("2026-09-20T00:00:00.000Z")],
    });
    const archived = snapshotScoreRecords(base);
    const state: GameState = {
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

    const { server } = expectServerMatchesStandings(state);
    expect(server.rows[0]?.score).toBe(0.5 + 1);
    expect(server.rows[0]?.timeline.map((point) => point.total)).toEqual([-1, 0.5, 1.5]);
  });

  it("keeps a persisted adjustment when the device clock is behind the server", () => {
    const state = runningSeason({
      players: [player({ id: "serena", name: "Serena", email: "serena@example.com" })],
      scoreAdjustments: [seasonWideAdjustment("2026-10-02T00:00:30.000Z")],
      weeklyScoreHistory: [
        ...publishedWeeks(),
        {
          id: "week-3-snap",
          label: "Week 3",
          createdAt: "2026-10-02T00:00:00.000Z",
          totals: { serena: 1.5 },
          weeklyCallPoints: { serena: 1 },
          draftPredictionPoints: { serena: 0 },
          seasonWideAdjustmentPoints: { serena: 5 },
        },
      ],
    });

    const { server } = expectServerMatchesStandings(state);
    expect(server.rows[0]?.score).toBe(0.5 + 1 + 5);
    expect(server.rows[0]?.timeline.map((point) => point.total)).toEqual([-1, 0.5, 6.5]);
  });

  it("removes a pre-baseline adjustment from the board after it is deleted", () => {
    const adjustment = seasonWideAdjustment("2026-09-20T00:00:00.000Z");
    const base = runningSeason({
      players: [player({ id: "serena", name: "Serena", email: "serena@example.com" })],
      activeWeekId: "week-3",
      weeklyResults: clearedWeek("week-3"),
      scoreAdjustments: [adjustment],
    });
    const archived = snapshotScoreRecords(base);
    const state = runningSeason({
      players: base.players,
      scoreAdjustments: [],
      weeklyScoreHistory: [
        ...publishedWeeks(),
        {
          id: "week-3-snap",
          label: "Week 3",
          createdAt: "2026-10-02T00:00:00.000Z",
          totals: { serena: 1.5 },
          weeklyCallPoints: { serena: 1 },
          draftPredictionPoints: { serena: 0 },
          seasonWideAdjustmentPoints: archived.seasonWideAdjustmentPoints,
          seasonWideInBaselinePoints: archived.seasonWideInBaselinePoints,
        },
      ],
    });

    const { server } = expectServerMatchesStandings(state);
    expect(server.rows[0]?.score).toBe(0.5 + 1 - 5);
    expect(server.rows[0]?.timeline.map((point) => point.total)).toEqual([-1, 0.5, 0.5 + 1 - 5]);
  });

  it("keeps the post-week-3 adjustment when show config still names another cast", () => {
    const state = runningSeason({
      players: [player({ id: "serena", name: "Serena", email: "serena@example.com" })],
      scoreAdjustments: [seasonWideAdjustment("2026-10-08T00:00:00.000Z")],
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
    const { server } = expectServerMatchesStandings(state, seasonRecord(), {
      castNames: ["Lisa Rinna (RHOBH)"],
      showName: "Round Table Draft",
    });
    expect(server.rows[0]?.score).toBe(0.5 + 1 + 5);
  });

  it("adds the open week's calls on top of the archived running total", () => {
    const state = runningSeason({
      players: [
        player({
          id: "serena",
          name: "Serena",
          email: "serena@example.com",
          weeklyPredictions: {
            weekId: "week-4",
            nextBanished: "Arisa Thomas",
            nextMurdered: "",
          },
        }),
      ],
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

    const { server } = expectServerMatchesStandings(state);
    expect(server.rows[0]?.score).toBe(0.5 + 1 + 1);
  });

  it("breaks a tie with the season row's finale flag when the snapshot still holds the pot", () => {
    const withPot = (estimate: number | null): PlayerEntry["weeklyPredictions"] => ({
      nextBanished: "",
      nextMurdered: "",
      finalePredictions: {
        finalWinner: "",
        lastFaithfulStanding: "",
        lastTraitorStanding: "",
        finalPotEstimate: estimate,
      },
    });
    const state = runningSeason({
      activeWeekId: "week-after",
      finaleConfig: { enabled: false, label: "Off", lockAt: "2026-01-01T00:00:00.000Z" },
      players: [
        player({
          id: "avery",
          name: "Avery Chen",
          email: "avery@example.com",
          league: "jr",
          portraitUrl: "/portraits/avery.png",
          weeklyPredictions: withPot(250000),
        }),
        player({
          id: "blair",
          name: "Blair Ortiz",
          email: "blair@example.com",
          weeklyPredictions: withPot(null),
        }),
        player({
          id: "casey",
          name: "Casey Diaz",
          email: "casey@example.com",
          portraitUrl: "/portraits/casey.png",
          weeklyPredictions: withPot(200000),
        }),
      ],
      weeklyResults: clearedWeek("week-after"),
      weeklyScoreHistory: [
        {
          id: "finale-snap",
          label: "Finale",
          createdAt: "2026-12-01T00:00:00.000Z",
          weeklyResults: {
            weekId: "finale",
            finaleResults: { finalPotValue: 210000 },
          },
          totals: { avery: 40, casey: 40, blair: 12 },
        },
      ],
    });
    const season = seasonRecord({
      active_week_id: "week-after",
      finale_config: { enabled: true, label: "Finale", lockAt: "2026-12-01T00:00:00.000Z" },
    });

    const { server } = expectServerMatchesStandings(state, season);
    expect(server.rows.map((row) => row.name)).toEqual([
      "Casey Diaz",
      "Avery Chen",
      "Blair Ortiz",
    ]);
    expect(server.rows.map((row) => row.score)).toEqual([40, 40, 12]);
    expect(server.rows[0]?.tieBreakDistance).toBe(10000);
    expect(server.rows[2]?.tieBreakDistance).toBeNull();
  });

  it("scores from the season row's rule pack when the snapshot still names the old one", () => {
    const state = {
      seasonId: "traitors-new-blood-s1",
      rulePackId: "traitors-classic",
      players: [
        player({
          id: "serena",
          name: "Serena",
          email: "serena@example.com",
          predWinner: "Abbey Benjamin",
        }),
      ],
      castStatus: { "Abbey Benjamin": cast({ isWinner: true }) },
    };
    const season = seasonRecord({
      active_week_id: "week-1",
      rule_pack_id: "generic-elimination",
    });
    const prepared = gameStateForStandings({ season, state });
    expect(prepared.rulePackId).toBe("generic-elimination");
    expect(prepared.seasonConfig.rulePackId).toBe("generic-elimination");

    const { server } = expectServerMatchesStandings(state, season);
    const classic = gameStateForStandings({
      season: seasonRecord({
        active_week_id: "week-1",
        rule_pack_id: "traitors-classic",
      }),
      state,
    });
    expect(currentStandings(classic)[0]?.score).not.toBe(server.rows[0]?.score);
    expect(server.rows[0]?.score).toBe(currentStandings(prepared)[0]?.score);
  });

  it("uses the public client's roster id when a stored player has no id", () => {
    const state = {
      seasonId: "traitors-new-blood-s1",
      players: [
        {
          name: "Legacy Fan",
          email: "legacy@example.com",
          picks: [],
          predFirstOut: "",
          predWinner: "",
          predTraitors: [],
        },
      ],
      castStatus: {},
    };
    const season = seasonRecord();
    const publicClient = normalizeGameState(redactPublicSeasonState(state as Partial<GameState>));
    const server = standingsResponseFromRecords({ season, state });
    expect(server.rows.map((row) => row.playerId)).toEqual(
      publicClient.players.map((entry) => entry.id)
    );
    expect(server.rows[0]?.playerId).toBe("legacy-fan");
    expect(server.rows[0]?.playerId).not.toBe("legacy@example.com");
  });

  it("publishes a name slug when the stored player id is an email", () => {
    const state = runningSeason({
      players: [
        player({
          id: "serena@example.com",
          name: "Serena",
          email: "serena@example.com",
          portraitUrl: "/portraits/serena.png",
          league: "main",
        }),
      ],
    });
    const prepared = gameStateForStandings({ season: seasonRecord(), state });
    const server = standingsResponseFromRecords({ season: seasonRecord(), state });
    expect(prepared.players[0]?.id).toBe("serena@example.com");
    expect(server.rows[0]?.playerId).toBe("serena");
    expect(JSON.stringify(server)).not.toContain("serena@example.com");
    expect(usablePublishedStandings(server, prepared)).toEqual(server);
    expect(homeBoardFromStandings(prepared, server).finalStandings[0]?.portraitUrl).toBe(
      "/portraits/serena.png"
    );
    expect(publicRosterIds(prepared.players)).toEqual(["serena"]);
    expect(
      publicRosterIds([
        player({ id: "a@example.com", name: "Sam Lee" }),
        player({ id: "b@example.com", name: "Sam Lee" }),
      ])
    ).toEqual(["sam-lee-1", "sam-lee-2"]);
    const colliding = publicRosterIds([
      player({ id: "sam", name: "Sam" }),
      player({ id: "sam", name: "Sam" }),
      player({ id: "sam-1", name: "Sam One" }),
    ]);
    expect(colliding).toEqual(["sam-2", "sam-3", "sam-1"]);
    expect(new Set(colliding).size).toBe(colliding.length);
    expect(publicRosterIds([player({ id: "alice@local", name: "Alice" })])).toEqual(["alice"]);
    expect(publicRosterIds([player({ id: "player@example", name: "Pat Example" })])).toEqual([
      "pat-example",
    ]);
  });

  it("publishes distinct roster ids when two rows share an internal id", () => {
    const state = runningSeason({
      players: [
        player({ id: "", name: "Sam Lee", email: "a@example.com" }),
        player({ id: "", name: "Sam Lee", email: "b@example.com" }),
      ],
    });
    const server = standingsResponseFromRecords({ season: seasonRecord(), state });
    expect(server.rows.map((row) => row.playerId).slice().sort()).toEqual(["sam-lee-1", "sam-lee-2"]);
    expect(new Set(server.rows.map((row) => row.playerId)).size).toBe(2);
    expect(JSON.stringify(server)).not.toContain("@");
    expect(
      standingsResponseFromRecords({
        season: seasonRecord(),
        state: runningSeason({
          players: [player({ id: "alice@local", name: "Alice", email: "alice@local" })],
        }),
      }).rows[0]?.playerId
    ).toBe("alice");
  });

  it("scores a table adjustment the snapshot save never copied", () => {
    const history = [
      ...publishedWeeks(),
      {
        id: "week-3-snap",
        label: "Week 3",
        createdAt: "2026-10-02T00:00:00.000Z",
        totals: { serena: 1.5 },
        weeklyCallPoints: { serena: 1 },
        draftPredictionPoints: { serena: 0 },
      },
    ];
    const snapshot = runningSeason({
      players: [player({ id: "serena", name: "Serena", email: "serena@example.com" })],
      scoreAdjustments: [],
      weeklyScoreHistory: history,
    });
    const withTable = stateWithAuthoritativeAdjustments(snapshot, [
      seasonWideAdjustment("2026-10-08T00:00:00.000Z"),
    ]);
    const without = standingsResponseFromRecords({ season: seasonRecord(), state: snapshot });
    const withAdjustment = standingsResponseFromRecords({
      season: seasonRecord(),
      state: withTable,
    });
    expect(withAdjustment.rows[0]?.score).toBe((without.rows[0]?.score ?? 0) + 5);

    const staleSnapshot = stateWithAuthoritativeAdjustments(
      runningSeason({
        players: [player({ id: "serena", name: "Serena", email: "serena@example.com" })],
        scoreAdjustments: [seasonWideAdjustment("2026-10-08T00:00:00.000Z")],
        weeklyScoreHistory: history,
      }),
      []
    );
    const cleared = standingsResponseFromRecords({
      season: seasonRecord(),
      state: staleSnapshot,
    });
    expect(cleared.rows[0]?.score).toBe(without.rows[0]?.score);

    const localOnly = {
      ...seasonWideAdjustment("2026-10-09T00:00:00.000Z", 3),
      id: "local-9",
    };
    const merged = stateWithAuthoritativeAdjustments(
      runningSeason({
        players: [player({ id: "serena", name: "Serena", email: "serena@example.com" })],
        scoreAdjustments: [seasonWideAdjustment("2026-10-01T00:00:00.000Z", 9), localOnly],
        weeklyScoreHistory: history,
      }),
      [seasonWideAdjustment("2026-10-08T00:00:00.000Z")]
    ) as GameState;
    expect(merged.scoreAdjustments?.map((row) => row.id).sort()).toEqual([
      "adj-2026-10-08T00:00:00.000Z",
      "local-9",
    ]);
    const withLocal = standingsResponseFromRecords({ season: seasonRecord(), state: merged });
    expect(withLocal.rows[0]?.score).toBe((without.rows[0]?.score ?? 0) + 5 + 3);
    expect(
      scoreAdjustmentsFromRows([
        {
          id: "adj-1",
          season_id: "traitors-new-blood-s1",
          player_id: "serena",
          week_id: null,
          reason: "Manual correction",
          points: "5",
          created_by_label: null,
          created_at: "2026-10-08T00:00:00.000Z",
        },
      ])
    ).toEqual([
      {
        id: "adj-1",
        seasonId: "traitors-new-blood-s1",
        playerId: "serena",
        weekId: undefined,
        reason: "Manual correction",
        points: 5,
        createdBy: "admin",
        createdAt: "2026-10-08T00:00:00.000Z",
      },
    ]);
  });

  it("ranks home movement from published week deltas", () => {
    const state = runningSeason({
      scoreAdjustments: [seasonWideAdjustment("2026-10-08T00:00:00.000Z", 20)],
    });
    const prepared = gameStateForStandings({ season: seasonRecord(), state });
    const server = standingsResponseFromRecords({ season: seasonRecord(), state });
    const movement = publishedWeekMovement(prepared, server);
    const serena = movement.find((entry) => entry.name === "Serena");
    const archiveOnly = 0.5 - -1;
    expect(serena?.delta).toBe(server.rows.find((row) => row.name === "Serena")?.weekDelta);
    expect(serena?.delta).toBe(archiveOnly + 20);
    expect(movement[0]?.name).toBe("Serena");
    expect(homeWeekMovement(prepared, server)?.map((entry) => entry.delta)).toEqual(
      movement.map((entry) => entry.delta)
    );
    const firstArchive = runningSeason({
      weeklyScoreHistory: [publishedWeeks()[0]!],
    });
    const firstServer = standingsResponseFromRecords({
      season: seasonRecord(),
      state: firstArchive,
    });
    const firstPrepared = gameStateForStandings({
      season: seasonRecord(),
      state: firstArchive,
    });
    expect(firstServer.rows.every((row) => row.weekDelta === null)).toBe(true);
    expect(publishedWeekMovement(firstPrepared, firstServer)).toEqual([]);
    expect(homeWeekMovement(firstPrepared, firstServer)).toBeNull();
    expect(movement.map((entry) => entry.delta)).not.toEqual(
      prepared.players.map((player) => {
        const last = prepared.weeklyScoreHistory?.at(-1)?.totals?.[player.id] ?? 0;
        const prev = prepared.weeklyScoreHistory?.at(-2)?.totals?.[player.id] ?? 0;
        return Number(last) - Number(prev);
      })
    );
  });
});

describe("published standings payload", () => {
  it("drops a response that is an error or has a different roster", () => {
    expect(parsePublishedStandings({ error: "Season not found." })).toBeNull();
    expect(parsePublishedStandings(null)).toBeNull();
    expect(parsePublishedStandings({ seasonId: "traitors-new-blood-s1", rows: [{ playerId: "a" }] })).toBeNull();
    expect(
      parsePublishedStandings({
        seasonId: "traitors-new-blood-s1",
        rows: [
          {
            playerId: "alice@local",
            name: "Serena",
            score: 1,
            tieBreakDistance: null,
            weekDelta: null,
            rank: 1,
            timeline: [],
          },
        ],
      })
    ).toBeNull();

    const standings: PublishedStandings = {
      seasonId: "traitors-new-blood-s1",
      rows: [
        {
          playerId: "serena",
          name: "Serena",
          score: 6.5,
          tieBreakDistance: null,
          weekDelta: 6,
          rank: 1,
          timeline: [{ label: "Week 2", total: 0.5 }],
        },
      ],
    };
    expect(parsePublishedStandings(standings)).toEqual(standings);
    expect(sameStandingRoster(standings, ["serena"])).toBe(true);
    expect(sameStandingRoster(standings, ["serena", "connor"])).toBe(false);
    expect(
      usablePublishedStandings(standings, runningSeason({
        players: [player({ id: "serena", name: "Serena" })],
      }))
    ).toEqual(standings);
    expect(
      usablePublishedStandings(standings, runningSeason())
    ).toBeNull();

    const recapRows = [
      { rank: 2, name: "Connor", score: 0, weekDelta: -1, rankDelta: 1 },
      { rank: 1, name: "Serena", score: 1, weekDelta: 4, rankDelta: 0 },
    ];
    const board: PublishedStandings = {
      seasonId: "traitors-new-blood-s1",
      rows: [
        {
          playerId: "serena",
          name: "Serena",
          score: 6.5,
          tieBreakDistance: null,
          weekDelta: 6,
          rank: 1,
          timeline: [],
        },
        {
          playerId: "connor",
          name: "Connor",
          score: -2,
          tieBreakDistance: null,
          weekDelta: -2,
          rank: 2,
          timeline: [],
        },
      ],
    };
    expect(orderByPublishedStandings(recapRows, board)).toEqual([
      { rank: 1, name: "Serena", score: 6.5, weekDelta: 4, rankDelta: 0 },
      { rank: 2, name: "Connor", score: -2, weekDelta: -1, rankDelta: 1 },
    ]);
    expect(orderByPublishedStandings(recapRows, standings)).toBeNull();

    const sharedName = [
      { rank: 2, name: "Sam", score: 0, weekDelta: 1, rankDelta: 0, playerId: "sam-2" },
      { rank: 1, name: "Sam", score: 1, weekDelta: 2, rankDelta: 0, playerId: "sam-1" },
    ];
    const sharedBoard: PublishedStandings = {
      seasonId: "traitors-new-blood-s1",
      rows: [
        {
          playerId: "sam-1",
          name: "Sam",
          score: 9,
          tieBreakDistance: null,
          weekDelta: 4,
          rank: 1,
          timeline: [],
        },
        {
          playerId: "sam-2",
          name: "Sam",
          score: 3,
          tieBreakDistance: null,
          weekDelta: 1,
          rank: 2,
          timeline: [],
        },
      ],
    };
    expect(orderByPublishedStandings(sharedName, sharedBoard)).toEqual([
      { rank: 1, name: "Sam", score: 9, weekDelta: 2, rankDelta: 0, playerId: "sam-1" },
      { rank: 2, name: "Sam", score: 3, weekDelta: 1, rankDelta: 0, playerId: "sam-2" },
    ]);
    expect(
      orderByPublishedStandings(
        sharedName.map(({ playerId: _playerId, ...row }) => row),
        sharedBoard
      )
    ).toBeNull();
  });

  it("does not put emails or picks on the server payload", () => {
    const state = runningSeason({
      players: [
        player({
          id: "serena",
          name: "Serena",
          email: "serena@example.com",
          picks: [{ member: "Abbey Benjamin", rank: 1, role: "Faithful" }],
        }),
      ],
    });
    const server = standingsResponseFromRecords({ season: seasonRecord(), state });
    const encoded = JSON.stringify(server);
    expect(encoded).not.toContain("serena@example.com");
    expect(encoded).not.toContain("Abbey Benjamin");
    expect(Object.keys(server).sort()).toEqual(["rows", "seasonId"]);
  });
});

describe("normalizeFinaleConfig", () => {
  it("derives the default lock from the supplied time", () => {
    const january = Date.parse("2026-01-01T00:00:00.000Z");
    const february = Date.parse("2026-02-01T00:00:00.000Z");
    expect(normalizeFinaleConfig(null, january).lockAt).toBe("2026-01-08T00:00:00.000Z");
    expect(normalizeFinaleConfig(null, february).lockAt).toBe("2026-02-08T00:00:00.000Z");
    expect(
      normalizeFinaleConfig(
        { enabled: false, label: "Finale", lockAt: "2026-12-01T00:00:00.000Z" },
        january
      ).lockAt
    ).toBe("2026-12-01T00:00:00.000Z");

    const stamped = normalizeGameState(
      {
        players: [],
        scoreAdjustments: [
          {
            id: "adj-1",
            seasonId: "traitors-new-blood-s1",
            playerId: "serena",
            reason: "Manual correction",
            points: 1,
            createdBy: "",
            createdAt: "",
          },
        ],
      },
      january
    );
    expect(stamped.finaleConfig.lockAt).toBe("2026-01-08T00:00:00.000Z");
    expect(stamped.scoreAdjustments[0]?.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("collectScoreAdjustmentRows", () => {
  const row = (id: string): ScoreAdjustmentRow => ({
    id,
    season_id: "traitors-new-blood-s1",
    player_id: "serena",
    week_id: null,
    reason: "Manual correction",
    points: 1,
    created_by_label: "admin",
    created_at: "2026-10-08T00:00:00.000Z",
  });

  it("reads every page and stops on a short page", async () => {
    const pages = [[row("a"), row("b")], [row("c")]];
    const calls: Array<[number, number]> = [];
    const result = await collectScoreAdjustmentRows(async (from, to) => {
      calls.push([from, to]);
      return { data: pages.shift() ?? [], error: null };
    }, 2);
    expect(result).toEqual({ rows: [row("a"), row("b"), row("c")] });
    expect(calls).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("requests the next page when a page is full", async () => {
    const pages = [[row("a"), row("b")], []];
    const result = await collectScoreAdjustmentRows(async () => {
      return { data: pages.shift() ?? [], error: null };
    }, 2);
    expect(result).toEqual({ rows: [row("a"), row("b")] });
  });

  it("fails the read when any page errors", async () => {
    const result = await collectScoreAdjustmentRows(async (from) => {
      if (from === 0) return { data: [row("a"), row("b")], error: null };
      return { data: null, error: { message: "timeout" } };
    }, 2);
    expect(result).toEqual({ error: "timeout" });
  });
});

describe("season-standings function", () => {
  const source = readFileSync(
    path.resolve(__dirname, "../../supabase/functions/season-standings/index.ts"),
    "utf8"
  );

  it("renders standingsResponseFromRecords and does not reimplement scoring", () => {
    expect(source).toContain("standingsResponseFromRecords");
    expect(source).toContain("redactPublicSeasonState");
    expect(source).toContain('from("season_states_public")');
    expect(source).not.toMatch(/from\("season_states"\)/);
    expect(source).toContain('from("score_adjustments")');
    expect(source).toContain("collectScoreAdjustmentRows");
    expect(source).toContain(".range(from, to)");
    expect(source).not.toContain(".limit(500)");
    expect(source).toContain("stateWithAuthoritativeAdjustments");
    expect(source).not.toContain("calculatePlayerScore");
    expect(source).not.toContain("currentStandings");
    expect(source).not.toContain("MULTIPLIERS");
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toMatch(/grant execute/i);
  });

  it("refetches published standings after a successful save", () => {
    const hook = readFileSync(path.resolve(__dirname, "./usePublishedStandings.ts"), "utf8");
    const app = readFileSync(path.resolve(__dirname, "../../App.tsx"), "utf8");
    expect(hook).toContain("persistRevision");
    expect(hook).toContain("unsavedRefreshKey");
    expect(hook).toContain("editIsUnsaved");
    expect(app).toContain("unsavedStandingsKey");
    expect(app).toContain("homeWeekMovement");
    expect(app).toContain("standingsSaveCommit");
    expect(app).toContain("useLayoutEffect");
    expect(app).toContain("setUnsavedStandingsKey(standingsKey)");
    const leaderboard = readFileSync(
      path.resolve(__dirname, "../../components/Leaderboard.tsx"),
      "utf8"
    );
    expect(leaderboard).toContain("publicRosterIds");
    const recapPage = readFileSync(
      path.resolve(__dirname, "../app/recap/[seasonId]/[weekId]/page.tsx"),
      "utf8"
    );
    expect(recapPage).toContain("loadRecapForRequest");
    expect(recapPage.match(/recapWithServerStandings\(/g)).toHaveLength(1);
    expect(recapPage.match(/loadRecapForRequest\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("uses explicit .ts extensions on the Deno import graph", () => {
    const roots = [
      path.resolve(__dirname, "../../supabase/functions/season-standings/index.ts"),
    ];
    const seen = new Set<string>();
    const queue = [...roots];
    const extensionless: string[] = [];
    while (queue.length) {
      const file = queue.pop();
      if (!file || seen.has(file)) continue;
      seen.add(file);
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
        const spec = match[1];
        if (!/\.(ts|tsx|js|json)$/.test(spec)) {
          extensionless.push(`${path.relative(process.cwd(), file)}: ${spec}`);
          continue;
        }
        const resolved = path.resolve(path.dirname(file), spec);
        if (resolved.endsWith(".ts") || resolved.endsWith(".tsx")) queue.push(resolved);
      }
    }
    expect(extensionless).toEqual([]);
  });
});
