import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Layout from "./components/Layout";
import Welcome, {
  type LeaguePulseOverview,
  type TopMoverEntry,
} from "./components/Welcome";
import DraftForm from "./components/DraftForm";
import RulesGuide from "./components/RulesGuide";
import WeeklyCouncil from "./components/WeeklyCouncil";
import AdminPanel from "./components/AdminPanel";
import Leaderboard from "./components/Leaderboard";
import AdminAuth from "./components/AdminAuth";
import { ToastProvider } from "./components/Toast";
import {
  GameState,
  inferActiveWeekId,
  normalizeWeekId,
  League,
  PlayerEntry,
  SeasonConfig,
  ShowConfig,
} from "./types";
import { homeStandingsBoard } from "./src/utils/standings";
import { normalizeGameState } from "./src/utils/normalizeGameState";
import {
  homeBoardFromStandings,
  homeWeekMovement,
  usablePublishedStandings,
} from "./src/utils/publishedStandings";
import { standingsSaveCommit } from "./src/utils/standingsHold";
import {
  standingsRefreshKey,
  usePublishedStandings,
} from "./src/utils/usePublishedStandings";
import { TIMING } from "./src/utils/scoringConstants";
import { sanitizeSeasonConfig } from "./src/config/validation";
import { adminAuthErrorMessage, applyAdminSessionResult } from "./src/utils/adminAuth";
import { readForceClosedFromEnv, resolveDraftWindow } from "./src/utils/draftWindow";
import { resolveHomeCountdown } from "./src/utils/homeCountdown";
import { pickPreferredSeason } from "./src/utils/seasonSelection";
import {
  decideAdminSeasonRefresh,
  seasonBoardKey,
  shouldResetAdminSeasonReady,
} from "./src/utils/adminSeasonRefresh";
import {
  canPersistSeasonState,
  isolateSeasonGameplay,
  isFinaleResultsCertified,
  rosterForSeason,
} from "./src/utils/seasonAuthority";
import { logger } from "./src/utils/logger";
import { installPushDeepLinkHandler, RECAP_DEEP_LINK_EVENT, registerForPush } from "./src/native/push";
import { publicPortraitKey, redactPublicSeasonState } from "./src/utils/publicRedaction";
import type { RecapDeepLink } from "./src/utils/pushDeepLink";
import InAppRecap from "./components/InAppRecap";
import {
  fetchShowConfig,
  fetchSeasonState,
  fetchAdminSeasonState,
  listSeasons,
  fetchPlayerPortraits,
  normalizeEmail,
  onAdminAuthChange,
  saveSeasonState,
  signInAdmin,
  signOutAdmin,
  submitGrowthEvent,
  fetchWeeklySubmissions,
  subscribeToAdminSubmissions,
  subscribeToSeasonState,
} from "./services/supabase";

