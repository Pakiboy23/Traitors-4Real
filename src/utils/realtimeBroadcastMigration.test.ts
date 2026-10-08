import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const migration = readFileSync(
  path.join(repoRoot, "supabase/0009_realtime_broadcasts.sql"),
  "utf8"
);
const verify = readFileSync(
  path.join(repoRoot, "supabase/scripts/verify-realtime-broadcast.sql"),
  "utf8"
);
const app = readFileSync(path.join(repoRoot, "App.tsx"), "utf8");
const admin = readFileSync(path.join(repoRoot, "components/AdminPanel.tsx"), "utf8");

const sendCalls = [...migration.matchAll(/perform realtime\.send\([\s\S]*?\);/g)].map(
  (match) => match[0]
);

describe("realtime broadcast migration", () => {
  it("sends the two events the client subscribes to", () => {
    expect(sendCalls).toHaveLength(2);

    const season = sendCalls.find((call) => call.includes("'season_state_changed'"));
    const submission = sendCalls.find((call) => call.includes("'submission_changed'"));
    expect(season).toBeDefined();
    expect(submission).toBeDefined();

    expect(season).toContain("'season:' || season_id || ':state'");
    expect(season).toContain("'source', source");
    expect(season).toContain("'operation', operation");
    expect(season).toMatch(/,\s*false\s*\)/);

    expect(submission).toContain("'admin:submissions'");
    expect(submission).toContain("'submission_id'");
    expect(submission).toContain("'kind'");
    expect(submission).toContain("'submission_status'");
    expect(submission).toContain("'season_id'");
    expect(submission).toContain("'week_id'");
    expect(submission).toContain("'operation', tg_op");
    expect(submission).toMatch(/,\s*true\s*\)/);
  });

  it("does not put private row data on either channel", () => {
    expect(migration).not.toMatch(/(?:perform|select)\s+realtime\.broadcast_changes/i);
    for (const call of sendCalls) {
      expect(call).not.toMatch(/email|new\.state|old\.state|weekly_banished|weekly_murdered|\.name\b|\.payload\b/);
    }
    expect(migration).not.toMatch(/on public\.season_state_emails/i);
    expect(migration).not.toMatch(/on public\.show_configs/i);
    expect(migration).not.toMatch(/on public\.score_adjustments/i);
  });

  it("fires for season state, season rows, and submissions only", () => {
    expect(migration).toContain(
      "after insert or update or delete on public.season_states"
    );
    expect(migration).toContain(
      "after insert or update or delete on public.seasons"
    );
    expect(migration).toContain(
      "after insert or update or delete on public.submissions"
    );
    expect(migration).toContain("position(':' in season_id) > 0");
    expect(migration).toContain("pg_trigger_depth() < 1");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
  });

  it("keeps the functions out of the public API and the anon role", () => {
    expect(migration).toContain("function private.send_season_state_signal(");
    expect(migration).toContain("function private.broadcast_season_state_change()");
    expect(migration).toContain("function private.broadcast_submission_change()");
    expect(migration).toContain("drop function if exists public.broadcast_season_state_change()");
    expect(migration).toContain("drop function if exists public.broadcast_submission_change()");
    expect(migration).toContain(
      "revoke all on function private.broadcast_submission_change() from public, anon, authenticated"
    );
    expect(migration).not.toMatch(
      /grant execute on function private\.broadcast_submission_change\(\) to anon/
    );
  });

  it("authorizes receive on the private topic and leaves clients unable to publish", () => {
    expect(migration).toContain("create policy season_state_broadcast_read");
    expect(migration).toContain("to anon, authenticated");
    expect(migration).toContain("realtime.messages.extension = 'broadcast'");
    expect(migration).toContain("(select realtime.topic()) ~ '^season:[^:]+:state$'");

    expect(migration).toContain("create policy admin_submission_broadcast_read");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("(select realtime.topic()) = 'admin:submissions'");
    expect(migration).toContain("(select private.is_traitors_admin())");

    expect(migration).not.toMatch(/on realtime\.messages[\s\S]*for insert/i);
    expect(migration).not.toMatch(/on realtime\.messages[\s\S]*for all/i);
    expect(migration).not.toMatch(/using \(\s*true\s*\)/);
  });

  it("ships a read-only verify script for the same objects", () => {
    expect(verify).toContain("private.send_season_state_signal");
    expect(verify).toContain("private.broadcast_season_state_change");
    expect(verify).toContain("private.broadcast_submission_change");
    expect(verify).toContain("broadcast_season_row_change_trigger");
    expect(verify).toContain("season_state_broadcast_read");
    expect(verify).toContain("admin_submission_broadcast_read");
    expect(verify).toContain("client write policy on realtime.messages");
    expect(verify).not.toMatch(/\b(insert|update|delete)\s+into\b/i);
  });
});

