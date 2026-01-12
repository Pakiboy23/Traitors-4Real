import React, { useEffect, useMemo, useState } from "react";
import Layout from "./components/Layout";
import Welcome from "./components/Welcome";
import DraftForm from "./components/DraftForm";
import AdminPanel from "./components/AdminPanel";
import Leaderboard from "./components/Leaderboard";
import ChatInterface from "./components/ChatInterface";
import AdminAuth from "./components/AdminAuth";
import { CAST_NAMES, GameState, PlayerEntry } from "./types";

const STORAGE_KEY = "traitors_db_v4";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

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
