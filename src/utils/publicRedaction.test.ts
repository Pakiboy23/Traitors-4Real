import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SeasonState } from "../../types";
import {
  mergeArchivedEmails,
  redactPublicSeasonState,
} from "./publicRedaction";

const from = vi.hoisted(() => vi.fn());

vi.mock("../../src/lib/supabase", () => ({
  supabase: { from },
  supabaseUrl: "https://example.supabase.co",
}));

import {
  fetchAdminSeasonState,
  fetchPlayerPortraits,
  fetchSeasonState,
} from "../../services/supabase";

const repoRoot = path.resolve(__dirname, "../..");
const PLAYER_EMAIL = "ada@example.com";
const HISTORY_EMAIL = "history@example.com";

const leakedState = {
  seasonId: "traitors-new-blood-s1",
  players: [
    {
      id: "p1",
      name: "Ada Lovelace",
      email: PLAYER_EMAIL,
      picks: [{ member: "Sherry Kuehl", rank: 1 }],
      predFirstOut: "A",
      predWinner: "B",
      predTraitors: ["C"],
    },
  ],
  weeklySubmissionHistory: [
    {
      id: "h1",
      name: "Ada Lovelace",
      email: HISTORY_EMAIL,
      weekId: "week-1",
      mergedAt: "2026-09-20T00:00:00.000Z",
    },
  ],
};

type QueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

const responses = new Map<string, QueryResult>();
const calls: { table: string; columns: string }[] = [];