const STORAGE_KEY = "traitors_db_v4";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [recapDeepLink, setRecapDeepLink] = useState<RecapDeepLink | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  // Public season JSON has no emails. Autosave stays off until the admin
  // read has merged season_state_emails back in, so a redacted board cannot
  // be written over the archive.
  const [adminSeasonReady, setAdminSeasonReady] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const confirmedAdminUserIdRef = useRef<string | null>(null);
  const [adminAuthPending, setAdminAuthPending] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [unsavedStandingsKey, setUnsavedStandingsKey] = useState<string | null>(null);
  const committedStandingsKeyRef = useRef<string | null>(null);
  const [lastWriteError, setLastWriteError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<SeasonConfig[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const activeSeasonIdRef = useRef<string | null>(activeSeasonId);
  useLayoutEffect(() => {
    activeSeasonIdRef.current = activeSeasonId;
  }, [activeSeasonId]);
  const standingsKeyRef = useRef("");
  const [loadedSeasonId, setLoadedSeasonId] = useState<string | null>(null);
  const [seasonShellEnabled, setSeasonShellEnabled] = useState(false);
  const lastRemoteStateRef = useRef<string | null>(null);
  const pendingWriteRef = useRef<string | null>(null);
  const unsavedFailedWriteRef = useRef(false);
  const manualSaveInFlightRef = useRef(0);
  const writeTimerRef = useRef<number | null>(null);
  // Which board (season + admin/public view) is on screen, the newest season
  // fetch, and a counter bumped on every local edit or save. Together they let
  // a season_state_changed echo refresh the board without overwriting an
  // admin's unsaved edit. See src/utils/adminSeasonRefresh.ts.
  const appliedBoardKeyRef = useRef<string | null>(null);
  const seasonFetchSeqRef = useRef(0);
  const adminEditRevisionRef = useRef(0);
  // show_configs is the authority for branding and terminology, but the game
  // and season snapshots each embed their own copy, frozen whenever they were
  // last written. Those snapshots arrive on a whole-state replace, so without
  // this the fresh config is fetched, applied, and then silently overwritten by
  // a months-old duplicate. Held in a ref because the two loads race and either
  // can land first.
  const [authoritativeShowConfig, setAuthoritativeShowConfig] =
    useState<ShowConfig | null>(null);

  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return redactPublicSeasonState(normalizeGameState(JSON.parse(saved)));
      }
    } catch {
      // ignore corrupted localStorage
    }

    return normalizeGameState({ players: [] });
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const ref = params.get("ref");
    const league = params.get("league");

    if (tab && ["home", "weekly", "leaderboard", "draft", "admin"].includes(tab)) {
      setActiveTab(tab);
    }

    if (!ref) return;

    const visitKey = `invite-opened:${ref}:${league || "unknown"}`;
    if (sessionStorage.getItem(visitKey)) return;
    sessionStorage.setItem(visitKey, "1");

    submitGrowthEvent({
      event: "invite_link_opened",
      payload: {
        ref,
        league: league || "unknown",
        tab: tab || "home",
      },
    }).catch((error) => {
      logger.warn("Failed to log invite open event:", error);
    });
  }, []);

  const updateGameState = useCallback((
    nextState: GameState | ((prevState: GameState) => GameState)
  ) => {
    setGameState((prevState) => {
      const resolvedState =
        typeof nextState === "function"
          ? (nextState as (prevState: GameState) => GameState)(prevState)
          : nextState;
      return normalizeGameState(resolvedState);
    });
  }, []);

  const normalizeUndefined = (value: any): any => {
    if (value === undefined) return null;
    if (Array.isArray(value)) return value.map(normalizeUndefined);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [key, normalizeUndefined(val)])
      );
    }
    return value;
  };

  const saveNow = useCallback(async () => {
    if (!isAdminAuthenticated || !adminSeasonReady) return;
    // Empty-league bootstrap stays in localStorage. Remote writes go to
    // season_states.
    if (!seasonShellEnabled) return;
    const scopedSeasonId = normalizeWeekId(activeSeasonId);
    if (!scopedSeasonId) {
      setLastWriteError("No active season selected.");
      return;
    }
    if (
      !canPersistSeasonState({
        activeSeasonId: scopedSeasonId,
        loadedSeasonId,
      })
    ) {
      setLastWriteError("Active season has not finished loading.");
      return;
    }
    // Any season fetch that overlaps this save may predate it.
    manualSaveInFlightRef.current += 1;
    adminEditRevisionRef.current += 1;
    try {
      const safeState = normalizeUndefined(gameState);
      const savedStandingsKey = standingsRefreshKey(gameState);
      const record = await saveSeasonState(scopedSeasonId, safeState as GameState);
      const updatedAt = record?.updated
        ? new Date(record.updated as string).getTime()
        : Date.now();
      setLastSavedAt(updatedAt);
      const commit = standingsSaveCommit({
        savedSeasonId: scopedSeasonId,
        activeSeasonId: activeSeasonIdRef.current,
        savedStandingsKey,
        currentStandingsKey: standingsKeyRef.current,
      });
      if (commit.recordSavedKey) {
        committedStandingsKeyRef.current = savedStandingsKey;
        if (commit.clearUnsaved) setUnsavedStandingsKey(null);
      }
      unsavedFailedWriteRef.current = false;
      setLastWriteError(null);
    } catch (error) {
      unsavedFailedWriteRef.current =
        JSON.stringify(gameState) !== lastRemoteStateRef.current;
      setLastWriteError(
        error instanceof Error ? error.message : String(error)
      );
      logger.warn("Manual save failed:", error);
    } finally {
      adminEditRevisionRef.current += 1;
      manualSaveInFlightRef.current -= 1;
    }
  }, [
    activeSeasonId,
    adminSeasonReady,
    gameState,
    isAdminAuthenticated,
    loadedSeasonId,
    seasonShellEnabled,
  ]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(redactPublicSeasonState(gameState))
    );
  }, [gameState]);

  useEffect(() => {
    const unsubscribe = onAdminAuthChange((result) => {
      const next = applyAdminSessionResult(result, {
        isAuthenticated: confirmedAdminUserIdRef.current !== null,
        authError: null,
        confirmedUserId: confirmedAdminUserIdRef.current,
      });
      // Preserve an in-flight sign-in error when the listener reports
      // not_admin (the form already owns that message). Query errors
      // always replace it.
      if (result.status === "query_error" || result.status === "admin") {
        setAdminAuthError(next.authError);
      }
      const wasAdmin = confirmedAdminUserIdRef.current !== null;
      if (!next.isAuthenticated || !wasAdmin) {
        setAdminSeasonReady(false);
      }
      confirmedAdminUserIdRef.current = next.confirmedUserId;
      setIsAdminAuthenticated(next.isAuthenticated);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  // Register the device for lock reminders. No-ops on the web, so this is safe
  // in the browser build; only the native shells reach the notification APIs.
  useEffect(() => {
    void registerForPush({ seasonId: activeSeasonId ?? gameState.seasonId ?? null });
  }, [activeSeasonId, gameState.seasonId]);

  useEffect(() => {
    void installPushDeepLinkHandler();
    const onRecap = (event: Event) => {
      const detail = (event as CustomEvent<RecapDeepLink>).detail;
      if (!detail?.weekId) return;
      setRecapDeepLink(detail);
    };
    window.addEventListener(RECAP_DEEP_LINK_EVENT, onRecap);
    return () => window.removeEventListener(RECAP_DEEP_LINK_EVENT, onRecap);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadShowConfig = async () => {
      try {
        const config = await fetchShowConfig();
        if (!config || cancelled) return;
        setAuthoritativeShowConfig(config);
        setGameState((prev) => {
          const next = normalizeGameState({
            ...prev,
            showConfig: config,
          });
          return next;
        });
      } catch (error) {
        logger.warn("Failed to load show config:", error);
      }
    };
    void loadShowConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSeasons = async () => {
      try {
        const records = await listSeasons();
        if (cancelled) return;
        if (!Array.isArray(records) || records.length === 0) {
          setSeasons([]);
          setSeasonShellEnabled(false);
          return;
        }
        setSeasonShellEnabled(true);
        setSeasons(records);
        const stored = normalizeWeekId(localStorage.getItem("traitors_active_season"));
        const preferred = pickPreferredSeason(records, stored);
        setActiveSeasonId(preferred?.seasonId || null);
      } catch (error) {
        logger.warn("Failed to load seasons:", error);
      }
    };
    void loadSeasons();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLoadedSeasonId(null);
    appliedBoardKeyRef.current = null;
  }, [activeSeasonId]);

  useEffect(() => {
    if (!seasonShellEnabled) return;
    const seasonId = normalizeWeekId(activeSeasonId);
    if (!seasonId) return;
    localStorage.setItem("traitors_active_season", seasonId);
    let cancelled = false;
    const boardKey = seasonBoardKey(seasonId, isAdminAuthenticated);
    const loadSeasonState = async () => {
      const fetchSeq = ++seasonFetchSeqRef.current;
      const editRevisionAtFetchStart = adminEditRevisionRef.current;
      // Only the first admin load of this board gates autosave. Flipping it on
      // a broadcast echo would cancel the pending 500ms save.
      if (
        shouldResetAdminSeasonReady({
          isAdminAuthenticated,
          appliedBoardKey: appliedBoardKeyRef.current,
          requestBoardKey: boardKey,
        })
      ) {
        setAdminSeasonReady(false);
      }
      const refreshDecision = () =>
        decideAdminSeasonRefresh({
          isAdminAuthenticated,
          appliedBoardKey: appliedBoardKeyRef.current,
          requestBoardKey: boardKey,
          isLatestFetch: fetchSeq === seasonFetchSeqRef.current,
          hasDebouncedSave: writeTimerRef.current !== null,
          hasPendingWrite:
            pendingWriteRef.current !== null ||
            manualSaveInFlightRef.current > 0,
          hasUnsavedFailedWrite: unsavedFailedWriteRef.current,
          editRevisionAtFetchStart,
          editRevisionNow: adminEditRevisionRef.current,
        });
      const commitRemoteState = (nextState: GameState) => {
        const decision = refreshDecision();
        if (decision.applyRemote) {
          lastRemoteStateRef.current = JSON.stringify(nextState);
          unsavedFailedWriteRef.current = false;
          committedStandingsKeyRef.current = standingsRefreshKey(nextState);
          setUnsavedStandingsKey(null);
          setGameState(nextState);
          appliedBoardKeyRef.current = boardKey;
          setLoadedSeasonId(seasonId);
        }
        if (decision.markAdminReady && isAdminAuthenticated) setAdminSeasonReady(true);
      };
      try {
        const seasonState = isAdminAuthenticated
          ? await fetchAdminSeasonState(seasonId)
          : await fetchSeasonState(seasonId);
        if (cancelled) return;
        const seasonMeta =
          seasons.find((season) => season.seasonId === seasonId) ||
          (seasonState?.seasonConfig
            ? sanitizeSeasonConfig(seasonState.seasonConfig, seasonId)
            : undefined);
        if (!seasonState) {
          if (!seasonMeta) {
            if (refreshDecision().applyRemote) lastRemoteStateRef.current = null;
            return;
          }
          // Do not keep the previous season's board (or localStorage) on
          // screen under this season's chip — that is the Home mismatch.
          const empty = normalizeGameState(
            isolateSeasonGameplay({ players: [] }, seasonMeta, rosterForSeason(seasonId))
          );
          commitRemoteState(
            isAdminAuthenticated ? empty : redactPublicSeasonState(empty)
          );
          return;
        }
        const roster = rosterForSeason(
          seasonId,
          Object.keys(seasonState.castStatus || {})
        );
        const applied = seasonMeta
          ? isolateSeasonGameplay({ ...seasonState, seasonId }, seasonMeta, roster)
          : { ...seasonState, seasonId };
        const normalized = normalizeGameState(applied);
        commitRemoteState(
          isAdminAuthenticated ? normalized : redactPublicSeasonState(normalized)
        );
      } catch (error) {
        logger.warn("Failed to load season state:", error);
      }
    };
    void loadSeasonState();
    const unsubscribeSeasonState = subscribeToSeasonState(seasonId, () => {
      if (cancelled) return;
      void loadSeasonState();
      // seasons.status and lock_schedule are not inside season_states.
      // Skip the write when the list is unchanged so this effect does not
      // resubscribe on every board save. An empty result is left to the
      // 45s poll: listSeasons returns [] on failure.
      void (async () => {
        try {
          const records = await listSeasons();
          if (cancelled || !Array.isArray(records) || records.length === 0) return;
          setSeasons((current) =>
            JSON.stringify(current) === JSON.stringify(records) ? current : records
          );
        } catch (error) {
          logger.warn("Failed to refresh seasons:", error);
        }
      })();
    });
    return () => {
      cancelled = true;
      unsubscribeSeasonState();
    };
  }, [activeSeasonId, isAdminAuthenticated, seasonShellEnabled, seasons]);

  useEffect(() => {
    if (!seasonShellEnabled || seasons.length === 0) return;
    if (
      activeSeasonId &&
      seasons.some((season) => season.seasonId === activeSeasonId)
    ) {
      return;
    }
    const preferred = pickPreferredSeason(seasons, null);
    setActiveSeasonId(preferred?.seasonId || null);
  }, [activeSeasonId, seasonShellEnabled, seasons]);

  useEffect(() => {
    if (!seasonShellEnabled) return;
    let cancelled = false;
    const refreshSeasons = async () => {
      try {
        const records = await listSeasons();
        if (cancelled || !Array.isArray(records)) return;
        setSeasons(records);
      } catch (error) {
        logger.warn("Failed to refresh seasons:", error);
      }
    };
    void refreshSeasons();
    const intervalId = window.setInterval(refreshSeasons, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [seasonShellEnabled]);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      setPendingSubmissions(null);
      return;
    }
    let cancelled = false;

    const loadPendingSubmissions = async () => {
      try {
        const scopedSeasonId = seasonShellEnabled
          ? normalizeWeekId(activeSeasonId ?? gameState.seasonId)
          : null;
        const records = await fetchWeeklySubmissions({ seasonId: scopedSeasonId });
        if (cancelled) return;
        setPendingSubmissions(records.length);
      } catch (error) {
        if (cancelled) return;
        logger.warn("Failed to load pending submissions:", error);
        setPendingSubmissions(null);
      }
    };

    loadPendingSubmissions();
    const intervalId = window.setInterval(loadPendingSubmissions, 45000);
    const unsubscribeSubmissions = subscribeToAdminSubmissions(() => {
      if (!cancelled) void loadPendingSubmissions();
    });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      unsubscribeSubmissions();
    };
  }, [activeSeasonId, gameState.seasonId, isAdminAuthenticated, seasonShellEnabled]);

  // Several loaders write the whole game state, and each source embeds its own
  // copy of showConfig — the game snapshot, the season snapshot, local storage.
  // Whichever lands last would otherwise decide the app's branding, and the
  // stale ones are months old. Reconcile centrally instead of patching each
  // writer: show_configs is the authority, so re-assert it whenever what is on
  // screen has drifted from it. Compared by value, so this settles in one pass.
  useEffect(() => {
    if (!authoritativeShowConfig) return;
    if (
      JSON.stringify(gameState.showConfig) === JSON.stringify(authoritativeShowConfig)
    ) {
      return;
    }
    setGameState((prev) =>
      normalizeGameState({ ...prev, showConfig: authoritativeShowConfig })
    );
  }, [authoritativeShowConfig, gameState.showConfig]);

  useEffect(() => {
    if (!isAdminAuthenticated || !adminSeasonReady || !seasonShellEnabled) return undefined;
    const scopedSeasonId = normalizeWeekId(activeSeasonId);
    if (!scopedSeasonId) return undefined;
    if (
      !canPersistSeasonState({
        activeSeasonId: scopedSeasonId,
        loadedSeasonId,
      })
    ) {
      return undefined;
    }
    if (writeTimerRef.current !== null) {
      window.clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
    }
    const serialized = JSON.stringify(gameState);
    if (
      serialized === lastRemoteStateRef.current ||
      serialized === pendingWriteRef.current
    ) {
      return () => undefined;
    }
    // A local edit is waiting to save. Any season fetch already out may
    // predate it, so it must not replace the board when it lands.
    adminEditRevisionRef.current += 1;
    // writeTimerRef doubles as "a debounced save is pending", so it is nulled
    // whenever the timer fires or is cleared.
    writeTimerRef.current = window.setTimeout(() => {
      writeTimerRef.current = null;
      pendingWriteRef.current = serialized;
      adminEditRevisionRef.current += 1;
      const safeState = normalizeUndefined(gameState);
      const savedStandingsKey = standingsRefreshKey(gameState);
      saveSeasonState(scopedSeasonId, safeState as GameState)
        .then((record) => {
          lastRemoteStateRef.current = serialized;
          unsavedFailedWriteRef.current = false;
          // A newer save may have started while this one was in flight.
          if (pendingWriteRef.current === serialized) pendingWriteRef.current = null;
          adminEditRevisionRef.current += 1;
          // The timer closed over the season it saved. The screen may have
          // moved to another season before this write finished.
          const commit = standingsSaveCommit({
            savedSeasonId: scopedSeasonId,
            activeSeasonId: activeSeasonIdRef.current,
            savedStandingsKey,
            currentStandingsKey: standingsKeyRef.current,
          });
          if (commit.recordSavedKey) {
            committedStandingsKeyRef.current = savedStandingsKey;
            if (commit.clearUnsaved) setUnsavedStandingsKey(null);
          }
          const updatedAt = record?.updated
            ? new Date(record.updated as string).getTime()
            : Date.now();
          setLastSavedAt(updatedAt);
          setLastWriteError(null);
        })
        .catch((error) => {
          if (pendingWriteRef.current === serialized) pendingWriteRef.current = null;
          adminEditRevisionRef.current += 1;
          unsavedFailedWriteRef.current = serialized !== lastRemoteStateRef.current;
          setLastWriteError(
            error instanceof Error ? error.message : String(error)
          );
          logger.warn("Supabase write failed:", error);
        });
    }, TIMING.SAVE_DEBOUNCE_MS);
    return () => {
      if (writeTimerRef.current !== null) {
        window.clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
    };
  }, [
    activeSeasonId,
    adminSeasonReady,
    gameState,
    isAdminAuthenticated,
    loadedSeasonId,
    seasonShellEnabled,
  ]);

  useEffect(() => {
    let isMounted = true;
    const hydratePortraits = async () => {
      try {
        const portraits = await fetchPlayerPortraits();
        if (!isMounted || Object.keys(portraits).length === 0) return;
        setGameState((prev) => {
          const updatedPlayers = prev.players.map((player) => {
            const key = publicPortraitKey(player.name || "");
            const portraitUrl = key ? portraits[key] : undefined;
            return portraitUrl ? { ...player, portraitUrl } : player;
          });
          return { ...prev, players: updatedPlayers };
        });
      } catch (err) {
        logger.error("Failed to load player portraits:", err);
      }
    };
    hydratePortraits();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddEntry = useCallback((entry: PlayerEntry) => {
    const activeWeekId = inferActiveWeekId(gameState);
    const normalizedWeeklyPredictions = entry.weeklyPredictions
      ? {
          ...entry.weeklyPredictions,
          weekId:
            normalizeWeekId(entry.weeklyPredictions.weekId) ?? activeWeekId,
        }
      : undefined;
    const normalizedEmail = normalizeEmail(entry.email || "");
    const updatedPlayers = [
      ...gameState.players.filter((p) => {
        if (entry.id) return p.id !== entry.id;
        if (normalizedEmail) {
          return normalizeEmail(p.email || "") !== normalizedEmail;
        }
        return p.name !== entry.name;
      }),
      {
        ...entry,
        weeklyPredictions: normalizedWeeklyPredictions,
        league: (entry.league === "jr" ? "jr" : "main") as League,
      },
    ];
    updateGameState({ ...gameState, players: updatedPlayers });
  }, [gameState, updateGameState]);

  const authenticateAdmin = useCallback(async (
    email: string,
    password: string
  ): Promise<boolean> => {
    setAdminAuthPending(true);
    setAdminAuthError(null);
    try {
      const success = await signInAdmin(email, password);
      if (success) setIsAdminAuthenticated(true);
      return success;
    } catch (error) {
      const message = adminAuthErrorMessage(error);
      setAdminAuthError(message);
      logger.warn("Admin sign-in failed:", error);
      return false;
    } finally {
      setAdminAuthPending(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    signOutAdmin();
  }, []);

  const handleSeasonChange = useCallback((seasonId: string) => {
    setActiveSeasonId(seasonId);
  }, []);

  const scoreHistory = Array.isArray(gameState.weeklyScoreHistory)
    ? gameState.weeklyScoreHistory
    : [];

  const standingsKey = useMemo(() => standingsRefreshKey(gameState), [gameState]);
  useLayoutEffect(() => {
    standingsKeyRef.current = standingsKey;
  }, [standingsKey]);
  // During render so the published-standings hook never starts a fetch for an
  // admin edit that is still inside the autosave debounce.
  if (
    isAdminAuthenticated &&
    adminSeasonReady &&
    committedStandingsKeyRef.current !== null &&
    standingsKey !== committedStandingsKeyRef.current &&
    unsavedStandingsKey !== standingsKey
  ) {
    setUnsavedStandingsKey(standingsKey);
  }

  const publishedStandings = usePublishedStandings(
    gameState,
    lastSavedAt,
    unsavedStandingsKey
  );
  const { mvp: overallMvp, finalStandings } = useMemo(() => {
    const published = usablePublishedStandings(publishedStandings, gameState);
    return published
      ? homeBoardFromStandings(gameState, published)
      : homeStandingsBoard(gameState);
  }, [gameState, publishedStandings]);

  const seasonFinalized = useMemo(
    () => isFinaleResultsCertified(gameState),
    [gameState]
  );

  // Same resolver the Draft tab gates on, so the Home countdown and the
  // submit button can never disagree about when the draft locks.
  const homeCountdown = useMemo(
    () =>
      resolveHomeCountdown({
        finaleConfig: gameState.finaleConfig,
        finaleLabel:
          gameState.finaleConfig?.label?.trim() ||
          gameState.showConfig?.terminology?.finaleLabelDefault ||
          "Finale Gauntlet",
        draftWindow: resolveDraftWindow(gameState, {
          forceClosed: readForceClosedFromEnv(),
        }),
        draftLabel: gameState.showConfig?.terminology?.draftLabel || "Draft",
        lockSchedule: gameState.seasonConfig?.lockSchedule,
      }),
    [gameState]
  );

  const publishedMovement = useMemo(
    () =>
      homeWeekMovement(
        gameState,
        usablePublishedStandings(publishedStandings, gameState)
      ),
    [gameState, publishedStandings]
  );

  const weeklyMvp = useMemo(() => {
    if (publishedMovement) {
      const best = publishedMovement[0];
      if (!best) return null;
      const last = scoreHistory[scoreHistory.length - 1];
      return {
        name: best.name,
        score: best.delta,
        portraitUrl: best.portraitUrl,
        label: last?.label || "Weekly MVP",
        delta: best.delta,
      };
    }
    if (scoreHistory.length === 0) return null;
    const last = scoreHistory[scoreHistory.length - 1];
    const prev = scoreHistory.length > 1 ? scoreHistory[scoreHistory.length - 2] : null;
    let best: { id: string; delta: number } | null = null;
    Object.entries(last.totals || {}).forEach(([id, total]) => {
      const previous = prev?.totals?.[id] ?? 0;
      const delta = Number(total) - Number(previous);
      if (!best || delta > best.delta) {
        best = { id, delta };
      }
    });
    if (!best) return null;
    const player = gameState.players.find((p) => p.id === best!.id);
    if (!player) return null;
    return {
      name: player.name,
      score: best.delta,
      portraitUrl: player.portraitUrl,
      label: last.label || "Weekly MVP",
      delta: best.delta,
    };
  }, [gameState, publishedMovement, scoreHistory]);

  const topMovers = useMemo<TopMoverEntry[]>(() => {
    if (publishedMovement) {
      return publishedMovement.slice(0, 3).map((entry) => ({
        name: entry.name,
        delta: entry.delta,
        league: entry.league,
      }));
    }
    if (scoreHistory.length < 2) return [];

    const last = scoreHistory[scoreHistory.length - 1];
    const prev = scoreHistory[scoreHistory.length - 2];

    return gameState.players
      .map((player) => {
        const lastScore = last.totals?.[player.id];
        const prevScore = prev.totals?.[player.id];
        if (typeof lastScore !== "number" || typeof prevScore !== "number") return null;
        return {
          name: player.name,
          delta: Number(lastScore) - Number(prevScore),
          league: player.league === "jr" ? "jr" : "main",
        } satisfies TopMoverEntry;
      })
      .filter((entry): entry is TopMoverEntry => Boolean(entry))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3);
  }, [gameState.players, publishedMovement, scoreHistory]);

  const leaguePulse = useMemo<LeaguePulseOverview>(() => {
    const latestArchive = scoreHistory[scoreHistory.length - 1];
    const castNames = Object.keys(gameState.castStatus || {});
    return {
      entries: gameState.players.length,
      activeCastCount: castNames.filter((name) => !gameState.castStatus[name]?.isEliminated).length,
      latestArchiveLabel: latestArchive?.label || "No archives yet",
      pendingSubmissions,
    };
  }, [gameState.castStatus, gameState.players.length, pendingSubmissions, scoreHistory]);

  const actionQueue = useMemo(() => {
    const queue: string[] = [];
    if (gameState.players.length === 0) {
      queue.push("Be the first friend to lock a draft board and set the early pace.");
    }
    if (typeof pendingSubmissions === "number" && pendingSubmissions > 0) {
      queue.push(
        `${pendingSubmissions} friend${pendingSubmissions === 1 ? "" : "s"} already submitted this week. Counter before lock.`
      );
    }
    if (!gameState.weeklyResults?.nextBanished && !gameState.weeklyResults?.nextMurdered) {
      queue.push("Results are not posted yet, so this is your window to make a bold weekly call.");
    }
    if (scoreHistory.length === 0) {
      queue.push("First leaderboard swing lands after the initial weekly archive.");
    }
    if (queue.length === 0) {
      queue.push("You are set. Watch rival movement and prep your next Round Table picks.");
    }
    return queue.slice(0, 4);
  }, [gameState.players.length, gameState.weeklyResults, pendingSubmissions, scoreHistory.length]);

  const content = useMemo(() => {
    switch (activeTab) {
      case "home":
        return (
          <Welcome
            onStart={() =>
              setActiveTab(seasonFinalized ? "leaderboard" : "weekly")
            }
            mvp={overallMvp}
            weeklyMvp={weeklyMvp}
            leaguePulse={leaguePulse}
            topMovers={topMovers}
            actionQueue={actionQueue}
            finaleConfig={gameState.finaleConfig}
            homeCountdown={homeCountdown}
            seasonFinalized={seasonFinalized}
            finalStandings={finalStandings}
            showConfig={gameState.showConfig}
            seasons={seasons}
            activeSeasonId={activeSeasonId || gameState.seasonId}
            onSeasonChange={handleSeasonChange}
          />
        );
      case "draft":
        return (
          <DraftForm
            gameState={gameState}
            onAddEntry={handleAddEntry}
          />
        );
      case "rules":
        return <RulesGuide gameState={gameState} />;
      case "weekly":
        return (
          <WeeklyCouncil
            gameState={gameState}
            onAddEntry={handleAddEntry}
            showConfig={gameState.showConfig}
          />
        );
      case "leaderboard":
        return (
          <Leaderboard
            gameState={gameState}
            seasons={seasons}
            activeSeasonId={activeSeasonId || gameState.seasonId}
            onSeasonChange={handleSeasonChange}
            publishedStandings={publishedStandings}
          />
        );
      case "admin":
        // Keep AdminAuth mounted until sign-in settles so a remount cannot
        // swallow "Not an admin user" (or a membership query failure).
        return isAdminAuthenticated && !adminAuthPending ? (
          <AdminPanel
            gameState={gameState}
            updateGameState={updateGameState}
            onSignOut={handleSignOut}
            lastSavedAt={lastSavedAt}
            lastWriteError={lastWriteError}
            onSaveNow={saveNow}
            showConfig={gameState.showConfig}
            seasonConfig={gameState.seasonConfig}
            seasons={seasons}
            activeSeasonId={activeSeasonId || gameState.seasonId}
            onSeasonChange={handleSeasonChange}
          />
        ) : (
          <AdminAuth
            onAuthenticate={authenticateAdmin}
            authError={adminAuthError}
          />
        );
      default:
        return (
          <Welcome
            onStart={() =>
              setActiveTab(seasonFinalized ? "leaderboard" : "weekly")
            }
            mvp={overallMvp}
            weeklyMvp={weeklyMvp}
            leaguePulse={leaguePulse}
            topMovers={topMovers}
            actionQueue={actionQueue}
            finaleConfig={gameState.finaleConfig}
            homeCountdown={homeCountdown}
            seasonFinalized={seasonFinalized}
            finalStandings={finalStandings}
            showConfig={gameState.showConfig}
            seasons={seasons}
            activeSeasonId={activeSeasonId || gameState.seasonId}
            onSeasonChange={handleSeasonChange}
          />
        );
    }
  }, [
    activeTab,
    actionQueue,
    leaguePulse,
    gameState,
    handleAddEntry,
    adminAuthError,
    adminAuthPending,
    authenticateAdmin,
    handleSignOut,
    isAdminAuthenticated,
    lastSavedAt,
    lastWriteError,
    overallMvp,
    saveNow,
    seasonFinalized,
    homeCountdown,
    finalStandings,
    handleSeasonChange,
    topMovers,
    updateGameState,
    seasons,
    activeSeasonId,
    weeklyMvp,
    publishedStandings,
  ]);

  if (recapDeepLink) {
    return (
      <ToastProvider>
        <InAppRecap
          gameState={gameState}
          link={recapDeepLink}
          loadedSeasonId={activeSeasonId || gameState.seasonId || null}
          publishedStandings={publishedStandings}
          onClose={() => setRecapDeepLink(null)}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lastSync={lastSavedAt ?? undefined}
        showConfig={gameState.showConfig}
        isAdminAuthenticated={isAdminAuthenticated}
      >
        {content}
      </Layout>
    </ToastProvider>
  );
};

export default App;
