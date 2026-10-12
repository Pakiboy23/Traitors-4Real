import { describe, expect, it } from "vitest";
import {
  decideAdminSeasonRefresh,
  failedWriteFromRejection,
  isUnsavedFailedWriteActive,
  seasonBoardKey,
  shouldAcceptSaveSettlement,
  shouldResetAdminSeasonReady,
} from "./adminSeasonRefresh";

const SEASON = "season-under-test";
const ADMIN_BOARD = seasonBoardKey(SEASON, true);
const PUBLIC_BOARD = seasonBoardKey(SEASON, false);

const base = {
  isAdminAuthenticated: true,
  appliedBoardKey: ADMIN_BOARD,
  requestBoardKey: ADMIN_BOARD,
  isLatestFetch: true,
  hasDebouncedSave: false,
  hasPendingWrite: false,
  hasUnsavedFailedWrite: false,
  editRevisionAtFetchStart: 4,
  editRevisionNow: 4,
};

describe("decideAdminSeasonRefresh", () => {
  it("lets public clients apply every broadcast", () => {
    expect(
      decideAdminSeasonRefresh({
        ...base,
        isAdminAuthenticated: false,
        appliedBoardKey: PUBLIC_BOARD,
        requestBoardKey: PUBLIC_BOARD,
        hasDebouncedSave: true,
        hasPendingWrite: true,
        editRevisionNow: 9,
      })
    ).toEqual({ applyRemote: true, markAdminReady: false });
  });

  it("applies the first admin load and only then arms autosave", () => {
    expect(
      decideAdminSeasonRefresh({ ...base, appliedBoardKey: null })
    ).toEqual({ applyRemote: true, markAdminReady: true });
  });

  it("treats signing in over the redacted public board as a first load, even with stale save refs", () => {
    // The public board is redacted. It must be replaced before autosave can
    // run, or a commissioner edit would write the redacted board over the archive.
    expect(
      decideAdminSeasonRefresh({
        ...base,
        appliedBoardKey: PUBLIC_BOARD,
        hasDebouncedSave: true,
        hasPendingWrite: true,
        hasUnsavedFailedWrite: true,
        editRevisionNow: 7,
      })
    ).toEqual({ applyRemote: true, markAdminReady: true });
  });

  it("keeps the board while a debounced save is waiting", () => {
    expect(decideAdminSeasonRefresh({ ...base, hasDebouncedSave: true })).toEqual({
      applyRemote: false,
      markAdminReady: true,
    });
  });

  it("keeps the board while a save is in flight", () => {
    expect(decideAdminSeasonRefresh({ ...base, hasPendingWrite: true })).toEqual({
      applyRemote: false,
      markAdminReady: true,
    });
  });

  it("keeps the board after a dirty save failed", () => {
    expect(decideAdminSeasonRefresh({ ...base, hasUnsavedFailedWrite: true })).toEqual({
      applyRemote: false,
      markAdminReady: true,
    });
  });

  it("drops a snapshot fetched before an edit or save that has since finished", () => {
    expect(decideAdminSeasonRefresh({ ...base, editRevisionNow: 6 })).toEqual({
      applyRemote: false,
      markAdminReady: true,
    });
  });

  it("never applies an out-of-order response", () => {
    expect(decideAdminSeasonRefresh({ ...base, isLatestFetch: false })).toEqual({
      applyRemote: false,
      markAdminReady: false,
    });
    expect(
      decideAdminSeasonRefresh({
        ...base,
        isAdminAuthenticated: false,
        appliedBoardKey: PUBLIC_BOARD,
        requestBoardKey: PUBLIC_BOARD,
        isLatestFetch: false,
      })
    ).toEqual({ applyRemote: false, markAdminReady: false });
  });

  it("still applies a clean background refresh so another commissioner's change lands", () => {
    expect(decideAdminSeasonRefresh(base)).toEqual({
      applyRemote: true,
      markAdminReady: true,
    });
  });
});

describe("shouldAcceptSaveSettlement", () => {
  it("accepts only the newest save for the board now on screen", () => {
    expect(
      shouldAcceptSaveSettlement({
        settledBoardKey: ADMIN_BOARD,
        activeBoardKey: ADMIN_BOARD,
        settledGeneration: 2,
        latestGeneration: 2,
      })
    ).toBe(true);
    expect(
      shouldAcceptSaveSettlement({
        settledBoardKey: ADMIN_BOARD,
        activeBoardKey: ADMIN_BOARD,
        settledGeneration: 1,
        latestGeneration: 2,
      })
    ).toBe(false);
  });

  it("ignores a settlement after the commissioner leaves that board", () => {
    expect(
      shouldAcceptSaveSettlement({
        settledBoardKey: ADMIN_BOARD,
        activeBoardKey: seasonBoardKey("other-season", true),
        settledGeneration: 1,
        latestGeneration: 1,
      })
    ).toBe(false);
    expect(
      shouldAcceptSaveSettlement({
        settledBoardKey: ADMIN_BOARD,
        activeBoardKey: null,
        settledGeneration: 1,
        latestGeneration: 1,
      })
    ).toBe(false);
  });
});

