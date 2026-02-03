import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "./components/Layout";
import Welcome from "./components/Welcome";
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
  PlayerEntry,
  WeeklySubmissionHistoryEntry,
  WeeklyScoreSnapshot,
} from "./types";
import { calculatePlayerScore } from "./src/utils/scoring";
import {
  fetchGameState,
  fetchPlayerPortraits,
  normalizeEmail,
  onAdminAuthChange,
  saveGameState,
  signInAdmin,
  signOutAdmin,
  subscribeToGameState,
} from "./services/pocketbase";

const STORAGE_KEY = "traitors_db_v4";
const DEFAULT_WEEKLY_RESULTS = {
  nextBanished: "",
  nextMurdered: "",
  bonusGames: {
    redemptionRoulette: "",
    shieldGambit: "",
    traitorTrio: [],
  },
};

const normalizeGameState = (input?: Partial<GameState> | null): GameState => {
  const castStatus: GameState["castStatus"] = {};
  const incomingCast: Record<string, Partial<CastMemberStatus>> =
    input?.castStatus ?? {};

  CAST_NAMES.forEach((name) => {
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
      },
    } as PlayerEntry;
  });

  const history = Array.isArray(input?.weeklySubmissionHistory)
    ? (input!.weeklySubmissionHistory as WeeklySubmissionHistoryEntry[])
    : [];
  const weeklyScoreHistory = Array.isArray(input?.weeklyScoreHistory)
    ? (input!.weeklyScoreHistory as WeeklyScoreSnapshot[])
    : [];

  return {
    players: normalizedPlayers,
    castStatus,
    weeklyResults: input?.weeklyResults ?? DEFAULT_WEEKLY_RESULTS,
    weeklySubmissionHistory: history,
    weeklyScoreHistory,
  };
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [lastWriteError, setLastWriteError] = useState<string | null>(null);
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

  const updateGameState = (newState: GameState) => {
    setGameState(normalizeGameState(newState));
  };

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

  const saveNow = async () => {
    if (!isAdminAuthenticated) return;
    try {
      const safeState = normalizeUndefined(gameState);
      const record = await saveGameState(safeState as GameState);
      const updatedAt = record?.updated
        ? new Date(record.updated as string).getTime()
        : Date.now();
      setLastSavedAt(updatedAt);
      setLastWriteError(null);
    } catch (error) {
      setLastWriteError(
        error instanceof Error ? error.message : String(error)
      );
      console.warn("Manual save failed:", error);
    }
  };

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
        console.warn("PocketBase sync failed:", error);
      }
    };
    loadRemote();
    const unsubscribe = subscribeToGameState((remoteState, updatedAt) => {
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
  }, []);


  useEffect(() => {
    if (!isAdminAuthenticated) return undefined;
    if (!hasRemoteSnapshotRef.current) return undefined;
    if (remoteExistsRef.current && !lastRemoteStateRef.current) {
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
      saveGameState(safeState as GameState)
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
          console.warn("PocketBase write failed:", error);
        });
    }, 500);
    return () => {
      if (writeTimerRef.current) {
        window.clearTimeout(writeTimerRef.current);
      }
    };
  }, [gameState, isAdminAuthenticated]);
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
        console.error("Failed to load player portraits:", err);
      }
    };
    hydratePortraits();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddEntry = (entry: PlayerEntry) => {
    const normalizedEmail = normalizeEmail(entry.email || "");
    const updatedPlayers = [
      ...gameState.players.filter((p) => {
        if (entry.id) return p.id !== entry.id;
        if (normalizedEmail) {
          return normalizeEmail(p.email || "") !== normalizedEmail;
        }
        return p.name !== entry.name;
      }),
      { ...entry, league: entry.league === "jr" ? "jr" : "main" },
    ];
    setGameState({ ...gameState, players: updatedPlayers });
  };
  const authenticateAdmin = async (
    email: string,
    password: string
  ): Promise<boolean> => {
    try {
      const success = await signInAdmin(email, password);
      return success;
    } catch {
      return false;
    }
  };

  const handleSignOut = async () => {
    signOutAdmin();
  };

  const scoreHistory = Array.isArray(gameState.weeklyScoreHistory)
    ? gameState.weeklyScoreHistory
    : [];

  const overallMvp = useMemo(() => {
    if (gameState.players.length === 0) return null;
    const scored = gameState.players
      .map((player) => ({
        player,
        score: calculatePlayerScore(gameState, player).total,
      }))
      .sort((a, b) => b.score - a.score);
    const top = scored[0];
    return top
      ? {
          name: top.player.name,
          score: top.score,
          portraitUrl: top.player.portraitUrl,
          label: "Season MVP",
        }
      : null;
  }, [gameState]);

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
  const content = useMemo(() => {
    switch (activeTab) {
      case "home":
        return (
          <Welcome
            onStart={() => setActiveTab("weekly")}
            mvp={overallMvp}
            weeklyMvp={weeklyMvp}
          />
        );
      case "draft":
        // If DraftForm doesn't take these props, the build will tell us.
        return <DraftForm gameState={gameState} onAddEntry={handleAddEntry} />;
      case "weekly":
        return (
          <WeeklyCouncil
            gameState={gameState}
            onAddEntry={handleAddEntry}
          />
        );
      case "leaderboard":
        // This is the key fix: stop Leaderboard from reading players off undefined.
        return <Leaderboard gameState={gameState} />;
      case "admin":
        return isAdminAuthenticated ? (
          <AdminPanel
            gameState={gameState}
            updateGameState={updateGameState}
            onSignOut={handleSignOut}
            lastSavedAt={lastSavedAt}
            lastWriteError={lastWriteError}
            onSaveNow={saveNow}
          />
        ) : (
          // This prop name might differ. If the build errors, we’ll change it to match AdminAuth.tsx.
          <AdminAuth onAuthenticate={authenticateAdmin} />
        );
      default:
        return <Welcome onStart={() => setActiveTab("weekly")} />;
    }
  }, [activeTab, gameState, isAdminAuthenticated]);

  return (
    <ToastProvider>
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lastSync={lastSavedAt ?? undefined}
      >
        {content}
      </Layout>
    </ToastProvider>
  );
};

export default App;