const query = (table: string) => {
  const result = responses.get(table) ?? {
    data: null,
    error: { code: "PGRST116", message: "no rows" },
  };
  const builder = {
    select(columns: string) {
      calls.push({ table, columns });
      return builder;
    },
    eq() {
      return builder;
    },
    limit() {
      return builder;
    },
    single() {
      return Promise.resolve(result);
    },
    maybeSingle() {
      return Promise.resolve(result);
    },
    then(onFulfilled: (value: QueryResult) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  return builder;
};

beforeEach(() => {
  responses.clear();
  calls.length = 0;
  from.mockReset();
  from.mockImplementation((table: string) => query(table));
});

const addressesIn = (value: unknown) =>
  JSON.stringify(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];

describe("redactPublicSeasonState", () => {
  it("removes player and history emails and leaves the board fields", () => {
    const redacted = redactPublicSeasonState(leakedState);

    expect(addressesIn(redacted)).toEqual([]);
    expect(redacted.players[0]).not.toHaveProperty("email");
    expect(redacted.weeklySubmissionHistory[0]).not.toHaveProperty("email");
    expect(redacted.players[0].name).toBe("Ada Lovelace");
    expect(redacted.players[0].picks).toEqual([{ member: "Sherry Kuehl", rank: 1 }]);
    expect(redacted.weeklySubmissionHistory[0].weekId).toBe("week-1");
  });

  it("does not mutate the admin copy it was given", () => {
    const original = structuredClone(leakedState);
    redactPublicSeasonState(original);
    expect(original.players[0].email).toBe(PLAYER_EMAIL);
  });
});

describe("mergeArchivedEmails", () => {
  it("restores archived addresses onto a stripped season", () => {
    const stripped = redactPublicSeasonState(leakedState) as SeasonState;
    const merged = mergeArchivedEmails(stripped, {
      players: { p1: PLAYER_EMAIL },
      history: { h1: HISTORY_EMAIL },
    });

    expect(merged.players[0].email).toBe(PLAYER_EMAIL);
    expect(merged.weeklySubmissionHistory?.[0].email).toBe(HISTORY_EMAIL);
  });

  it("keeps an address that is still on the row", () => {
    const merged = mergeArchivedEmails(leakedState as SeasonState, {
      players: { p1: "other@example.com" },
      history: {},
    });
    expect(merged.players[0].email).toBe(PLAYER_EMAIL);
  });
});

describe("fetchSeasonState", () => {
  it("reads the public view and returns no emails", async () => {
    responses.set("season_states_public", {
      data: { state: leakedState },
      error: null,
    });

    const state = await fetchSeasonState("traitors-new-blood-s1");

    expect(calls[0]).toEqual({ table: "season_states_public", columns: "state" });
    expect(calls.some((call) => call.table === "season_states")).toBe(false);
    expect(addressesIn(state)).toEqual([]);
    expect(state?.players[0].name).toBe("Ada Lovelace");
    expect(state?.players[0].picks).toEqual([{ member: "Sherry Kuehl", rank: 1 }]);
    expect(state?.weeklySubmissionHistory?.[0].weekId).toBe("week-1");
  });

  it("strips emails when the view is missing and the table still has them", async () => {
    responses.set("season_states_public", {
      data: null,
      error: { code: "PGRST205", message: "Could not find the table in the schema cache" },
    });
    responses.set("season_states", {
      data: { state: leakedState },
      error: null,
    });

    const state = await fetchSeasonState("traitors-new-blood-s1");

    expect(calls.map((call) => call.table)).toEqual([
      "season_states_public",
      "season_states",
    ]);
    expect(addressesIn(state)).toEqual([]);
  });
});

describe("fetchAdminSeasonState", () => {
  it("merges archived emails back for the commissioner", async () => {
    responses.set("season_states", {
      data: { state: redactPublicSeasonState(leakedState) },
      error: null,
    });
    responses.set("season_state_emails", {
      data: {
        emails: {
          players: { p1: PLAYER_EMAIL },
          history: { h1: HISTORY_EMAIL },
        },
      },
      error: null,
    });

    const state = await fetchAdminSeasonState("traitors-new-blood-s1");

    expect(calls.map((call) => call.table)).toEqual([
      "season_states",
      "season_state_emails",
    ]);
    expect(state?.players[0].email).toBe(PLAYER_EMAIL);
    expect(state?.weeklySubmissionHistory?.[0].email).toBe(HISTORY_EMAIL);
  });
});

describe("fetchPlayerPortraits", () => {
  it("reads the public projection and does not return emails", async () => {
    responses.set("player_portraits_public", {
      data: [
        {
          email: PLAYER_EMAIL,
          name: "Ada Lovelace",
          portrait_url: "https://cdn.example/ada.png",
        },
      ],
      error: null,
    });

    const portraits = await fetchPlayerPortraits();

    expect(calls[0]).toEqual({
      table: "player_portraits_public",
      columns: "name, portrait_url",
    });
    expect(calls[0].columns).not.toContain("email");
    expect(portraits).toEqual({
      "ada lovelace": "https://cdn.example/ada.png",
    });
    expect(addressesIn(portraits)).toEqual([]);
  });

  it("falls back to name and portrait_url on the base table, still without email", async () => {
    responses.set("player_portraits_public", {
      data: null,
      error: { code: "PGRST205", message: "Could not find the table in the schema cache" },
    });
    responses.set("player_portraits", {
      data: [
        {
          email: PLAYER_EMAIL,
          name: "Ada Lovelace",
          portrait_url: "https://cdn.example/ada.png",
        },
      ],
      error: null,
    });

    const portraits = await fetchPlayerPortraits();

    expect(calls.map((call) => `${call.table}:${call.columns}`)).toEqual([
      "player_portraits_public:name, portrait_url",
      "player_portraits:name, portrait_url",
    ]);
    expect(addressesIn(portraits)).toEqual([]);
  });
});

describe("public email redaction in the repo", () => {
  const sql = readFileSync(
    path.join(repoRoot, "supabase/0005_redact_public_emails.sql"),
    "utf8"
  );
  const privacy = readFileSync(path.join(repoRoot, "src/app/privacy/page.tsx"), "utf8");
  const security = readFileSync(path.join(repoRoot, "SECURITY.md"), "utf8");

  it("strips stored season JSON, archives emails for admin, and hides portrait emails", () => {
    expect(sql).toContain("public.season_states_public");
    expect(sql).toContain("public.redact_emails(state)");
    expect(sql).toContain("public.season_state_emails");
    expect(sql).toContain("length(incoming) > 0");
    expect(sql).not.toMatch(/drop policy if exists season_states_public_read/);
    expect(sql).not.toMatch(/alter table public\.submissions/i);
    expect(sql).toContain("revoke select on table public.player_portraits");
    expect(sql).toContain(
      "grant select (name, portrait_url, updated_at)"
    );
    expect(sql).toContain("public.player_portraits_public");
  });

  it("matches the leaderboard without promising that picks are admin-only", () => {
    expect(privacy).toMatch(/Other players see the leaderboard/);
    expect(privacy).toMatch(/your picks, and your score/);
    expect(privacy).toMatch(/They do not see your email address/);
    expect(privacy).toMatch(/submission tied to your email is readable only/);
    expect(privacy).not.toMatch(/Entries are readable only by the league administrator/);
    expect(security).toMatch(/Names, draft picks, and scores are on the leaderboard/);
    expect(security).toMatch(/Emails are not part of that read/);
    expect(security).not.toMatch(/email, push token, or draft picks/);
  });
});