describe("failedWriteFromRejection", () => {
  it("records a failure only when the current board still differs from lastRemote", () => {
    expect(
      failedWriteFromRejection({
        boardKey: ADMIN_BOARD,
        currentSerialized: "B",
        lastRemoteSerialized: "A",
      })
    ).toEqual({ boardKey: ADMIN_BOARD });
    expect(
      failedWriteFromRejection({
        boardKey: ADMIN_BOARD,
        currentSerialized: "A",
        lastRemoteSerialized: "A",
      })
    ).toBeNull();
  });
});

describe("isUnsavedFailedWriteActive", () => {
  it("ignores a failure from another board or a board that now matches lastRemote", () => {
    expect(
      isUnsavedFailedWriteActive({ boardKey: ADMIN_BOARD }, ADMIN_BOARD, "B", "A")
    ).toBe(true);
    expect(
      isUnsavedFailedWriteActive(
        { boardKey: ADMIN_BOARD },
        seasonBoardKey("other-season", true),
        "B",
        "A"
      )
    ).toBe(false);
    expect(
      isUnsavedFailedWriteActive({ boardKey: ADMIN_BOARD }, ADMIN_BOARD, "A", "A")
    ).toBe(false);
    expect(isUnsavedFailedWriteActive(null, ADMIN_BOARD, "B", "A")).toBe(false);
  });
});

describe("shouldResetAdminSeasonReady", () => {
  it("gates autosave on the first admin load and after sign-in", () => {
    expect(
      shouldResetAdminSeasonReady({
        isAdminAuthenticated: true,
        appliedBoardKey: null,
        requestBoardKey: ADMIN_BOARD,
      })
    ).toBe(true);
    expect(
      shouldResetAdminSeasonReady({
        isAdminAuthenticated: true,
        appliedBoardKey: PUBLIC_BOARD,
        requestBoardKey: ADMIN_BOARD,
      })
    ).toBe(true);
  });

  it("never cancels autosave on a broadcast echo of the board on screen", () => {
    expect(
      shouldResetAdminSeasonReady({
        isAdminAuthenticated: true,
        appliedBoardKey: ADMIN_BOARD,
        requestBoardKey: ADMIN_BOARD,
      })
    ).toBe(false);
  });

  it("does nothing for public clients", () => {
    expect(
      shouldResetAdminSeasonReady({
        isAdminAuthenticated: false,
        appliedBoardKey: null,
        requestBoardKey: PUBLIC_BOARD,
      })
    ).toBe(false);
  });
});

/**
 * Regression for the reported bug. Mirrors App.tsx's refs and replays one
 * commissioner save: saveSeasonState writes season_states and then seasons,
 * so the save echoes back twice, and the commissioner keeps typing during the
 * echo. On the old code, each echo set adminSeasonReady false (clearing the
 * 500ms debounce) and replaced the board with the committed snapshot, so the
 * follow-up edit was never saved.
 */
