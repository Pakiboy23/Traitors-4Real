import React, { useEffect, useRef, useState } from 'react';
import {
  GameState,
  CAST_NAMES,
  COUNCIL_LABELS,
  PlayerEntry,
  DraftPick,
  WeeklySubmissionHistoryEntry,
  WeeklyScoreSnapshot,
} from '../types';
import { getCastPortraitSrc } from "../src/castPortraits";
import { calculatePlayerScore, formatScore } from "../src/utils/scoring";
import { pocketbaseUrl } from "../src/lib/pocketbase";
import {
  deleteSubmission,
  fetchWeeklySubmissions,
  savePlayerPortrait,
  SubmissionRecord,
  subscribeToWeeklySubmissions,
} from '../services/pocketbase';

interface AdminPanelProps {
  gameState: GameState;
  updateGameState: (state: GameState) => void;
  onSignOut?: () => void;
  lastSavedAt?: number | null;
  lastWriteError?: string | null;
  onSaveNow?: () => void;
}

type ConfirmDialogState = {
  message: string;
  resolve: (value: boolean) => void;
};

type PromptDialogState = {
  title: string;
  initialValue: string;
  resolve: (value: string | null) => void;
};

const AdminPanel: React.FC<AdminPanelProps> = ({
  gameState,
  updateGameState,
  onSignOut,
  lastSavedAt,
  lastWriteError,
  onSaveNow,
}) => {
  const BANISHED_OPTIONS = CAST_NAMES;
  const MURDER_OPTIONS = ["No Murder", ...CAST_NAMES];
  const defaultStatus = {
    isWinner: false,
    isFirstOut: false,
    isTraitor: false,
    isEliminated: false,
    portraitUrl: null,
  };
  const [pasteContent, setPasteContent] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerEntry | null>(null);
  const [isManagingTome, setIsManagingTome] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editPlayerEmail, setEditPlayerEmail] = useState("");
  const [editWeeklyBanished, setEditWeeklyBanished] = useState("");
  const [editWeeklyMurdered, setEditWeeklyMurdered] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllScoreHistory, setShowAllScoreHistory] = useState(false);
  const [inlineEdits, setInlineEdits] = useState<Record<string, {
    name: string;
    email: string;
    weeklyBanished: string;
    weeklyMurdered: string;
  }>>({});
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const normalize = (value: string) => value.trim().toLowerCase();
  const requestConfirm = (message: string) =>
    new Promise<boolean>((resolve) => {
      setConfirmDialog({ message, resolve });
    });

  const requestPrompt = (title: string, initialValue = "") =>
    new Promise<string | null>((resolve) => {
      setPromptValue(initialValue);
      setPromptDialog({ title, initialValue, resolve });
    });

  const normalizeEmpty = <T,>(value: T | null | undefined) => {
    if (value === undefined || value === null || value === "") return null;
    return value;
  };
  const getSubmissionLeague = (submission: SubmissionRecord) => {
    const payload = submission.payload as { league?: string } | undefined;
    return payload?.league === "jr" ? "jr" : "main";
  };
  const getSubmissionBonusGames = (submission: SubmissionRecord) => {
    const payload = submission.payload as
      | {
          playerId?: string;
          bonusGames?: {
            redemptionRoulette?: string;
            doubleOrNothing?: boolean;
            shieldGambit?: string;
            traitorTrio?: string[];
          };
          weeklyPredictions?: {
            bonusGames?: {
              redemptionRoulette?: string;
              doubleOrNothing?: boolean;
              shieldGambit?: string;
              traitorTrio?: string[];
            };
          };
        }
      | undefined;
    return payload?.weeklyPredictions?.bonusGames ?? payload?.bonusGames;
  };
  const getSubmissionPlayerId = (submission: SubmissionRecord) => {
    const payload = submission.payload as { playerId?: string } | undefined;
    return payload?.playerId ?? null;
  };
  const HISTORY_LIMIT = 200;

  const buildHistoryEntry = (
    submission: SubmissionRecord
  ): WeeklySubmissionHistoryEntry => ({
    id: submission.id,
    name: submission.name || "",
    email: submission.email || "",
    weeklyBanished: submission.weeklyBanished || "",
    weeklyMurdered: submission.weeklyMurdered || "",
    league: getSubmissionLeague(submission),
    created: submission.created,
    mergedAt: new Date().toISOString(),
  });

  const mergeHistoryEntries = (
    existing: WeeklySubmissionHistoryEntry[],
    additions: WeeklySubmissionHistoryEntry[]
  ) => {
    if (additions.length === 0) return existing;
    const seen = new Set(existing.map((entry) => entry.id));
    const merged = [...existing];
    additions.forEach((entry) => {
      if (seen.has(entry.id)) return;
      merged.unshift(entry);
      seen.add(entry.id);
    });
    return merged.slice(0, HISTORY_LIMIT);
  };

  const findPlayerMatch = (
    players: PlayerEntry[],
    submission: SubmissionRecord,
    league: "main" | "jr"
  ) => {
    const playerId = getSubmissionPlayerId(submission);
    if (playerId) {
      const idx = players.findIndex((p) => p.id === playerId);
      if (idx !== -1) return { index: idx, type: "id" as const };
    }
    const email = normalize(submission.email || "");
    if (email) {
      const idx = players.findIndex((p) => {
        const matchesLeague = league === "jr" ? p.league === "jr" : p.league !== "jr";
        return matchesLeague && normalize(p.email || "") === email;
      });
      if (idx !== -1) return { index: idx, type: "email" as const };
    }
    const name = normalize(submission.name || "");
    if (name) {
      const idx = players.findIndex((p) => {
        const matchesLeague = league === "jr" ? p.league === "jr" : p.league !== "jr";
        return matchesLeague && normalize(p.name || "") === name;
      });
      if (idx !== -1) return { index: idx, type: "name" as const };
    }
    return null;
  };

  const refreshSubmissions = async () => {
    setIsLoadingSubmissions(true);
    setSubmissionsError(null);
    try {
      let records = await fetchWeeklySubmissions();
      if (records.length === 0) {
        try {
          const response = await fetch(
            `${pocketbaseUrl}/api/collections/submissions/records?perPage=200&sort=-created&filter=${encodeURIComponent(
              '(kind="weekly")'
            )}`
          );
          if (response.ok) {
            const data = (await response.json()) as { items?: SubmissionRecord[] };
            if (Array.isArray(data.items) && data.items.length > 0) {
              records = data.items;
              setMsg({
                text: "Loaded weekly submissions from API fallback.",
                type: "success",
              });
            }
          }
        } catch (fallbackError) {
          console.warn("Fallback submissions fetch failed:", fallbackError);
        }
      }
      setSubmissions(records);
      if (records.length > 0) {
        await mergeSubmissionList(records, { announce: false });
      }
    } catch (error: any) {
      setSubmissionsError(error?.message || String(error));
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    refreshSubmissions();
    const unsubscribe = subscribeToWeeklySubmissions((submission) => {
      setSubmissions((prev) =>
        prev.some((existing) => existing.id === submission.id)
          ? prev
          : [submission, ...prev]
      );
      mergeSubmissionRecord(submission, { announce: false });
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!selectedPlayer) {
      setEditPlayerName("");
      setEditPlayerEmail("");
      setEditWeeklyBanished("");
      setEditWeeklyMurdered("");
      return;
    }
    setEditPlayerName(selectedPlayer.name || "");
    setEditPlayerEmail(selectedPlayer.email || "");
    setEditWeeklyBanished(selectedPlayer.weeklyPredictions?.nextBanished || "");
    setEditWeeklyMurdered(selectedPlayer.weeklyPredictions?.nextMurdered || "");
  }, [selectedPlayer?.id]);

  const parseAndAdd = () => {
    try {
      if (!pasteContent.trim()) throw new Error("The scroll is empty.");

      const lines = pasteContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      let playerName = "";
      let playerEmail = "";
      let picks: DraftPick[] = [];
      let predFirstOut = "";
      let predWinner = "";
      let predTraitors: string[] = [];
      let weeklyBanished = "";
      let weeklyMurdered = "";
      
      let inTraitorSection = false;

      lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.startsWith("player:") || lowerLine.includes("name:")) {
          playerName = line.split(/[:\-]/)[1]?.trim() || "";
        }
        if (lowerLine.startsWith("email:")) {
          playerEmail = line.split(/[:\-]/)[1]?.trim() || "";
        }
        
        if (lowerLine.includes("pick") && (lowerLine.includes("#") || lowerLine.includes(":"))) {
          let content = line.replace(/pick\s*#?\d+[:\s]*/i, "").trim();
          const parts = content.split(/[|]/);
          const namePart = parts[0]?.trim() || "";
          
          let rank = 1;
          const rankMatch = line.match(/rank:\s*(\d+)/i);
          if (rankMatch) {
            rank = parseInt(rankMatch[1]);
          } else {
            const numbers = line.match(/\d+/g);
            if (numbers && numbers.length > 1) rank = parseInt(numbers[1]);
          }

          let role: 'Faithful' | 'Traitor' = 'Faithful';
          if (lowerLine.includes("traitor") && !lowerLine.includes("faithful")) role = 'Traitor';

          const matchedName = CAST_NAMES.find(c => namePart.includes(c) || c.includes(namePart));
          if (matchedName) {
            picks.push({ member: matchedName, rank, role });
          }
        }

        if (lowerLine.includes("first eliminated:") || lowerLine.includes("first out:")) {
          const val = line.split(":")[1]?.trim() || "";
          predFirstOut = CAST_NAMES.find(c => val.includes(c)) || val;
        }
        if (lowerLine.includes("winner pick:") || lowerLine.includes("sole winner:") || lowerLine.includes("winner:")) {
          const val = line.split(":")[1]?.trim() || "";
          predWinner = CAST_NAMES.find(c => val.includes(c)) || val;
        }

        if (lowerLine.includes("next banished:")) {
          const val = line.split(":")[1]?.trim() || "";
          weeklyBanished = CAST_NAMES.find(c => val.includes(c)) || val;
        }
        if (lowerLine.includes("next murdered:")) {
          const val = line.split(":")[1]?.trim() || "";
          weeklyMurdered = CAST_NAMES.find(c => val.includes(c)) || val;
        }

        if (lowerLine.includes("traitor guesses") || lowerLine.includes("traitor suspects") || lowerLine.includes("the traitors")) {
          inTraitorSection = true;
        } else if (inTraitorSection) {
          const cleanedLine = line.replace(/^\d+[\.\)]/, "").replace(/^[-•*]/, "").trim();
          const matchedTraitor = CAST_NAMES.find(c => cleanedLine.includes(c));
          if (matchedTraitor && predTraitors.length < 3) {
            predTraitors.push(matchedTraitor);
          }
          if (lowerLine.includes("===") || lowerLine.includes("---")) inTraitorSection = false;
        }
      });

      if (!playerName) throw new Error("The Tome is missing a Player Name.");
      if (picks.length === 0) throw new Error("No recognizable Draft Squad members found.");

      const newPlayer: PlayerEntry = {
        id: Date.now().toString(),
        name: playerName,
        email: playerEmail,
        picks,
        predFirstOut,
        predWinner,
        predTraitors,
        weeklyPredictions: {
          nextBanished: weeklyBanished,
          nextMurdered: weeklyMurdered,
          bonusGames: {
            redemptionRoulette: "",
            doubleOrNothing: false,
            shieldGambit: "",
            traitorTrio: [],
          },
        },
      };

      const updatedPlayers = [...gameState.players.filter(p => p.name.toLowerCase() !== playerName.toLowerCase()), newPlayer];
      updateGameState({ ...gameState, players: updatedPlayers });
      
      setMsg({ text: `Ritual Complete: ${playerName}'s entry has been inscribed.`, type: 'success' });
      setPasteContent('');
    } catch (e: any) {
      setMsg({ text: `Parsing Error: ${e.message}`, type: 'error' });
    }
  };

  const updateCastMember = (name: string, field: string, value: any) => {
    const updatedStatus = { ...gameState.castStatus };
    const currentStatus = updatedStatus[name] ?? defaultStatus;
    updatedStatus[name] = { ...currentStatus, [field]: value };
    if (field === 'isFirstOut' && value === true) updatedStatus[name].isWinner = false;
    if (field === 'isWinner' && value === true) updatedStatus[name].isFirstOut = false;
    updateGameState({ ...gameState, castStatus: updatedStatus });
  };

  const updatePlayerAvatar = (playerId: string, url: string) => {
    const updatedPlayers = gameState.players.map(p => 
      p.id === playerId ? { ...p, portraitUrl: url } : p
    );
    updateGameState({ ...gameState, players: updatedPlayers });
    const targetPlayer = updatedPlayers.find(p => p.id === playerId);
    if (selectedPlayer?.id === playerId) {
      setSelectedPlayer(prev => prev ? { ...prev, portraitUrl: url } : null);
    }
    if (targetPlayer?.email) {
      savePlayerPortrait(targetPlayer.email, targetPlayer.name, url).catch((err) => {
        console.error("Failed to persist player portrait:", err);
        setMsg({ text: "Portrait saved locally. PocketBase writes failed.", type: 'error' });
      });
    }
  };

  const setCastPortrait = async (name: string) => {
    const current = gameState.castStatus[name]?.portraitUrl || "";
    const url = await requestPrompt("Enter image URL for cast portrait:", current);
    if (url === null) return;
    const trimmed = url.trim();
    updateCastMember(name, 'portraitUrl', trimmed ? trimmed : null);
  };

  const clearAllPortraits = async () => {
    if (!(await requestConfirm("Remove all stored portraits?"))) return;
    const updatedStatus = { ...gameState.castStatus };
    Object.keys(updatedStatus).forEach((name) => {
      updatedStatus[name] = { ...updatedStatus[name], portraitUrl: null };
    });
    const updatedPlayers = gameState.players.map((p) => ({
      ...p,
      portraitUrl: null,
    }));
    updateGameState({ ...gameState, castStatus: updatedStatus, players: updatedPlayers });
    setMsg({ text: "All portraits removed.", type: 'success' });
  };


  const downloadGameState = () => {
    const payload = JSON.stringify(gameState, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `traitors-game-state-${new Date().toISOString().slice(0, 19)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleTomeImport = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const data = JSON.parse(e.target.value);
      if (data.players && data.castStatus) {
        updateGameState(data);
        setMsg({ text: "Database fully restored from Tome.", type: 'success' });
      }
    } catch (err) {
      setMsg({ text: "Invalid Tome format.", type: 'error' });
    }
  };

  const applySubmissionToPlayers = (
    players: PlayerEntry[],
    submission: SubmissionRecord
  ) => {
    const league = getSubmissionLeague(submission);
    const match = findPlayerMatch(players, submission, league);
    const bonusGames = getSubmissionBonusGames(submission);
    const incomingBanished = normalizeEmpty(submission.weeklyBanished);
    const incomingMurdered = normalizeEmpty(submission.weeklyMurdered);
    const incomingBonusGames = {
      redemptionRoulette: normalizeEmpty(bonusGames?.redemptionRoulette) ?? undefined,
      doubleOrNothing:
        typeof bonusGames?.doubleOrNothing === "boolean"
          ? bonusGames?.doubleOrNothing
          : undefined,
      shieldGambit: normalizeEmpty(bonusGames?.shieldGambit) ?? undefined,
      traitorTrio:
        Array.isArray(bonusGames?.traitorTrio)
          ? bonusGames?.traitorTrio
          : undefined,
    };
    if (!match) {
      if (league !== "jr") return { matched: false as const, players };
      const normalizedEmail = normalize(submission.email || "");
      const safeName = submission.name?.trim() || "JR Player";
      const fallbackId = safeName.toLowerCase().replace(/\s+/g, "-");
      const rawId = normalizedEmail || fallbackId || `jr-${Date.now()}`;
      const idSeed = rawId.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const newPlayer: PlayerEntry = {
        id: `jr-${idSeed || Date.now()}`,
        name: submission.name || "",
        email: submission.email || "",
        league: "jr",
        picks: [],
        predFirstOut: "",
        predWinner: "",
        predTraitors: [],
        weeklyPredictions: {
          nextBanished: typeof incomingBanished === "string" ? incomingBanished : "",
          nextMurdered: typeof incomingMurdered === "string" ? incomingMurdered : "",
          bonusGames: {
            redemptionRoulette: incomingBonusGames.redemptionRoulette ?? "",
            doubleOrNothing: Boolean(incomingBonusGames.doubleOrNothing),
            shieldGambit: incomingBonusGames.shieldGambit ?? "",
            traitorTrio: incomingBonusGames.traitorTrio ?? [],
          },
        },
      };
      return {
        matched: true as const,
        players: [...players, newPlayer],
        match: { index: players.length, type: "new" as const },
      };
    }
    const updatedPlayers = players.map((player, idx) => {
      if (idx !== match.index) return player;
      const existingWeekly = player.weeklyPredictions ?? {
        nextBanished: "",
        nextMurdered: "",
        bonusGames: {},
      };
      const existingBonus = existingWeekly.bonusGames ?? {};
      const nextBonusGames = {
        redemptionRoulette:
          incomingBonusGames.redemptionRoulette ?? existingBonus.redemptionRoulette ?? "",
        doubleOrNothing:
          typeof incomingBonusGames.doubleOrNothing === "boolean"
            ? incomingBonusGames.doubleOrNothing
            : Boolean(existingBonus.doubleOrNothing),
        shieldGambit:
          incomingBonusGames.shieldGambit ?? existingBonus.shieldGambit ?? "",
        traitorTrio:
          incomingBonusGames.traitorTrio ?? existingBonus.traitorTrio ?? [],
      };
      return {
        ...player,
        name: submission.name || player.name,
        email: submission.email || player.email,
        weeklyPredictions: {
          nextBanished:
            typeof incomingBanished === "string"
              ? incomingBanished
              : existingWeekly.nextBanished || "",
          nextMurdered:
            typeof incomingMurdered === "string"
              ? incomingMurdered
              : existingWeekly.nextMurdered || "",
          bonusGames: nextBonusGames,
        },
      };
    });
    return { matched: true as const, players: updatedPlayers, match };
  };

  const mergeSubmissionRecord = async (
    submission: SubmissionRecord,
    { announce = true }: { announce?: boolean } = {}
  ) => {
    const currentState = gameStateRef.current;
    const result = applySubmissionToPlayers(currentState.players, submission);
    if (!result.matched) {
      if (announce) {
        setMsg({
          text: `No matching player found for ${submission.name}.`,
          type: "error",
        });
      }
      return;
    }
    const historyEntry = buildHistoryEntry(submission);
    const nextHistory = mergeHistoryEntries(
      Array.isArray(currentState.weeklySubmissionHistory)
        ? currentState.weeklySubmissionHistory
        : [],
      [historyEntry]
    );
    const nextState = {
      ...currentState,
      players: result.players,
      weeklySubmissionHistory: nextHistory,
    };
    gameStateRef.current = nextState;
    updateGameState(nextState);
    try {
      await deleteSubmission(submission.id);
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
      if (announce) {
        setMsg({
          text: `Merged weekly vote for ${submission.name}.`,
          type: "success",
        });
      }
    } catch (err: any) {
      if (announce) {
        setMsg({
          text: `Merged weekly vote, but failed to clear submission: ${err?.message || err}`,
          type: "error",
        });
      }
    }
  };

  const mergeSubmissionList = async (
    list: SubmissionRecord[],
    { announce = true }: { announce?: boolean } = {}
  ) => {
    if (list.length === 0) return;
    let updatedPlayers = gameStateRef.current.players;
    const mergedIds: string[] = [];
    const historyAdds: WeeklySubmissionHistoryEntry[] = [];
    let skipped = 0;

    list.forEach((submission) => {
      const result = applySubmissionToPlayers(updatedPlayers, submission);
      if (result.matched) {
        updatedPlayers = result.players;
        mergedIds.push(submission.id);
        historyAdds.push(buildHistoryEntry(submission));
      } else {
        skipped += 1;
      }
    });

    if (mergedIds.length > 0) {
      const nextHistory = mergeHistoryEntries(
        Array.isArray(gameStateRef.current.weeklySubmissionHistory)
          ? gameStateRef.current.weeklySubmissionHistory
          : [],
        historyAdds
      );
      const nextState = {
        ...gameStateRef.current,
        players: updatedPlayers,
        weeklySubmissionHistory: nextHistory,
      };
      gameStateRef.current = nextState;
      updateGameState(nextState);
    }

    try {
      await Promise.all(mergedIds.map((id) => deleteSubmission(id)));
      setSubmissions((prev) => prev.filter((s) => !mergedIds.includes(s.id)));
      if (announce) {
        setMsg({
          text: `Merged ${mergedIds.length} weekly votes${skipped ? `, skipped ${skipped}` : ""}.`,
          type: "success",
        });
      }
    } catch (err: any) {
      if (announce) {
        setMsg({
          text: `Merged weekly votes, but failed to clear some submissions: ${err?.message || err}`,
          type: "error",
        });
      }
    }
  };

  const dismissSubmission = async (submission: SubmissionRecord) => {
    if (!(await requestConfirm(`Dismiss submission from ${submission.name}?`))) return;
    try {
      await deleteSubmission(submission.id);
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
    } catch (err: any) {
      setMsg({
        text: `Failed to dismiss submission: ${err?.message || err}`,
        type: "error",
      });
    }
  };

  const mergeAllSubmissions = async () => {
    await mergeSubmissionList(submissions);
  };

  const updateSelectedPlayer = (updates: Partial<PlayerEntry>) => {
    if (!selectedPlayer) return;
    const updatedPlayers = gameState.players.map((player) =>
      player.id === selectedPlayer.id ? { ...player, ...updates } : player
    );
    updateGameState({ ...gameState, players: updatedPlayers });
    const nextSelected = updatedPlayers.find((p) => p.id === selectedPlayer.id) || null;
    setSelectedPlayer(nextSelected);
  };

  const saveWeeklyEdits = () => {
    if (!selectedPlayer) return;
    updateSelectedPlayer({
      weeklyPredictions: {
        nextBanished: editWeeklyBanished,
        nextMurdered: editWeeklyMurdered,
        bonusGames: selectedPlayer.weeklyPredictions?.bonusGames,
      },
    });
    setMsg({
      text: `${COUNCIL_LABELS.weekly} updated for ${selectedPlayer.name}.`,
      type: "success",
    });
  };

  const savePlayerEdits = () => {
    if (!selectedPlayer) return;
    const nextName = editPlayerName.trim();
    const nextEmail = editPlayerEmail.trim();
    if (!nextName) {
      setMsg({ text: "Player name is required.", type: "error" });
      return;
    }
    updateSelectedPlayer({
      name: nextName,
      email: nextEmail,
    });
    setMsg({
      text: `Player details updated for ${nextName}.`,
      type: "success",
    });
  };

  const buildInlineEdit = (player: PlayerEntry) => ({
    name: player.name || "",
    email: player.email || "",
    weeklyBanished: player.weeklyPredictions?.nextBanished || "",
    weeklyMurdered: player.weeklyPredictions?.nextMurdered || "",
  });

  const updateInlineEdit = (
    player: PlayerEntry,
    updates: Partial<{
      name: string;
      email: string;
      weeklyBanished: string;
      weeklyMurdered: string;
    }>
  ) => {
    setInlineEdits((prev) => {
      const base = prev[player.id] ?? buildInlineEdit(player);
      return {
        ...prev,
        [player.id]: { ...base, ...updates },
      };
    });
  };

  const saveInlineEdit = (player: PlayerEntry) => {
    const edit = inlineEdits[player.id] ?? buildInlineEdit(player);
    const nextName = edit.name.trim();
    if (!nextName) {
      setMsg({ text: "Player name is required.", type: "error" });
      return;
    }
    const nextEmail = edit.email.trim();
    const updatedPlayers = gameState.players.map((p) =>
      p.id === player.id
        ? {
            ...p,
            name: nextName,
            email: nextEmail,
          weeklyPredictions: {
            nextBanished: edit.weeklyBanished,
            nextMurdered: edit.weeklyMurdered,
            bonusGames: player.weeklyPredictions?.bonusGames,
          },
        }
        : p
    );
    updateGameState({ ...gameState, players: updatedPlayers });
    if (selectedPlayer?.id === player.id) {
      const updated = updatedPlayers.find((p) => p.id === player.id) || null;
      setSelectedPlayer(updated);
    }
    setInlineEdits((prev) => ({
      ...prev,
      [player.id]: {
        name: nextName,
        email: nextEmail,
        weeklyBanished: edit.weeklyBanished,
        weeklyMurdered: edit.weeklyMurdered,
      },
    }));
    setMsg({
      text: `Saved updates for ${nextName}.`,
      type: "success",
    });
  };

  const clearHistory = async () => {
    if (!(await requestConfirm("Clear merged submission history?"))) return;
    const nextState = { ...gameState, weeklySubmissionHistory: [] };
    gameStateRef.current = nextState;
    updateGameState(nextState);
    setMsg({ text: "Merged history cleared.", type: "success" });
  };

  const history = Array.isArray(gameState.weeklySubmissionHistory)
    ? gameState.weeklySubmissionHistory
    : [];
  const visibleHistory = showAllHistory ? history : history.slice(0, 20);

  const scoreHistory: WeeklyScoreSnapshot[] = Array.isArray(
    gameState.weeklyScoreHistory
  )
    ? gameState.weeklyScoreHistory
    : [];
  const visibleScoreHistory = showAllScoreHistory
    ? scoreHistory
    : scoreHistory.slice(-6);

  const archiveWeeklyScores = async () => {
    const currentState = gameStateRef.current;
    if (currentState.players.length === 0) {
      setMsg({ text: "No players to score yet.", type: "error" });
      return;
    }
    const defaultLabel = `Week ${scoreHistory.length + 1}`;
    const labelInput = await requestPrompt("Label this week:", defaultLabel);
    if (labelInput === null) return;
    const label = labelInput.trim() || defaultLabel;
    const totals: Record<string, number> = {};
    currentState.players.forEach((player) => {
      totals[player.id] = calculatePlayerScore(currentState, player).total;
    });
    const snapshotResults = currentState.weeklyResults
      ? JSON.parse(JSON.stringify(currentState.weeklyResults))
      : undefined;
    const snapshot: WeeklyScoreSnapshot = {
      id: `week-${Date.now()}`,
      label,
      createdAt: new Date().toISOString(),
      weeklyResults: snapshotResults,
      totals,
    };
    const nextHistory = [...scoreHistory, snapshot].slice(-52);
    const nextState = { ...currentState, weeklyScoreHistory: nextHistory };
    gameStateRef.current = nextState;
    updateGameState(nextState);
    setMsg({ text: `Archived scores for ${label}.`, type: "success" });
  };

  const getScoreTopper = (snapshot: WeeklyScoreSnapshot) => {
    let topId: string | null = null;
    let topScore = -Infinity;
    Object.entries(snapshot.totals || {}).forEach(([id, total]) => {
      if (typeof total !== "number") return;
      if (total > topScore) {
        topScore = total;
        topId = id;
      }
    });
    if (!topId) return null;
    const player = gameState.players.find((p) => p.id === topId);
    return player ? { name: player.name, score: topScore } : null;
  };

  const bonusResults = gameState.weeklyResults?.bonusGames ?? {};
  const updateBonusResult = (
    key: "redemptionRoulette" | "shieldGambit",
    value: string
  ) => {
    const nextState = {
      ...gameStateRef.current,
      weeklyResults: {
        ...(gameStateRef.current.weeklyResults ?? {}),
        bonusGames: {
          ...(gameStateRef.current.weeklyResults?.bonusGames ?? {}),
          [key]: value,
        },
      },
    };
    gameStateRef.current = nextState;
    updateGameState(nextState);
  };

  return (
    <div className="w-full animate-in fade-in duration-500">
      <div className="w-full max-w-[960px] mx-auto space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-4xl gothic-font text-[color:var(--accent)]">Admin Console</h2>
          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
            <div className="text-xs text-zinc-500 uppercase tracking-[0.2em] self-center w-full md:w-auto mb-2 md:mb-0">
              {lastWriteError
                ? `Save failed: ${lastWriteError}`
                : lastSavedAt
                ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
                : "Not saved yet"}
            </div>
            {onSaveNow && (
              <button
                onClick={onSaveNow}
                className="px-4 py-2 md:px-6 md:py-3 bg-black/60 text-xs md:text-sm text-zinc-200 rounded-2xl border border-[color:var(--accent)]/40 uppercase font-semibold tracking-[0.12em] md:tracking-[0.16em] hover:bg-[color:var(--accent)] hover:text-black transition-all"
              >
                Save Now
              </button>
            )}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="px-4 py-2 md:px-6 md:py-3 bg-black/60 text-xs md:text-sm text-red-200 rounded-2xl border border-red-900/60 uppercase font-semibold tracking-[0.12em] md:tracking-[0.16em] hover:bg-red-900/40 transition-all"
              >
                Sign Out
              </button>
            )}
            <button
              onClick={() => setIsManagingTome(!isManagingTome)}
              className="px-4 py-2 md:px-6 md:py-3 bg-black/50 text-xs md:text-sm text-zinc-300 rounded-2xl border border-zinc-700 uppercase font-semibold tracking-[0.12em] md:tracking-[0.16em] hover:text-white transition-all"
            >
              {isManagingTome ? "Close DB" : "DB Tools"}
            </button>
            <button
              onClick={clearAllPortraits}
              className="px-4 py-2 md:px-6 md:py-3 bg-black/50 text-xs md:text-sm text-red-200 rounded-2xl border border-red-900/60 uppercase font-semibold tracking-[0.12em] md:tracking-[0.16em] hover:bg-red-900/40 transition-all"
            >
              Clear Portraits
            </button>
            <button
              onClick={downloadGameState}
              className="px-4 py-2 md:px-6 md:py-3 bg-black/50 text-xs md:text-sm text-zinc-200 rounded-2xl border border-[color:var(--accent)]/40 uppercase font-semibold tracking-[0.12em] md:tracking-[0.16em] hover:bg-[color:var(--accent)] hover:text-black transition-all"
            >
              Download JSON
            </button>
          </div>
        </div>

      {isManagingTome && (
        <div className="glass-panel py-6 px-12 rounded-2xl animate-in slide-in-from-top-4">
          <h3 className="text-[color:var(--accent)] gothic-font mb-3 uppercase text-base">Data Import (JSON)</h3>
          <textarea 
            className="w-full h-36 field-soft text-xs font-mono p-5 rounded-2xl text-zinc-400 focus:border-[#D4AF37] outline-none"
            defaultValue={JSON.stringify(gameState, null, 2)}
            onChange={handleTomeImport}
            placeholder="Paste JSON Tome here to overwrite database..."
          />
        </div>
      )}

      <div className="glass-panel py-6 px-12 rounded-2xl">
        <h3 className="text-xl gothic-font text-[color:var(--accent)] mb-5 uppercase tracking-[0.2em]">Weekly Results</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-red-400 font-semibold mb-2 uppercase tracking-[0.2em]">⚖️ Next Banished</label>
            <select
              value={gameState.weeklyResults?.nextBanished ?? ""}
              onChange={(e) =>
                updateGameState({
                  ...gameState,
                  weeklyResults: {
                    ...(gameState.weeklyResults ?? {}),
                    nextBanished: e.target.value,
                  },
                })
              }
              className="w-full p-3.5 rounded-2xl field-soft text-sm text-white"
            >
              <option value="">Select...</option>
              {BANISHED_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-fuchsia-400 font-semibold mb-2 uppercase tracking-[0.2em]">🗡️ Next Murdered</label>
            <select
              value={gameState.weeklyResults?.nextMurdered ?? ""}
              onChange={(e) =>
                updateGameState({
                  ...gameState,
                  weeklyResults: {
                    ...(gameState.weeklyResults ?? {}),
                    nextMurdered: e.target.value,
                  },
                })
              }
              className="w-full p-3.5 rounded-2xl field-soft text-sm text-white"
            >
              <option value="">Select...</option>
              {MURDER_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mt-4">Used to score {COUNCIL_LABELS.weekly.toLowerCase()} picks</p>

        <div className="mt-6 pt-6 border-t soft-divider">
          <h4 className="text-sm gothic-font text-[color:var(--accent)] uppercase tracking-[0.24em] mb-4">
            Bonus Game Results
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-amber-300 font-semibold mb-2 uppercase tracking-[0.2em]">
                🎲 Redemption Roulette (Revealed Traitor)
              </label>
              <select
                value={bonusResults.redemptionRoulette ?? ""}
                onChange={(e) => updateBonusResult("redemptionRoulette", e.target.value)}
                className="w-full p-3.5 rounded-2xl field-soft text-sm text-white"
              >
                <option value="">Select...</option>
                {CAST_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                </select>
            </div>
            <div>
              <label className="block text-xs text-sky-300 font-semibold mb-2 uppercase tracking-[0.2em]">
                🛡️ Shield Gambit (Immunity Winner)
              </label>
              <select
                value={bonusResults.shieldGambit ?? ""}
                onChange={(e) => updateBonusResult("shieldGambit", e.target.value)}
                className="w-full p-3.5 rounded-2xl field-soft text-sm text-white"
              >
                <option value="">Select...</option>
                {CAST_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                </select>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel py-6 px-12 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl gothic-font text-[color:var(--accent)]">Weekly Score Tracking</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mt-1">
              Archive weekly totals to show progress in the leaderboard
            </p>
          </div>
          <div className="flex items-center gap-2">
            {scoreHistory.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllScoreHistory((prev) => !prev)}
                className="px-4 py-2 rounded-full border border-zinc-800 text-xs uppercase tracking-[0.2em] text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
              >
                {showAllScoreHistory ? "Show Recent" : "Show All"}
              </button>
            )}
            <button
              type="button"
              onClick={archiveWeeklyScores}
              className="px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] font-bold bg-[color:var(--accent)] text-black border border-[color:var(--accent)] hover:bg-[color:var(--accent-strong)] transition-all"
            >
              Archive Week
            </button>
          </div>
        </div>

        {scoreHistory.length === 0 ? (
          <p className="text-xs text-zinc-500 mt-4">
            No weekly snapshots yet. Archive after each episode to track progress.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {visibleScoreHistory.map((snapshot) => {
              const topper = getScoreTopper(snapshot);
              const weeklyResults = snapshot.weeklyResults;
              return (
                <div
                  key={snapshot.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl soft-card soft-card-subtle border-zinc-700/60"
                >
                  <div className="space-y-1">
                    <p className="text-sm text-white font-semibold">{snapshot.label}</p>
                    <p className="text-[11px] text-zinc-500 uppercase tracking-[0.16em]">
                      Archived {new Date(snapshot.createdAt).toLocaleString()}
                    </p>
                    {(weeklyResults?.nextBanished || weeklyResults?.nextMurdered || weeklyResults?.bonusGames?.redemptionRoulette || weeklyResults?.bonusGames?.shieldGambit) && (
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {weeklyResults?.nextBanished ? `Banished: ${weeklyResults.nextBanished}` : ""}
                        {weeklyResults?.nextBanished && weeklyResults?.nextMurdered ? " • " : ""}
                        {weeklyResults?.nextMurdered ? `Murdered: ${weeklyResults.nextMurdered}` : ""}
                        {(weeklyResults?.nextBanished || weeklyResults?.nextMurdered) && (weeklyResults?.bonusGames?.redemptionRoulette || weeklyResults?.bonusGames?.shieldGambit) ? " • " : ""}
                        {weeklyResults?.bonusGames?.redemptionRoulette ? `Roulette: ${weeklyResults.bonusGames.redemptionRoulette}` : ""}
                        {weeklyResults?.bonusGames?.redemptionRoulette && weeklyResults?.bonusGames?.shieldGambit ? " • " : ""}
                        {weeklyResults?.bonusGames?.shieldGambit ? `Shield: ${weeklyResults.bonusGames.shieldGambit}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 uppercase tracking-[0.16em]">
                    {topper ? `Top: ${topper.name} (${formatScore(topper.score)})` : "Top: —"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass-panel py-6 px-12 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl gothic-font text-[color:var(--accent)]">Weekly Submissions</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mt-1">
              New {COUNCIL_LABELS.weekly} votes · API: {pocketbaseUrl}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshSubmissions}
              className="px-4 py-2 rounded-full border border-zinc-800 text-xs uppercase tracking-[0.2em] text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={mergeAllSubmissions}
              disabled={submissions.length === 0}
              className={`px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] font-bold transition-all ${
                submissions.length === 0
                  ? 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                  : 'bg-[color:var(--accent)] text-black border border-[color:var(--accent)] hover:bg-[color:var(--accent-strong)]'
              }`}
            >
              Merge All
            </button>
          </div>
        </div>

        {isLoadingSubmissions && (
          <p className="text-xs text-zinc-500 mt-4">Loading submissions...</p>
        )}
        {submissionsError && (
          <p className="text-xs text-red-400 mt-4">{submissionsError}</p>
        )}
        {!isLoadingSubmissions && submissions.length === 0 && (
          <p className="text-xs text-zinc-500 mt-4">No submissions yet.</p>
        )}

        <div className="mt-4 space-y-3">
          {submissions.map((submission) => {
            const league = getSubmissionLeague(submission);
            const match = findPlayerMatch(gameState.players, submission, league);
            const canMerge = Boolean(match) || league === "jr";
            const createdLabel = submission.created
              ? new Date(submission.created).toLocaleString()
              : "";
            return (
              <div
                key={submission.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl soft-card soft-card-subtle border-zinc-700/60"
              >
                <div className="space-y-1">
                  <p className="text-sm text-white font-semibold">
                    {submission.name}
                    {submission.email ? (
                      <span className="text-xs text-zinc-500 ml-2">
                        {submission.email}
                      </span>
                    ) : null}
                    <span
                      className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${
                        league === "jr"
                          ? "bg-purple-500/20 text-purple-200 border border-purple-500/30"
                          : "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                      }`}
                    >
                      {league === "jr" ? "JR" : "Main"}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-400">
                    Banished:{" "}
                    <span className="text-zinc-200">
                      {submission.weeklyBanished || "None"}
                    </span>{" "}
                    · Murdered:{" "}
                    <span className="text-zinc-200">
                      {submission.weeklyMurdered || "None"}
                    </span>
                  </p>
                  <p className="text-[11px] text-zinc-500 uppercase tracking-[0.16em]">
                    {createdLabel ? `Submitted ${createdLabel}` : "Submitted"}
                    {match
                      ? ` · Match by ${match.type}`
                      : league === "jr"
                      ? " · New Jr player"
                      : " · No match"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => mergeSubmissionRecord(submission)}
                    disabled={!canMerge}
                    className={`px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] font-bold transition-all ${
                      canMerge
                        ? 'bg-emerald-400 text-black hover:bg-emerald-300'
                        : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                    }`}
                  >
                    Merge
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissSubmission(submission)}
                    className="px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] text-red-400 border border-red-900/40 hover:bg-red-900/20"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-panel py-6 px-12 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl gothic-font text-[color:var(--accent)]">Merged History</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mt-1">
              {history.length} merged submissions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 20 && (
              <button
                type="button"
                onClick={() => setShowAllHistory((prev) => !prev)}
                className="px-4 py-2 rounded-full border border-zinc-800 text-xs uppercase tracking-[0.2em] text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
              >
                {showAllHistory ? "Show Recent" : "Show All"}
              </button>
            )}
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] text-red-400 border border-red-900/40 hover:bg-red-900/20"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-zinc-500 mt-4">
            No merged submissions yet. New merges will appear here.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {visibleHistory.map((entry) => {
              const mergedLabel = entry.mergedAt
                ? new Date(entry.mergedAt).toLocaleString()
                : "";
              const createdLabel = entry.created
                ? new Date(entry.created).toLocaleString()
                : "";
              return (
                <div
                  key={entry.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl soft-card soft-card-subtle border-zinc-700/60"
                >
                  <div className="space-y-1">
                    <p className="text-sm text-white font-semibold">
                      {entry.name}
                      {entry.email ? (
                        <span className="text-xs text-zinc-500 ml-2">
                          {entry.email}
                        </span>
                      ) : null}
                      {entry.league && (
                        <span
                          className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${
                            entry.league === "jr"
                              ? "bg-purple-500/20 text-purple-200 border border-purple-500/30"
                              : "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                          }`}
                        >
                          {entry.league === "jr" ? "JR" : "Main"}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Banished:{" "}
                      <span className="text-zinc-200">
                        {entry.weeklyBanished || "None"}
                      </span>{" "}
                      · Murdered:{" "}
                      <span className="text-zinc-200">
                        {entry.weeklyMurdered || "None"}
                      </span>
                    </p>
                    <p className="text-[11px] text-zinc-500 uppercase tracking-[0.16em]">
                      {createdLabel
                        ? `Submitted ${createdLabel}`
                        : "Submitted"}
                      {mergedLabel ? ` · Merged ${mergedLabel}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-10">
        <div className="glass-panel py-6 px-12 rounded-2xl">
          <h3 className="text-xl gothic-font text-[color:var(--accent)] mb-4">League Roster</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {gameState.players.map((player) => {
              const edit = inlineEdits[player.id] ?? buildInlineEdit(player);
              return (
                <React.Fragment key={player.id}>
                  <div
                    className={`flex justify-between items-center p-3 rounded-2xl soft-card soft-card-subtle transition-all cursor-pointer ${selectedPlayer?.id === player.id ? 'bg-[#D4AF37]/10 border-[#D4AF37]' : 'border-zinc-700/60 hover:border-zinc-600'}`}
                    onClick={() => setSelectedPlayer(player)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full border border-[#D4AF37]/30 overflow-hidden bg-black flex-shrink-0 flex items-center justify-center">
                        {player.portraitUrl ? (
                          <img src={player.portraitUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-zinc-600 font-bold uppercase text-sm">{player.name.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-100 font-bold text-base">{player.name}</p>
                        <p className="text-xs text-gray-500">{player.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateGameState({ ...gameState, players: gameState.players.filter(p => p.id !== player.id) });
                          if (selectedPlayer?.id === player.id) setSelectedPlayer(null);
                        }}
                        className="text-red-500 hover:bg-red-900/20 p-2 rounded text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div
                    className="mt-2 mb-4 rounded-2xl soft-card soft-card-subtle border-zinc-700/50 p-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={edit.name}
                        onChange={(e) => updateInlineEdit(player, { name: e.target.value })}
                        className="w-full p-2 rounded-lg field-soft text-xs text-white"
                        placeholder="Name"
                      />
                      <input
                        type="email"
                        value={edit.email}
                        onChange={(e) => updateInlineEdit(player, { email: e.target.value })}
                        className="w-full p-2 rounded-lg field-soft text-xs text-white"
                        placeholder="Email"
                      />
                      <select
                        value={edit.weeklyBanished}
                        onChange={(e) => updateInlineEdit(player, { weeklyBanished: e.target.value })}
                        className="w-full p-2 rounded-lg field-soft text-xs text-white"
                      >
                        <option value="">Next Banished</option>
                        {BANISHED_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <select
                        value={edit.weeklyMurdered}
                        onChange={(e) => updateInlineEdit(player, { weeklyMurdered: e.target.value })}
                        className="w-full p-2 rounded-lg field-soft text-xs text-white"
                      >
                        <option value="">Next Murdered</option>
                        {MURDER_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          saveInlineEdit(player);
                        }}
                        className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold bg-[color:var(--accent)] text-black hover:bg-[color:var(--accent-strong)] transition-all"
                      >
                        Save Row
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {gameState.players.length === 0 && <p className="text-gray-500 text-center py-4 text-xs">No entries yet.</p>}
          </div>
          
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <h4 className="text-sm font-semibold text-[color:var(--accent)] mb-3 uppercase tracking-[0.25em]">Add Player</h4>
            <textarea 
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              className="w-full h-28 field-soft p-4 rounded-2xl text-xs font-mono text-zinc-400 focus:border-[#D4AF37] outline-none"
              placeholder="Paste submission text or spreadsheet rows here..."
            />
            <button onClick={parseAndAdd} className="w-full mt-2 py-2 bg-[color:var(--accent)] text-black text-xs font-bold rounded-full uppercase hover:bg-[color:var(--accent-strong)] transition-all">
              Add Player
            </button>
            {msg.text && (
              <div className={`mt-4 p-3 rounded-2xl text-center text-xs font-bold border ${msg.type === 'success' ? 'text-green-500 border-green-900/30 bg-green-900/10' : 'text-red-500 border-red-900/30 bg-red-900/10'}`}>
                {msg.text}
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel py-6 px-12 rounded-2xl min-h-[400px]">
          {selectedPlayer ? (
            <div className="space-y-6">
              <div className="border-b border-zinc-800 pb-4 flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border border-[#D4AF37] overflow-hidden bg-zinc-900 flex items-center justify-center">
                      {selectedPlayer.portraitUrl ? (
                        <img src={selectedPlayer.portraitUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-base text-zinc-700 font-bold uppercase">{selectedPlayer.name.charAt(0)}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-3xl gothic-font text-[color:var(--accent)]">{selectedPlayer.name}</h3>
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={async () => {
                          const url = await requestPrompt(
                            "Enter image URL for player avatar:",
                            selectedPlayer.portraitUrl || ""
                          );
                          if (url !== null) updatePlayerAvatar(selectedPlayer.id, url);
                        }}
                        className="text-xs uppercase font-semibold text-zinc-500 border border-zinc-800 px-3 py-1.5 rounded-full hover:text-white transition-all"
                      >
                        Set URL
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedPlayer(null)} className="text-zinc-600 hover:text-white text-xl">&times;</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-red-900/10 border border-red-900/20 rounded">
                  <p className="text-xs text-red-400 font-bold uppercase mb-1">💀 1st Out</p>
                  <p className="text-base text-white">{selectedPlayer.predFirstOut || 'None'}</p>
                </div>
                <div className="p-3 bg-yellow-900/10 border border-yellow-900/20 rounded">
                  <p className="text-xs text-yellow-400 font-bold uppercase mb-1">🏆 Winner</p>
                  <p className="text-base text-white">{selectedPlayer.predWinner || 'None'}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl soft-card soft-card-subtle border-zinc-700/60">
                <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-3">Edit Player</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 font-semibold mb-2 uppercase tracking-[0.18em]">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editPlayerName}
                      onChange={(e) => setEditPlayerName(e.target.value)}
                      className="w-full p-3.5 rounded-xl field-soft text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 font-semibold mb-2 uppercase tracking-[0.18em]">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editPlayerEmail}
                      onChange={(e) => setEditPlayerEmail(e.target.value)}
                      className="w-full p-3.5 rounded-xl field-soft text-sm text-white"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={savePlayerEdits}
                    className="px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] font-bold bg-[color:var(--accent)] text-black hover:bg-[color:var(--accent-strong)] transition-all"
                  >
                    Save Player
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded">
                  <p className="text-xs text-red-400 font-bold uppercase mb-1">⚖️ Next Banished</p>
                  <p className="text-base text-white">{selectedPlayer.weeklyPredictions?.nextBanished || 'None'}</p>
                </div>
                <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded">
                  <p className="text-xs text-fuchsia-300 font-bold uppercase mb-1">🗡️ Next Murdered</p>
                  <p className="text-base text-white">{selectedPlayer.weeklyPredictions?.nextMurdered || 'None'}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl soft-card soft-card-subtle border-zinc-700/60">
                <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-3">Edit {COUNCIL_LABELS.weekly}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-red-400 font-semibold mb-2 uppercase tracking-[0.18em]">
                      ⚖️ Next Banished
                    </label>
                    <select
                      value={editWeeklyBanished}
                      onChange={(e) => setEditWeeklyBanished(e.target.value)}
                      className="w-full p-3.5 rounded-xl field-soft text-sm text-white"
                    >
                      <option value="">Select...</option>
                      {CAST_NAMES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-fuchsia-400 font-semibold mb-2 uppercase tracking-[0.18em]">
                      🗡️ Next Murdered
                    </label>
                    <select
                      value={editWeeklyMurdered}
                      onChange={(e) => setEditWeeklyMurdered(e.target.value)}
                      className="w-full p-3.5 rounded-xl field-soft text-sm text-white"
                    >
                      <option value="">Select...</option>
                      {CAST_NAMES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={saveWeeklyEdits}
                    className="px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] font-bold bg-[color:var(--accent)] text-black hover:bg-[color:var(--accent-strong)] transition-all"
                  >
                    Save Weekly Vote
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm text-zinc-500 font-bold mb-4 uppercase tracking-widest border-b border-zinc-800 pb-2">Draft Squad</p>
                <div className="grid grid-cols-1 gap-2">
                  {selectedPlayer.picks.map((pick, i) => (
                    <div key={i} className="flex justify-between items-center text-sm p-3 bg-zinc-900/40 border border-zinc-800 rounded-2xl">
                      <span className="text-zinc-500 font-bold w-6">#{i+1}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center text-xs text-zinc-600 font-bold uppercase">
                          {getCastPortraitSrc(pick.member, gameState.castStatus[pick.member]?.portraitUrl) ? (
                            <img src={getCastPortraitSrc(pick.member, gameState.castStatus[pick.member]?.portraitUrl)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            pick.member.charAt(0)
                          )}
                        </div>
                        <span className="text-zinc-200">{pick.member}</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${pick.role === 'Traitor' ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}`}>
                        {pick.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
               <div className="wax-seal mb-4">
                  <span className="gothic-font text-2xl text-[#b04a4a] font-black">T</span>
                </div>
               <p className="text-xs gothic-font uppercase tracking-[0.3em] text-[color:var(--accent)]">Select a player</p>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel py-6 px-12 rounded-2xl mt-12">
        <h3 className="text-2xl gothic-font text-[color:var(--accent)] mb-8">Cast Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4 md:gap-6 lg:gap-8">
          {CAST_NAMES.map(name => {
            const status = gameState.castStatus[name] ?? defaultStatus;
            const portraitSrc = getCastPortraitSrc(name, status?.portraitUrl);
            const cardClass = status.isWinner
              ? "bg-black/75 border-lime-300/70 shadow-[0_0_24px_rgba(163,230,53,0.45)]"
              : status.isFirstOut
              ? "bg-black/75 border-amber-300/70 shadow-[0_0_24px_rgba(251,191,36,0.45)]"
              : status.isEliminated
              ? "bg-black/80 border-red-600/70 shadow-[0_0_24px_rgba(239,68,68,0.45)]"
              : status.isTraitor
              ? "bg-black/80 border-fuchsia-400/70 shadow-[0_0_24px_rgba(232,121,249,0.45)]"
              : "bg-black/70 border-zinc-800";
            return (
              <div key={name} className={`p-4 rounded-2xl soft-card space-y-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${cardClass}`}>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCastPortrait(name)}
                    className="w-[22px] h-[22px] rounded-full overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0 relative group"
                    title="Set cast portrait"
                  >
                    {portraitSrc ? (
                      <img src={portraitSrc} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-700 font-bold uppercase">
                        {name.charAt(0)}
                      </div>
                    )}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white truncate">{name}</p>
                    <button
                      type="button"
                      onClick={() => setCastPortrait(name)}
                      className="text-xs uppercase font-semibold text-zinc-500 hover:text-zinc-200 transition-all"
                    >
                      Set Portrait
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 place-items-center">
                  <button 
                    onClick={() => updateCastMember(name, 'isTraitor', !status?.isTraitor)}
                    className={`w-[150px] px-6 py-3 rounded-full text-sm font-semibold uppercase border transition-all flex items-center justify-center gap-1 ${
                      status?.isTraitor
                        ? 'bg-[#FF2D55] border-2 border-[#FF2D55] text-black shadow-[0_0_26px_rgba(255,45,85,0.85)] scale-[1.04]'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {status?.isTraitor && <span className="text-xs">✓</span>}
                    Traitor
                  </button>
                  <button 
                    onClick={() => updateCastMember(name, 'isEliminated', !status?.isEliminated)}
                    className={`w-[150px] px-6 py-3 rounded-full text-sm font-semibold uppercase border transition-all flex items-center justify-center gap-1 ${
                      status?.isEliminated
                        ? 'bg-[#4CC9F0] border-2 border-[#4CC9F0] text-black shadow-[0_0_26px_rgba(76,201,240,0.85)] scale-[1.04]'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {status?.isEliminated && <span className="text-xs">✓</span>}
                    Eliminated
                  </button>
                  <button 
                    onClick={() => updateCastMember(name, 'isFirstOut', !status?.isFirstOut)}
                    className={`w-[150px] px-6 py-3 rounded-full text-sm font-semibold uppercase border transition-all flex items-center justify-center gap-1 ${
                      status?.isFirstOut
                        ? 'bg-[#FF9F1C] border-2 border-[#FF9F1C] text-black shadow-[0_0_26px_rgba(255,159,28,0.85)] scale-[1.04]'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {status?.isFirstOut && <span className="text-xs">✓</span>}
                    1st Out
                  </button>
                  <button 
                    onClick={() => updateCastMember(name, 'isWinner', !status?.isWinner)}
                    className={`w-[150px] px-6 py-3 rounded-full text-sm font-semibold uppercase border transition-all flex items-center justify-center gap-1 ${
                      status?.isWinner
                        ? 'bg-[#2ECC71] border-2 border-[#2ECC71] text-black shadow-[0_0_26px_rgba(46,204,113,0.85)] scale-[1.04]'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {status?.isWinner && <span className="text-xs">✓</span>}
                    Winner
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-6 space-y-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <p className="text-sm text-zinc-200 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] border border-zinc-700 text-zinc-300"
                onClick={() => {
                  confirmDialog.resolve(false);
                  setConfirmDialog(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] bg-[color:var(--accent)] text-black font-bold"
                onClick={() => {
                  confirmDialog.resolve(true);
                  setConfirmDialog(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {promptDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-6 space-y-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <label className="block text-sm text-zinc-200">{promptDialog.title}</label>
            <input
              autoFocus
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="w-full p-3 rounded-xl field-soft text-sm text-white"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] border border-zinc-700 text-zinc-300"
                onClick={() => {
                  promptDialog.resolve(null);
                  setPromptDialog(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] bg-[color:var(--accent)] text-black font-bold"
                onClick={() => {
                  promptDialog.resolve(promptValue);
                  setPromptDialog(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminPanel;
