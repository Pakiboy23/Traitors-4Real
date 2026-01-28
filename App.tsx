import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "./components/Layout";
import Welcome from "./components/Welcome";
import DraftForm from "./components/DraftForm";
import AdminPanel from "./components/AdminPanel";
import Leaderboard from "./components/Leaderboard";
import AdminAuth from "./components/AdminAuth";
import { CAST_NAMES, GameState, PlayerEntry } from "./types";
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


      if (saved) return JSON.parse(saved);
    } catch {
      // ignore corrupted localStorage
    }

    const initialCast: Record<string, any> = {};
    CAST_NAMES.forEach((name) => {
      initialCast[name] = {
        isWinner: false,
        isFirstOut: false,
        isTraitor: false,
        isEliminated: false,
      };
    });

    return {
      players: [],
      castStatus: initialCast,
      weeklyResults: { nextBanished: "", nextMurdered: "" },
    } as GameState;
  });

  const updateGameState = (newState: GameState) => {
    setGameState(newState);
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
        setGameState(remote.state);
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
      setGameState(remoteState);
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
    const updatedPlayers = [
      ...gameState.players.filter((p) => p.name !== entry.name),
      entry,
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
  const content = useMemo(() => {
    switch (activeTab) {
      case "home":
        return <Welcome onStart={() => setActiveTab("draft")} />;
      case "draft":
        // If DraftForm doesn't take these props, the build will tell us.
        return <DraftForm gameState={gameState} onAddEntry={handleAddEntry} />;
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
        return <Welcome />;
    }
  }, [activeTab, gameState, isAdminAuthenticated]);

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      lastSync={lastSavedAt ?? undefined}
    >
      {content}
    </Layout>
  );
};

export default App;
