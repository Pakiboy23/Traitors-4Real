import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "./components/Layout";
import Welcome from "./components/Welcome";
import DraftForm from "./components/DraftForm";
import AdminPanel from "./components/AdminPanel";
import Leaderboard from "./components/Leaderboard";
import ChatInterface from "./components/ChatInterface";
import AdminAuth from "./components/AdminAuth";
import { CAST_NAMES, GameState, PlayerEntry } from "./types";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./src/lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { fetchPlayerPortraits, normalizeEmail } from "./services/firebase";

const STORAGE_KEY = "traitors_db_v4";
const FIRESTORE_COLLECTION = "games";
const FIRESTORE_DOC_ID = "default";
const ADMIN_EMAILS = ["s.haarisshariff@gmail.com"];
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
      const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
      const safeState = normalizeUndefined(gameState);
      await setDoc(
        docRef,
        { state: safeState, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setLastSavedAt(Date.now());
      setLastWriteError(null);
    } catch (error) {
      setLastWriteError(
        error instanceof Error ? error.message : String(error)
      );
      console.warn("Manual Firestore save failed:", error);
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const email = user?.email?.toLowerCase();
      const isAdmin =
        !!email &&
        ADMIN_EMAILS.some((allowed) => allowed.toLowerCase() === email);
      setIsAdminAuthenticated(isAdmin);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        hasRemoteSnapshotRef.current = true;
        remoteExistsRef.current = snapshot.exists();
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        if (!data?.state) return;
        const remoteState = data.state as GameState;
        const remoteUpdatedAt = data.updatedAt?.toMillis?.();
        if (typeof remoteUpdatedAt === "number") {
          setLastSavedAt(remoteUpdatedAt);
        }
        const serialized = JSON.stringify(remoteState);
        lastRemoteStateRef.current = serialized;
        setGameState(remoteState);
      },
      (error) => {
        console.warn("Firestore realtime sync failed:", error);
      }
    );
    return () => {
      unsubscribe();
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
      const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
      pendingWriteRef.current = serialized;
      setDoc(
        docRef,
        { state: gameState, updatedAt: serverTimestamp() },
        { merge: true }
      )
        .then(() => {
          lastRemoteStateRef.current = serialized;
          pendingWriteRef.current = null;
          setLastSavedAt(Date.now());
          setLastWriteError(null);
        })
        .catch((error) => {
          pendingWriteRef.current = null;
          setLastWriteError(
            error instanceof Error ? error.message : String(error)
          );
          console.warn("Firestore write failed:", error);
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
      const result = await signInWithEmailAndPassword(auth, email, password);
      const authedEmail = result.user.email?.toLowerCase();
      const isAdmin =
        !!authedEmail &&
        ADMIN_EMAILS.some(
          (allowed) => allowed.toLowerCase() === authedEmail
        );
      if (!isAdmin) {
        await signOut(auth);
      }
      return isAdmin;
    } catch {
      return false;
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
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
      case "chat":
        return <ChatInterface gameState={gameState} />;
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
