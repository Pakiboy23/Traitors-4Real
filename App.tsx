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
import { db } from "./src/lib/firebase";

const STORAGE_KEY = "traitors_db_v4";
const FIRESTORE_COLLECTION = "games";
const FIRESTORE_DOC_ID = "default";
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const lastRemoteStateRef = useRef<string | null>(null);
  const pendingWriteRef = useRef<string | null>(null);
  const writeTimerRef = useRef<number | null>(null);

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

    return { players: [], castStatus: initialCast } as GameState;
  });

  const updateGameState = (newState: GameState) => {
    setGameState(newState);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  useEffect(() => {
    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        if (!data?.state) return;
        const remoteState = data.state as GameState;
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
        })
        .catch((error) => {
          pendingWriteRef.current = null;
          console.warn("Firestore write failed:", error);
        });
    }, 500);
    return () => {
      if (writeTimerRef.current) {
        window.clearTimeout(writeTimerRef.current);
      }
    };
  }, [gameState]);

  const handleAddEntry = (entry: PlayerEntry) => {
    const updatedPlayers = [
      ...gameState.players.filter((p) => p.name !== entry.name),
      entry,
    ];
    setGameState({ ...gameState, players: updatedPlayers });
  };
  const authenticateAdmin = (password: string): boolean => {
    const ADMIN_PASSWORD = "Traitor2026"; // change this

    if (password === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      return true;
    }
    return false;
  };
  const content = useMemo(() => {
    switch (activeTab) {
      case "home":
        return <Welcome />;
      case "draft":
        // If DraftForm doesn't take these props, the build will tell us.
        return <DraftForm gameState={gameState} onAddEntry={handleAddEntry} />;
      case "leaderboard":
        // This is the key fix: stop Leaderboard from reading players off undefined.
        return <Leaderboard gameState={gameState} />;
      case "chat":
        return <ChatInterface />;
      case "admin":
        return isAdminAuthenticated ? (
          <AdminPanel gameState={gameState} updateGameState={updateGameState} />
        ) : (
          // This prop name might differ. If the build errors, we’ll change it to match AdminAuth.tsx.
          <AdminAuth onAuthenticate={authenticateAdmin} />
        );
      default:
        return <Welcome />;
    }
  }, [activeTab, gameState, isAdminAuthenticated]);

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {content}
    </Layout>
  );
};

export default App;