describe("season_state_changed echo during an admin edit", () => {
  type Board = { label: string };

  const createAdminHarness = () => {
    const refs = {
      appliedBoardKey: null as string | null,
      activeBoardKey: ADMIN_BOARD as string | null,
      fetchSeq: 0,
      editRevision: 0,
      saveGeneration: 0,
      debounceTimer: null as number | null,
      pendingWrite: null as string | null,
      manualSaveInFlight: 0,
      unsavedFailedWrite: null as { boardKey: string } | null,
      lastRemote: null as string | null,
    };
    let board: Board = { label: "loading" };
    let adminSeasonReady = false;
    let nextTimerId = 1;
    const saved: string[] = [];

    const startFetch = (snapshot: Board) => {
      const fetchSeq = ++refs.fetchSeq;
      const editRevisionAtFetchStart = refs.editRevision;
      const requestBoardKey = refs.activeBoardKey ?? ADMIN_BOARD;
      if (
        shouldResetAdminSeasonReady({
          isAdminAuthenticated: true,
          appliedBoardKey: refs.appliedBoardKey,
          requestBoardKey,
        })
      ) {
        adminSeasonReady = false;
        // The autosave effect depends on adminSeasonReady, so flipping it
        // clears the debounce timer.
        refs.debounceTimer = null;
      }
      return {
        resolve: () => {
          const decision = decideAdminSeasonRefresh({
            isAdminAuthenticated: true,
            appliedBoardKey: refs.appliedBoardKey,
            requestBoardKey,
            isLatestFetch: fetchSeq === refs.fetchSeq,
            hasDebouncedSave: refs.debounceTimer !== null,
            hasPendingWrite:
              refs.pendingWrite !== null || refs.manualSaveInFlight > 0,
            hasUnsavedFailedWrite: isUnsavedFailedWriteActive(
              refs.unsavedFailedWrite,
              requestBoardKey,
              board.label,
              refs.lastRemote
            ),
            editRevisionAtFetchStart,
            editRevisionNow: refs.editRevision,
          });
          if (decision.applyRemote) {
            board = snapshot;
            refs.appliedBoardKey = requestBoardKey;
            refs.lastRemote = snapshot.label;
            refs.unsavedFailedWrite = null;
          }
          if (decision.markAdminReady) adminSeasonReady = true;
        },
      };
    };

    const edit = (label: string) => {
      board = { label };
      if (!adminSeasonReady) return;
      if (label === refs.lastRemote || label === refs.pendingWrite) {
        refs.debounceTimer = null;
        return;
      }
      refs.editRevision += 1;
      refs.debounceTimer = nextTimerId++;
    };

    const fireDebounce = () => {
      if (refs.debounceTimer === null) return null;
      refs.debounceTimer = null;
      const serialized = board.label;
      refs.pendingWrite = serialized;
      refs.editRevision += 1;
      const settledGeneration = ++refs.saveGeneration;
      const settledBoardKey = ADMIN_BOARD;
      return {
        settle: (succeeded = true) => {
          if (refs.pendingWrite === serialized) refs.pendingWrite = null;
          refs.editRevision += 1;
          const accept = shouldAcceptSaveSettlement({
            settledBoardKey,
            activeBoardKey: refs.activeBoardKey,
            settledGeneration,
            latestGeneration: refs.saveGeneration,
          });
          if (!accept) return;
          if (succeeded) {
            saved.push(serialized);
            refs.lastRemote = serialized;
            refs.unsavedFailedWrite = null;
          } else {
            refs.unsavedFailedWrite = failedWriteFromRejection({
              boardKey: settledBoardKey,
              currentSerialized: board.label,
              lastRemoteSerialized: refs.lastRemote,
            });
          }
        },
      };
    };

    const saveNow = () => {
      const serialized = board.label;
      refs.manualSaveInFlight += 1;
      refs.editRevision += 1;
      const settledGeneration = ++refs.saveGeneration;
      const settledBoardKey = ADMIN_BOARD;
      return {
        settle: (succeeded = true) => {
          const accept = shouldAcceptSaveSettlement({
            settledBoardKey,
            activeBoardKey: refs.activeBoardKey,
            settledGeneration,
            latestGeneration: refs.saveGeneration,
          });
          if (accept) {
            if (succeeded) {
              saved.push(serialized);
              refs.lastRemote = serialized;
              refs.unsavedFailedWrite = null;
            } else {
              refs.unsavedFailedWrite = failedWriteFromRejection({
                boardKey: settledBoardKey,
                currentSerialized: board.label,
                lastRemoteSerialized: refs.lastRemote,
              });
            }
          }
          refs.editRevision += 1;
          refs.manualSaveInFlight -= 1;
        },
      };
    };

    return {
      startFetch,
      edit,
      fireDebounce,
      saveNow,
      leaveBoard() {
        refs.activeBoardKey = seasonBoardKey("other-season", true);
        refs.unsavedFailedWrite = null;
      },
      get board() {
        return board;
      },
      get adminSeasonReady() {
        return adminSeasonReady;
      },
      get hasDebouncedSave() {
        return refs.debounceTimer !== null;
      },
      saved,
    };
  };

  it("keeps the next unsaved edit and saves it", () => {
    const app = createAdminHarness();
    app.startFetch({ label: "week 3 committed" }).resolve();
    expect(app.board.label).toBe("week 3 committed");
    expect(app.adminSeasonReady).toBe(true);

    // Edit A, debounce fires, save starts.
    app.edit("A: banished set");
    const saveA = app.fireDebounce();
    expect(saveA).not.toBeNull();

    // season_states write echoes while the save is still writing seasons.
    const echoStates = app.startFetch({ label: "A: banished set" });
    saveA!.settle();
    // seasons write echoes after the save resolves.
    const echoSeasons = app.startFetch({ label: "A: banished set" });

    // The commissioner types the next change during the echo.
    app.edit("B: murdered set");
    expect(app.adminSeasonReady).toBe(true);
    expect(app.hasDebouncedSave).toBe(true);

    echoStates.resolve();
    echoSeasons.resolve();

    expect(app.board.label).toBe("B: murdered set");
    expect(app.adminSeasonReady).toBe(true);
    expect(app.hasDebouncedSave).toBe(true);

    const saveB = app.fireDebounce();
    expect(saveB).not.toBeNull();
    saveB!.settle();
    expect(app.saved).toEqual(["A: banished set", "B: murdered set"]);

    // B's own echo applies cleanly once nothing local is outstanding.
    app.startFetch({ label: "B: murdered set" }).resolve();
    expect(app.board.label).toBe("B: murdered set");
  });

  it("does not roll back to a snapshot fetched before a save that has since finished", () => {
    const app = createAdminHarness();
    app.startFetch({ label: "committed" }).resolve();

    app.edit("C: shield set");
    const staleFetch = app.startFetch({ label: "committed" });
    app.fireDebounce()!.settle();
    staleFetch.resolve();

    expect(app.board.label).toBe("C: shield set");
    expect(app.saved).toEqual(["C: shield set"]);
  });

  it("still lands another commissioner's change when nothing local is pending", () => {
    const app = createAdminHarness();
    app.startFetch({ label: "committed" }).resolve();
    app.startFetch({ label: "edited in another tab" }).resolve();
    expect(app.board.label).toBe("edited in another tab");
  });

  it("keeps a merged edit after a failed save so a later refresh cannot roll it back", () => {
    const app = createAdminHarness();
    app.startFetch({ label: "committed" }).resolve();

    app.edit("merged vote");
    app.fireDebounce()!.settle(false);

    expect(app.board.label).toBe("merged vote");
    expect(app.saved).toEqual([]);

    // The 45s seasons poll remounts the loader and fetches the last committed row.
    app.startFetch({ label: "committed" }).resolve();
    expect(app.board.label).toBe("merged vote");
  });

  it("records the board submitted when a manual save starts", () => {
    const app = createAdminHarness();
    app.startFetch({ label: "committed" }).resolve();

    const save = app.saveNow();
    app.edit("next edit");
    save.settle();

    expect(app.saved).toEqual(["committed"]);
    expect(app.board.label).toBe("next edit");
    expect(app.hasDebouncedSave).toBe(true);
  });

  it.each([true, false])(
    "rejects an overlapping fetch after a manual save settles (success: %s)",
    (succeeded) => {
      const app = createAdminHarness();
      app.startFetch({ label: "committed" }).resolve();

      const save = app.saveNow();
      const overlappingFetch = app.startFetch({ label: "stale remote" });
      save.settle(succeeded);
      overlappingFetch.resolve();

      expect(app.board.label).toBe("committed");
      expect(app.saved).toEqual(succeeded ? ["committed"] : []);

      app.startFetch({ label: "fresh remote" }).resolve();
      expect(app.board.label).toBe("fresh remote");
    }
  );

  it("does not let an older save success clear a newer failed board's protection", () => {
    const app = createAdminHarness();
    app.startFetch({ label: "committed" }).resolve();

    app.edit("A");
    const saveA = app.fireDebounce();
    app.edit("B");
    const saveB = app.fireDebounce();
    saveB!.settle(false);
    saveA!.settle(true);

    expect(app.board.label).toBe("B");
    expect(app.saved).toEqual([]);

    app.startFetch({ label: "A" }).resolve();
    expect(app.board.label).toBe("B");
  });

  it("does not mark a reverted board dirty when a failed save settles late", () => {
    const app = createAdminHarness();
    app.startFetch({ label: "committed" }).resolve();

    app.edit("B");
    const saveB = app.fireDebounce();
    app.edit("committed");
    saveB!.settle(false);

    app.startFetch({ label: "committed" }).resolve();
    expect(app.board.label).toBe("committed");
  });

  it("ignores a late failure after the commissioner leaves the season", () => {
    const app = createAdminHarness();
    app.startFetch({ label: "committed" }).resolve();

    app.edit("left behind");
    const save = app.fireDebounce();
    app.leaveBoard();
    save!.settle(false);

    app.startFetch({ label: "other season committed" }).resolve();
    expect(app.board.label).toBe("other season committed");
  });

  it("does not apply a snapshot fetched while a manual save is in flight", () => {
    const app = createAdminHarness();
    app.startFetch({ label: "committed" }).resolve();

    // saveNow bumps revision before saveSeasonState returns. A fetch that
    // starts after that bump sees an equal revision and no pendingWrite unless
    // the in-flight manual save is counted as outstanding work.
    const save = app.saveNow();
    const overlappingFetch = app.startFetch({ label: "stale remote" });
    overlappingFetch.resolve();

    expect(app.board.label).toBe("committed");
    save.settle();
    expect(app.saved).toEqual(["committed"]);

    app.startFetch({ label: "committed" }).resolve();
    expect(app.board.label).toBe("committed");
  });
});
