import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "./components/Layout";
import Welcome, {
  type FinalStandingEntry,
  type LeaguePulseOverview,
  type TopMoverEntry,
} from "./components/Welcome";
import DraftForm from "./components/DraftForm";
import WeeklyCouncil from "./components/WeeklyCouncil";
import AdminPanel from "./components/AdminPanel";
import Leaderboard from "./components/Leaderboard";
import AdminAuth from "./components/AdminAuth";
import { ToastProvider } from "./components/Toast";
import {
  CastMemberStatus,
  CAST_NAMES,
  GameState,
  inferActiveWeekId,
  normalizeWeekId,
  PlayerEntry,
  ScoreAdjustment,
  SeasonConfig,
  ShowConfig,
  UiVariant,
  WeeklySubmissionHistoryEntry,
  WeeklyScoreSnapshot,
} from "./types";
import { calculatePlayerScore, getFinaleTieBreakDistance } from "./src/utils/scoring";
import { TIMING } from "./src/utils/scoringConstants";
import { DEFAULT_SHOW_CONFIG } from "./src/config/defaultShowConfig";
import { sanitizeSeasonConfig, sanitizeShowConfig } from "./src/config/validation";
import { logger } from "./src/utils/logger";
import {
  fetchShowConfig,
  fetchSeasonState,
  fetchGameState,
  listSeasons,
  listScoreAdjustments,
  fetchPlayerPortraits,
  normalizeEmail,
  onAdminAuthChange,
  saveGameState,
  saveSeasonState,
  signInAdmin,
  signOutAdmin,
  submitGrowthEvent,
  subscribeToGameState,
  fetchWeeklySubmissions,
} from "./services/pocketbase";

const STORAGE_KEY = "traitors_db_v4";
const buildDefaultFinaleLockAt = () =>
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const DEFAULT_FINALE_CONFIG = {
  enabled: false,
  label: "Finale Gauntlet",
  lockAt: buildDefaultFinaleLockAt(),
};
const DEFAULT_WEEKLY_RESULTS = {
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
    finalPotValue: null as number | null,
  },
};

const normalizeFinaleConfig = (
  input?: GameState["finaleConfig"] | null
): GameState["finaleConfig"] => ({
  enabled: Boolean(input?.enabled),
  label:
    typeof input?.label === "string" && input.label.trim()
      ? input.label
      : DEFAULT_FINALE_CONFIG.label,
  lockAt:
    typeof input?.lockAt === "string" && input.lockAt.trim()
      ? input.lockAt
      : DEFAULT_FINALE_CONFIG.lockAt,
});

const normalizeWeeklyResults = (
  input?: GameState["weeklyResults"] | null,
  fallbackWeekId?: string
): GameState["weeklyResults"] => {
  const bonusGames = input?.bonusGames ?? DEFAULT_WEEKLY_RESULTS.bonusGames;
  const finaleResults =
    input?.finaleResults ?? DEFAULT_WEEKLY_RESULTS.finaleResults;
  return {
    weekId: normalizeWeekId(input?.weekId) ?? normalizeWeekId(fallbackWeekId) ?? undefined,
    nextBanished: input?.nextBanished ?? DEFAULT_WEEKLY_RESULTS.nextBanished,
    nextMurdered: input?.nextMurdered ?? DEFAULT_WEEKLY_RESULTS.nextMurdered,
    bonusGames: {
      redemptionRoulette:
        bonusGames.redemptionRoulette ??
        DEFAULT_WEEKLY_RESULTS.bonusGames.redemptionRoulette,
      shieldGambit:
        bonusGames.shieldGambit ??
        DEFAULT_WEEKLY_RESULTS.bonusGames.shieldGambit,
      traitorTrio: Array.isArray(bonusGames.traitorTrio)
        ? bonusGames.traitorTrio
        : DEFAULT_WEEKLY_RESULTS.bonusGames.traitorTrio,
    },
    finaleResults: {
      finalWinner: finaleResults.finalWinner ?? DEFAULT_WEEKLY_RESULTS.finaleResults.finalWinner,
      lastFaithfulStanding:
        finaleResults.lastFaithfulStanding ??
        DEFAULT_WEEKLY_RESULTS.finaleResults.lastFaithfulStanding,
      lastTraitorStanding:
        finaleResults.lastTraitorStanding ??
        DEFAULT_WEEKLY_RESULTS.finaleResults.lastTraitorStanding,
      finalPotValue:
        typeof finaleResults.finalPotValue === "number" &&
        Number.isFinite(finaleResults.finalPotValue)
          ? finaleResults.finalPotValue
          : DEFAULT_WEEKLY_RESULTS.finaleResults.finalPotValue,
    },
  };
};