describe("broadcast listeners still fall back when no signal arrives", () => {
  it("keeps the season poll and refreshes the season list from the public signal", () => {
    expect(app).toContain("subscribeToSeasonState(seasonId, () => {");
    expect(app).toMatch(/subscribeToSeasonState\(seasonId, \(\) => \{[\s\S]*?void loadSeasonState\(\);[\s\S]*?listSeasons\(\)/);
    expect(app).toContain("window.setInterval(refreshSeasons, 45000)");
  });

  it("does not let a season_state_changed echo overwrite unsaved admin edits", () => {
    const loader = app.slice(
      app.indexOf("const loadSeasonState = async () => {"),
      app.indexOf("void loadSeasonState();")
    );
    expect(loader.length).toBeGreaterThan(0);
    // The echo must not flip adminSeasonReady off (that clears the debounce)
    // or replace the board without asking the refresh guard first.
    expect(loader).not.toContain("if (isAdminAuthenticated) setAdminSeasonReady(false);");
    expect(loader).toContain("shouldResetAdminSeasonReady({");
    expect(loader).toContain("decideAdminSeasonRefresh({");
    expect(loader).toContain("isLatestFetch: fetchSeq === seasonFetchSeqRef.current");
    expect(loader).toContain("hasDebouncedSave: writeTimerRef.current !== null");
    expect(loader).toContain("pendingWriteRef.current !== null");
    expect(loader).toContain("manualSaveInFlightRef.current > 0");
    expect(loader).toContain("editRevisionNow: adminEditRevisionRef.current");
    expect(app).toContain("manualSaveInFlightRef.current += 1;");
    expect(app).toMatch(
      /manualSaveInFlightRef\.current \+= 1;[\s\S]*?finally \{\s*adminEditRevisionRef\.current \+= 1;\s*manualSaveInFlightRef\.current -= 1;/
    );
    expect(loader.match(/setGameState\(/g)).toHaveLength(1);
    expect(loader).toContain("if (decision.applyRemote) {");
    expect(app).toContain("seasonBoardKey(seasonId, isAdminAuthenticated)");

    // writeTimerRef means "a debounced save is pending", so it must be nulled
    // when the timer fires and when it is cleared.
    expect(app).toMatch(/window\.setTimeout\(\(\) => \{\s*writeTimerRef\.current = null;/);
    expect(app).toMatch(
      /window\.clearTimeout\(writeTimerRef\.current\);\s*writeTimerRef\.current = null;/
    );
    expect(app).toContain("if (pendingWriteRef.current === serialized) pendingWriteRef.current = null;");
  });

  it("keeps the weekly poll and postgres_changes listener, and refreshes draft entries too", () => {
    expect(admin).toContain("subscribeToWeeklySubmissions");
    expect(admin).toMatch(/window\.setInterval\(\(\) => \{\s*refreshSubmissions\(\);\s*\}, 30000\)/);
    expect(admin).toMatch(
      /subscribeToAdminSubmissions\(\(\) => \{[\s\S]*?refreshSubmissions\(\);[\s\S]*?refreshDraftSubmissions\(\);/
    );
    expect(app).toContain("window.setInterval(loadPendingSubmissions, 45000)");
    expect(app).toContain("subscribeToAdminSubmissions(() => {");
  });
});