const normalizeGameState = (input?: Partial<GameState> | null): GameState => {
  const weeklyScoreHistory = Array.isArray(input?.weeklyScoreHistory)
    ? (input!.weeklyScoreHistory as WeeklyScoreSnapshot[])
    : [];
  const activeWeekId = inferActiveWeekId({
    activeWeekId: input?.activeWeekId,
    weeklyScoreHistory,
  });

  const showConfig: ShowConfig = sanitizeShowConfig(input?.showConfig ?? DEFAULT_SHOW_CONFIG);
  const seasonConfig: SeasonConfig = sanitizeSeasonConfig(
    input?.seasonConfig ?? null,
    typeof input?.seasonId === "string" && input.seasonId.trim()
      ? input.seasonId
      : "season-1"
  );
  const castStatus: GameState["castStatus"] = {};
  const incomingCast: Record<string, Partial<CastMemberStatus>> =
    input?.castStatus ?? {};
  const castNames = Array.from(
    new Set([
      ...showConfig.castNames,
      ...CAST_NAMES,
      ...Object.keys(incomingCast),
    ])
  ).sort((a, b) => a.localeCompare(b));

  castNames.forEach((name) => {
    const current = incomingCast[name] ?? {};
    castStatus[name] = {
      isWinner: Boolean(current.isWinner),
      isFirstOut: Boolean(current.isFirstOut),
      isTraitor: Boolean(current.isTraitor),
      isEliminated: Boolean(current.isEliminated),
      portraitUrl:
        typeof current.portraitUrl === "string" && current.portraitUrl.trim()
          ? current.portraitUrl
          : null,
    };
  });

  const players = Array.isArray(input?.players) ? input!.players : [];
  const normalizedPlayers = players.map((player, index) => {
    const safeName = typeof player.name === "string" ? player.name : "";
    const safeEmail = typeof player.email === "string" ? player.email : "";
    const legacyPlayer = player as PlayerEntry & {
      finalePredictions?: {
        finalWinner?: string;
        lastFaithfulStanding?: string;
        lastTraitorStanding?: string;
        finalPotEstimate?: number | null;
      };
    };
    const legacyFinale = legacyPlayer.finalePredictions;
    const fallbackIdSeed =
      normalizeEmail(safeEmail) ||
      safeName.trim().toLowerCase().replace(/\s+/g, "-");
    const safeId =
      typeof player.id === "string" && player.id.trim()
        ? player.id
        : fallbackIdSeed || `player-${index + 1}`;

    return {
      ...player,
      id: safeId,
      name: safeName,
      email: safeEmail,
      league: player.league === "jr" ? "jr" : "main",
      picks: Array.isArray(player.picks) ? player.picks : [],
      predTraitors: Array.isArray(player.predTraitors)
        ? player.predTraitors
        : [],
      weeklyPredictions: {
        weekId: normalizeWeekId(player.weeklyPredictions?.weekId) ?? undefined,
        nextBanished: player.weeklyPredictions?.nextBanished ?? "",
        nextMurdered: player.weeklyPredictions?.nextMurdered ?? "",
        bonusGames: {
          redemptionRoulette:
            player.weeklyPredictions?.bonusGames?.redemptionRoulette ?? "",
          doubleOrNothing: Boolean(
            player.weeklyPredictions?.bonusGames?.doubleOrNothing
          ),
          shieldGambit: player.weeklyPredictions?.bonusGames?.shieldGambit ?? "",
          traitorTrio:
            player.weeklyPredictions?.bonusGames?.traitorTrio ?? [],
        },
        finalePredictions: {
          finalWinner:
            player.weeklyPredictions?.finalePredictions?.finalWinner ??
            legacyFinale?.finalWinner ??
            "",
          lastFaithfulStanding:
            player.weeklyPredictions?.finalePredictions?.lastFaithfulStanding ??
            legacyFinale?.lastFaithfulStanding ??
            "",
          lastTraitorStanding:
            player.weeklyPredictions?.finalePredictions?.lastTraitorStanding ??
            legacyFinale?.lastTraitorStanding ??
            "",
          finalPotEstimate:
            typeof player.weeklyPredictions?.finalePredictions?.finalPotEstimate ===
              "number" &&
            Number.isFinite(player.weeklyPredictions?.finalePredictions?.finalPotEstimate)
              ? player.weeklyPredictions?.finalePredictions?.finalPotEstimate
              : typeof legacyFinale?.finalPotEstimate === "number" &&
                Number.isFinite(legacyFinale?.finalPotEstimate)
              ? legacyFinale.finalPotEstimate
              : null,
        },
      },
    } as PlayerEntry;
  });

  const history = Array.isArray(input?.weeklySubmissionHistory)
    ? (input!.weeklySubmissionHistory as WeeklySubmissionHistoryEntry[])
    : [];
  const scoreAdjustments = Array.isArray(input?.scoreAdjustments)
    ? (input!.scoreAdjustments as ScoreAdjustment[])
        .filter(
          (adjustment) =>
            adjustment &&
            typeof adjustment.id === "string" &&
            typeof adjustment.playerId === "string" &&
            typeof adjustment.seasonId === "string" &&
            typeof adjustment.reason === "string" &&
            typeof adjustment.points === "number"
        )
        .map((adjustment) => ({
          ...adjustment,
          weekId: normalizeWeekId(adjustment.weekId) ?? undefined,
          createdBy: adjustment.createdBy || "admin",
          createdAt: adjustment.createdAt || new Date().toISOString(),
        }))
    : [];
  const seasonId =
    normalizeWeekId(input?.seasonId) ??
    normalizeWeekId(seasonConfig.seasonId) ??
    "season-1";
  const rulePackId =
    normalizeWeekId(input?.rulePackId) ??
    normalizeWeekId(seasonConfig.rulePackId) ??
    "traitors-classic";

  return {
    seasonId,
    rulePackId,
    activeWeekId,
    players: normalizedPlayers,
    castStatus,
    showConfig,
    seasonConfig: {
      ...seasonConfig,
      seasonId,
      activeWeekId: normalizeWeekId(seasonConfig.activeWeekId) ?? activeWeekId,
      rulePackId,
    },
    finaleConfig: normalizeFinaleConfig(input?.finaleConfig),
    scoreAdjustments,
    weeklyResults: normalizeWeeklyResults(input?.weeklyResults, activeWeekId),
    weeklySubmissionHistory: history,
    weeklyScoreHistory,
  };
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [uiVariant, setUiVariant] = useState<UiVariant>("premium");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [lastWriteError, setLastWriteError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<SeasonConfig[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [seasonShellEnabled, setSeasonShellEnabled] = useState(false);
  const lastRemoteStateRef = useRef<string | null>(null);
  const pendingWriteRef = useRef<string | null>(null);
  const writeTimerRef = useRef<number | null>(null);
  const hasRemoteSnapshotRef = useRef(false);
  const remoteExistsRef = useRef<boolean | null>(null);

  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalizeGameState(JSON.parse(saved));
    } catch {
      // ignore corrupted localStorage
    }

    return normalizeGameState({ players: [] });
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ui = params.get("ui");
    const tab = params.get("tab");
    const ref = params.get("ref");
    const league = params.get("league");

    if (ui === "classic") {
      setUiVariant("classic");
    } else if (ui === "premium" || ui === "sora") {
      setUiVariant("premium");
    } else {
      setUiVariant("premium");
    }

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
    if (!isAdminAuthenticated) return;
    const scopedSeasonId = normalizeWeekId(activeSeasonId);
    if (seasonShellEnabled && !scopedSeasonId) {
      setLastWriteError("No active season selected.");
      return;
    }
    try {
      const safeState = normalizeUndefined(gameState);
      const record =
        seasonShellEnabled && scopedSeasonId
          ? await saveSeasonState(
              scopedSeasonId,
              safeState as GameState
            )
          : await saveGameState(safeState as GameState);
      const updatedAt = record?.updated
        ? new Date(record.updated as string).getTime()
        : Date.now();
      setLastSavedAt(updatedAt);
      setLastWriteError(null);
    } catch (error) {
      setLastWriteError(
        error instanceof Error ? error.message : String(error)
      );
      logger.warn("Manual save failed:", error);
    }
  }, [activeSeasonId, gameState, isAdminAuthenticated, seasonShellEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  useEffect(() => {
    const unsubscribe = onAdminAuthChange((isAuthed) => {
      setIsAdminAuthenticated(isAuthed);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadShowConfig = async () => {
      try {
        const config = await fetchShowConfig();
        if (!config || cancelled) return;
        setUiVariant(config.defaultUiVariant || "premium");
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
        const preferred =
          records.find((season) => season.seasonId === stored) ??
          records.find((season) => season.status !== "archived") ??
          records[0];
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
    if (!seasonShellEnabled) return;
    const seasonId = normalizeWeekId(activeSeasonId);
    if (!seasonId) return;
    localStorage.setItem("traitors_active_season", seasonId);
    let cancelled = false;
    const loadSeasonState = async () => {
      try {
        const seasonState = await fetchSeasonState(seasonId);
        if (cancelled) return;
        if (!seasonState) {
          hasRemoteSnapshotRef.current = true;
          remoteExistsRef.current = false;
          lastRemoteStateRef.current = null;
          return;
        }
        const serialized = JSON.stringify(seasonState);
        hasRemoteSnapshotRef.current = true;
        remoteExistsRef.current = true;
        lastRemoteStateRef.current = serialized;
        const seasonMeta =
          seasons.find((season) => season.seasonId === seasonId) || undefined;
        setGameState(
          normalizeGameState({
            ...seasonState,
            seasonId,
            seasonConfig: seasonMeta ?? seasonState.seasonConfig,
          })
        );
      } catch (error) {
        logger.warn("Failed to load season state:", error);
      }
    };
    void loadSeasonState();
    return () => {
      cancelled = true;
    };
  }, [activeSeasonId, seasonShellEnabled, seasons]);

  useEffect(() => {
    if (!seasonShellEnabled || seasons.length === 0) return;
    if (
      activeSeasonId &&
      seasons.some((season) => season.seasonId === activeSeasonId)
    ) {
      return;
    }
    const preferred =
      seasons.find((season) => season.status !== "archived") ?? seasons[0];
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
    const seasonId =
      normalizeWeekId(gameState.seasonId) ??
      normalizeWeekId(gameState.seasonConfig?.seasonId);
    if (!seasonId) return;
    let cancelled = false;
    const syncAdjustments = async () => {
      try {
        const records = await listScoreAdjustments(seasonId);
        if (cancelled || !Array.isArray(records)) return;
        setGameState((prev) => {
          const previous = Array.isArray(prev.scoreAdjustments)
            ? prev.scoreAdjustments
            : [];
          if (JSON.stringify(previous) === JSON.stringify(records)) return prev;
          return normalizeGameState({
            ...prev,
            scoreAdjustments: records,
          });
        });
      } catch (error) {
        logger.warn("Failed to sync score adjustments:", error);
      }
    };
    void syncAdjustments();
    return () => {
      cancelled = true;
    };
  }, [gameState.seasonConfig?.seasonId, gameState.seasonId]);

  useEffect(() => {
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

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeSeasonId, gameState.seasonId, isAdminAuthenticated, seasonShellEnabled]);

  useEffect(() => {
    if (seasonShellEnabled) return () => undefined;
    let isMounted = true;
    const loadRemote = async () => {
      try {
        const remote = await fetchGameState();
        hasRemoteSnapshotRef.current = true;
        remoteExistsRef.current = !!remote;
        if (!remote || !isMounted) return;
        const serialized = JSON.stringify(remote.state);
        lastRemoteStateRef.current = serialized;
        setGameState(normalizeGameState(remote.state));
        if (typeof remote.updatedAt === "number") {
          setLastSavedAt(remote.updatedAt);
        }
      } catch (error) {
        // If initial unauthenticated sync fails, try again after admin auth.
        if (isAdminAuthenticated && !hasRemoteSnapshotRef.current) {
          hasRemoteSnapshotRef.current = true;
          remoteExistsRef.current = false;
        }
        logger.warn("PocketBase sync failed:", error);
      }
    };
    void loadRemote();
    const unsubscribe = subscribeToGameState((remoteState, updatedAt) => {
      if (!isMounted) return;
      hasRemoteSnapshotRef.current = true;
      remoteExistsRef.current = true;
      const serialized = JSON.stringify(remoteState);
      lastRemoteStateRef.current = serialized;
      setGameState(normalizeGameState(remoteState));
      if (typeof updatedAt === "number") {
        setLastSavedAt(updatedAt);
      }
    });
    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [isAdminAuthenticated, seasonShellEnabled]);


  useEffect(() => {
    if (!isAdminAuthenticated) return undefined;
    const scopedSeasonId = normalizeWeekId(activeSeasonId);
    if (seasonShellEnabled && !scopedSeasonId) return undefined;
    if (!seasonShellEnabled && !hasRemoteSnapshotRef.current) return undefined;
    if (
      !seasonShellEnabled &&
      remoteExistsRef.current &&
      !lastRemoteStateRef.current
    ) {
      return undefined;
    }
    if (writeTimerRef.current) {
      window.clearTimeout(writeTimerRef.current);
    }
    const serialized = JSON.stringify(gameState);
    if (
      serialized === lastRemoteStateRef.current ||
      serialized === pendingWriteRef.current
    ) {
      return () => undefined;
    }
    writeTimerRef.current = window.setTimeout(() => {
      pendingWriteRef.current = serialized;
      const safeState = normalizeUndefined(gameState);
      const persistPromise =
        seasonShellEnabled && scopedSeasonId
          ? saveSeasonState(
              scopedSeasonId,
              safeState as GameState
            )
          : saveGameState(safeState as GameState);
      persistPromise
        .then((record) => {
          lastRemoteStateRef.current = serialized;
          pendingWriteRef.current = null;
          const updatedAt = record?.updated
            ? new Date(record.updated as string).getTime()
            : Date.now();
          setLastSavedAt(updatedAt);
          setLastWriteError(null);
        })
        .catch((error) => {
          pendingWriteRef.current = null;
          setLastWriteError(
            error instanceof Error ? error.message : String(error)
          );
          logger.warn("PocketBase write failed:", error);
        });
    }, TIMING.SAVE_DEBOUNCE_MS);
    return () => {
      if (writeTimerRef.current) {
        window.clearTimeout(writeTimerRef.current);
      }
    };
  }, [activeSeasonId, gameState, isAdminAuthenticated, seasonShellEnabled]);
  useEffect(() => {
    let isMounted = true;
    const hydratePortraits = async () => {
      try {
        const portraits = await fetchPlayerPortraits();
        if (!isMounted || Object.keys(portraits).length === 0) return;
        setGameState((prev) => {
          const updatedPlayers = prev.players.map((player) => {
            const key = normalizeEmail(player.email || "");
            const portraitUrl = portraits[key];
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
        league: entry.league === "jr" ? "jr" : "main",
      },
    ];
    updateGameState({ ...gameState, players: updatedPlayers });
  }, [gameState, updateGameState]);

  const authenticateAdmin = useCallback(async (
    email: string,
    password: string
  ): Promise<boolean> => {
    try {
      const success = await signInAdmin(email, password);
      return success;
    } catch {
      return false;
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

  const hasActiveWeeklyResults = useMemo(() => {
    const weekly = gameState.weeklyResults;
    return Boolean(
      weekly?.nextBanished ||
        weekly?.nextMurdered ||
        weekly?.bonusGames?.redemptionRoulette ||
        weekly?.bonusGames?.shieldGambit ||
        weekly?.bonusGames?.traitorTrio?.length ||
        weekly?.finaleResults?.finalWinner ||
        weekly?.finaleResults?.lastFaithfulStanding ||
        weekly?.finaleResults?.lastTraitorStanding ||
        typeof weekly?.finaleResults?.finalPotValue === "number"
    );
  }, [gameState.weeklyResults]);

  const rankedPlayers = useMemo(() => {
    if (gameState.players.length === 0) return null;

    const latestSnapshotTotals = scoreHistory[scoreHistory.length - 1]?.totals ?? {};
    const finalePotValue = gameState.weeklyResults?.finaleResults?.finalPotValue;
    const isFinaleTieBreakActive =
      Boolean(gameState.finaleConfig?.enabled) &&
      typeof finalePotValue === "number" &&
      Number.isFinite(finalePotValue);

    const scored = gameState.players
      .map((player) => {
        const archived = latestSnapshotTotals[player.id];
        const calculated = calculatePlayerScore(gameState, player).total;
        const score =
          !hasActiveWeeklyResults && typeof archived === "number"
            ? archived
            : calculated;
        return { player, score };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        if (isFinaleTieBreakActive) {
          const aDistance = getFinaleTieBreakDistance(a.player, finalePotValue);
          const bDistance = getFinaleTieBreakDistance(b.player, finalePotValue);
          if (aDistance === null && bDistance !== null) return 1;
          if (aDistance !== null && bDistance === null) return -1;
          if (typeof aDistance === "number" && typeof bDistance === "number" && aDistance !== bDistance) {
            return aDistance - bDistance;
          }
        }

        return a.player.name.localeCompare(b.player.name);
      });
    return scored;
  }, [gameState, hasActiveWeeklyResults, scoreHistory]);

  const overallMvp = useMemo(() => {
    const top = rankedPlayers?.[0];
    if (!top) return null;
    return {
      name: top.player.name,
      score: top.score,
      portraitUrl: top.player.portraitUrl,
      label: "Season MVP",
    };
  }, [rankedPlayers]);

  const finalStandings = useMemo<FinalStandingEntry[]>(
    () =>
      (rankedPlayers ?? []).slice(0, 3).map((entry) => ({
        name: entry.player.name,
        score: entry.score,
        portraitUrl: entry.player.portraitUrl,
        league: entry.player.league === "jr" ? "jr" : "main",
      })),
    [rankedPlayers]
  );

  const seasonFinalized = useMemo(
    () =>
      Boolean(
        gameState.finaleConfig?.enabled &&
          gameState.weeklyResults?.finaleResults?.finalWinner &&
          gameState.weeklyResults?.finaleResults?.lastFaithfulStanding &&
          gameState.weeklyResults?.finaleResults?.lastTraitorStanding
      ),
    [gameState.finaleConfig?.enabled, gameState.weeklyResults?.finaleResults]
  );

  const weeklyMvp = useMemo(() => {
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
  }, [gameState, scoreHistory]);

  const topMovers = useMemo<TopMoverEntry[]>(() => {
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
  }, [gameState.players, scoreHistory]);

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
            seasonFinalized={seasonFinalized}
            finalStandings={finalStandings}
            showConfig={gameState.showConfig}
            seasons={seasons}
            activeSeasonId={activeSeasonId || gameState.seasonId}
            onSeasonChange={handleSeasonChange}
            uiVariant={uiVariant}
          />
        );
      case "draft":
        return (
          <DraftForm
            gameState={gameState}
            onAddEntry={handleAddEntry}
            uiVariant={uiVariant}
          />
        );
      case "weekly":
        return (
          <WeeklyCouncil
            gameState={gameState}
            onAddEntry={handleAddEntry}
            showConfig={gameState.showConfig}
            uiVariant={uiVariant}
          />
        );
      case "leaderboard":
        return (
          <Leaderboard
            gameState={gameState}
            uiVariant={uiVariant}
            seasons={seasons}
            activeSeasonId={activeSeasonId || gameState.seasonId}
            onSeasonChange={handleSeasonChange}
          />
        );
      case "admin":
        return isAdminAuthenticated ? (
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
            uiVariant={uiVariant}
          />
        ) : (
          <AdminAuth
            onAuthenticate={authenticateAdmin}
            uiVariant={uiVariant}
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
            seasonFinalized={seasonFinalized}
            finalStandings={finalStandings}
            showConfig={gameState.showConfig}
            seasons={seasons}
            activeSeasonId={activeSeasonId || gameState.seasonId}
            onSeasonChange={handleSeasonChange}
            uiVariant={uiVariant}
          />
        );
    }
  }, [
    activeTab,
    actionQueue,
    leaguePulse,
    uiVariant,
    gameState,
    handleAddEntry,
    authenticateAdmin,
    handleSignOut,
    isAdminAuthenticated,
    lastSavedAt,
    lastWriteError,
    overallMvp,
    saveNow,
    seasonFinalized,
    finalStandings,
    handleSeasonChange,
    topMovers,
    updateGameState,
    seasons,
    activeSeasonId,
    weeklyMvp,
  ]);

  return (
    <ToastProvider>
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lastSync={lastSavedAt ?? undefined}
        showConfig={gameState.showConfig}
        uiVariant={uiVariant}
      >
        {content}
      </Layout>
    </ToastProvider>
  );
};

export default App;
