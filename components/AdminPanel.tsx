import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BonusGamePredictions,
  BonusPointBreakdownEntry,
  GameState,
  CAST_NAMES,
  COUNCIL_LABELS,
  PlayerEntry,
  DraftPick,
  WeeklySubmissionHistoryEntry,
  WeeklyScoreSnapshot,
} from '../types';
import { calculatePlayerScore } from "../src/utils/scoring";
import { pocketbaseUrl } from "../src/lib/pocketbase";
import { LIMITS } from "../src/utils/scoringConstants";
import {
  deleteSubmission,
  fetchWeeklySubmissions,
  savePlayerPortrait,
  SubmissionRecord,
  subscribeToWeeklySubmissions,
} from '../services/pocketbase';
import AdminWorkspaceHeader from './admin/AdminWorkspaceHeader';
import OperationsSection from './admin/OperationsSection';
import SubmissionsSection from './admin/SubmissionsSection';
import RosterSection from './admin/RosterSection';
import CastSection from './admin/CastSection';
import DatabaseSection from './admin/DatabaseSection';
import { AdminSection, AdminSectionTab, InlineEditMap } from './admin/types';

interface AdminPanelProps {
  gameState: GameState;
  updateGameState: (
    state: GameState | ((prevState: GameState) => GameState)
  ) => void;
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
  const activeCastNames = CAST_NAMES.filter(
    (name) => !gameState.castStatus[name]?.isEliminated
  );
  const BANISHED_OPTIONS = activeCastNames;
  const MURDER_OPTIONS = ["No Murder", ...activeCastNames];
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
  const [inlineEdits, setInlineEdits] = useState<InlineEditMap>({});
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("operations");
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
    const league = payload?.league || submission.league;
    return league === "jr" ? "jr" : "main";
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
  const normalizeSubmissionBonusGames = (
    submission: SubmissionRecord
  ): BonusGamePredictions | undefined => {
    const bonusGames = getSubmissionBonusGames(submission);
    const redemptionRoulette =
      typeof bonusGames?.redemptionRoulette === "string"
        ? bonusGames.redemptionRoulette.trim()
        : "";
    const shieldGambit =
      typeof bonusGames?.shieldGambit === "string"
        ? bonusGames.shieldGambit.trim()
        : "";
    const traitorTrio = Array.isArray(bonusGames?.traitorTrio)
      ? bonusGames.traitorTrio
          .map((name) => (typeof name === "string" ? name.trim() : ""))
          .filter(Boolean)
      : [];
    const normalized: BonusGamePredictions = {};
    if (redemptionRoulette) normalized.redemptionRoulette = redemptionRoulette;
    if (typeof bonusGames?.doubleOrNothing === "boolean") {
      normalized.doubleOrNothing = bonusGames.doubleOrNothing;
    }
    if (shieldGambit) normalized.shieldGambit = shieldGambit;
    if (traitorTrio.length > 0) normalized.traitorTrio = traitorTrio;
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  };
  const getSubmissionPlayerId = (submission: SubmissionRecord) => {
    const payload = submission.payload as { playerId?: string } | undefined;
    return payload?.playerId ?? null;
  };

  const isWeeklySubmissionRecord = (submission: SubmissionRecord) => {
    const kind = String(submission.kind ?? "").trim().toLowerCase();
    if (kind === "weekly") return true;
    if (submission.weeklyBanished?.trim()) return true;
    if (submission.weeklyMurdered?.trim()) return true;
    return Boolean(getSubmissionBonusGames(submission));
  };
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
    return merged.slice(0, LIMITS.HISTORY_LIMIT);
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

  type SubmissionBonusScore = {
    hasResults: boolean;
    points: number;
    breakdown: BonusPointBreakdownEntry[];
  };

  const getSubmissionBonusScore = (
    submission: SubmissionRecord,
    players: PlayerEntry[]
  ): SubmissionBonusScore => {
    const bonusResults = gameStateRef.current.weeklyResults?.bonusGames;
    const hasBonusResults = Boolean(
      bonusResults?.redemptionRoulette ||
        bonusResults?.shieldGambit ||
        (Array.isArray(bonusResults?.traitorTrio) &&
          bonusResults.traitorTrio.length > 0)
    );

    if (!hasBonusResults) {
      return { hasResults: false, points: 0, breakdown: [] };
    }

    const league = getSubmissionLeague(submission);
    const match = findPlayerMatch(players, submission, league);
    const normalizedBonusGames = normalizeSubmissionBonusGames(submission);
    const basePlayer: PlayerEntry = match
      ? players[match.index]
      : {
          id: `submission-${submission.id}`,
          name: submission.name || "",
          email: submission.email || "",
          league,
          picks: [],
          predFirstOut: "",
          predWinner: "",
          predTraitors: [],
        };

    const scoringPlayer: PlayerEntry = {
      ...basePlayer,
      name: submission.name || basePlayer.name,
      email: submission.email || basePlayer.email,
      weeklyPredictions: {
        nextBanished: submission.weeklyBanished || "",
        nextMurdered: submission.weeklyMurdered || "",
        bonusGames: {
          redemptionRoulette: normalizedBonusGames?.redemptionRoulette || "",
          doubleOrNothing: Boolean(normalizedBonusGames?.doubleOrNothing),
          shieldGambit: normalizedBonusGames?.shieldGambit || "",
          traitorTrio: normalizedBonusGames?.traitorTrio ?? [],
        },
      },
    };

    const scored = calculatePlayerScore(gameStateRef.current, scoringPlayer);
    const breakdown: BonusPointBreakdownEntry[] = scored.breakdown.bonusGames.map(
      (item) => ({
        label: item.label,
        result: item.result,
        points: item.points,
      })
    );
    const points = breakdown.reduce((sum, item) => sum + item.points, 0);

    return { hasResults: true, points, breakdown };
  };

  const buildHistoryEntry = (
    submission: SubmissionRecord,
    players: PlayerEntry[]
  ): WeeklySubmissionHistoryEntry => {
    const bonusScore = getSubmissionBonusScore(submission, players);
    return {
      id: submission.id,
      name: submission.name || "",
      email: submission.email || "",
      weeklyBanished: submission.weeklyBanished || "",
      weeklyMurdered: submission.weeklyMurdered || "",
      bonusGames: normalizeSubmissionBonusGames(submission),
      bonusPoints: bonusScore.hasResults ? bonusScore.points : undefined,
      bonusPointBreakdown: bonusScore.hasResults
        ? bonusScore.breakdown
        : undefined,
      league: getSubmissionLeague(submission),
      created: submission.created,
      mergedAt: new Date().toISOString(),
    };
  };

  const refreshSubmissions = useCallback(async () => {
    setIsLoadingSubmissions(true);
    setSubmissionsError(null);
    try {
      let records = await fetchWeeklySubmissions();
      if (records.length === 0) {
        try {
          const response = await fetch(
            `${pocketbaseUrl}/api/collections/submissions/records?perPage=200&sort=-created`
          );
          if (response.ok) {
            const data = (await response.json()) as { items?: SubmissionRecord[] };
            if (Array.isArray(data.items)) {
              records = data.items.filter((submission) => isWeeklySubmissionRecord(submission));
            }
          }
        } catch (fallbackError) {
          console.warn("Fallback submissions fetch failed:", fallbackError);
        }
      }
      setSubmissions(records);
    } catch (error: any) {
      setSubmissionsError(error?.message || String(error));
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, []);

  useEffect(() => {
    refreshSubmissions();
    const unsubscribe = subscribeToWeeklySubmissions((submission) => {
      setSubmissions((prev) =>
        prev.some((existing) => existing.id === submission.id)
          ? prev
          : [submission, ...prev]
      );
    });
    return () => {
      unsubscribe?.();
    };
  }, [refreshSubmissions]);

  useEffect(() => {
    const pollInterval = window.setInterval(() => {
      refreshSubmissions();
    }, 30000);
    return () => {
      window.clearInterval(pollInterval);
    };
  }, [refreshSubmissions]);

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
  }, [selectedPlayer]);

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
    updateGameState((prevState) => {
      const updatedStatus = { ...prevState.castStatus };
      const currentStatus = updatedStatus[name] ?? defaultStatus;
      updatedStatus[name] = { ...currentStatus, [field]: value };
      if (field === 'isFirstOut' && value === true) updatedStatus[name].isWinner = false;
      if (field === 'isWinner' && value === true) updatedStatus[name].isFirstOut = false;
      return { ...prevState, castStatus: updatedStatus };
    });
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
    const normalizedBonusGames = normalizeSubmissionBonusGames(submission);
    const incomingBanished = normalizeEmpty(submission.weeklyBanished);
    const incomingMurdered = normalizeEmpty(submission.weeklyMurdered);
    const incomingBonusGames = {
      redemptionRoulette: normalizedBonusGames?.redemptionRoulette,
      doubleOrNothing: normalizedBonusGames?.doubleOrNothing,
      shieldGambit: normalizedBonusGames?.shieldGambit,
      traitorTrio: normalizedBonusGames?.traitorTrio,
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
    const historyEntry = buildHistoryEntry(submission, currentState.players);
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
      const historyEntry = buildHistoryEntry(submission, updatedPlayers);
      const result = applySubmissionToPlayers(updatedPlayers, submission);
      if (result.matched) {
        updatedPlayers = result.players;
        mergedIds.push(submission.id);
        historyAdds.push(historyEntry);
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
  const visibleHistory = showAllHistory ? history : history.slice(0, LIMITS.HISTORY_DEFAULT_DISPLAY);

  const scoreHistory: WeeklyScoreSnapshot[] = Array.isArray(
    gameState.weeklyScoreHistory
  )
    ? gameState.weeklyScoreHistory
    : [];
  const visibleScoreHistory = showAllScoreHistory
    ? scoreHistory
    : scoreHistory.slice(-LIMITS.SCORE_HISTORY_DEFAULT_DISPLAY);

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
    const nextHistory = [...scoreHistory, snapshot].slice(-LIMITS.SCORE_HISTORY_LIMIT);
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

  const sectionTabs: AdminSectionTab[] = [
    { id: "operations", label: "Operations", summary: "Weekly outcomes and score archives" },
    { id: "submissions", label: "Submissions", summary: "Incoming weekly votes and merge history" },
    { id: "roster", label: "Roster", summary: "Players, edits, and manual intake" },
    { id: "cast", label: "Cast", summary: "Status and portrait controls" },
    { id: "database", label: "Database", summary: "Backups and raw JSON tools" },
  ];

  const saveStatus = lastWriteError
    ? `Save failed: ${lastWriteError}`
    : lastSavedAt
    ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
    : "Not saved yet";

  const renderOperationsSection = () => (
    <OperationsSection
      banishedOptions={BANISHED_OPTIONS}
      murderOptions={MURDER_OPTIONS}
      activeCastNames={activeCastNames}
      nextBanished={gameState.weeklyResults?.nextBanished ?? ""}
      nextMurdered={gameState.weeklyResults?.nextMurdered ?? ""}
      bonusResults={bonusResults}
      onSetNextBanished={(value) =>
        updateGameState((prevState) => ({
          ...prevState,
          weeklyResults: {
            ...(prevState.weeklyResults ?? {}),
            nextBanished: value,
          },
        }))
      }
      onSetNextMurdered={(value) =>
        updateGameState((prevState) => ({
          ...prevState,
          weeklyResults: {
            ...(prevState.weeklyResults ?? {}),
            nextMurdered: value,
          },
        }))
      }
      onUpdateBonusResult={updateBonusResult}
      scoreHistory={scoreHistory}
      visibleScoreHistory={visibleScoreHistory}
      showAllScoreHistory={showAllScoreHistory}
      onToggleShowAllScoreHistory={() => setShowAllScoreHistory((prev) => !prev)}
      onArchiveWeeklyScores={archiveWeeklyScores}
      getScoreTopper={getScoreTopper}
    />
  );

  const renderSubmissionsSection = () => (
    <SubmissionsSection
      pocketbaseUrl={pocketbaseUrl}
      players={gameState.players}
      submissions={submissions}
      isLoadingSubmissions={isLoadingSubmissions}
      submissionsError={submissionsError}
      onRefreshSubmissions={refreshSubmissions}
      onMergeAllSubmissions={mergeAllSubmissions}
      mergeAllDisabled={submissions.length === 0}
      getSubmissionLeague={getSubmissionLeague}
      getSubmissionBonusGames={normalizeSubmissionBonusGames}
      getSubmissionBonusScore={(submission) =>
        getSubmissionBonusScore(submission, gameState.players)
      }
      findPlayerMatch={findPlayerMatch}
      onMergeSubmission={(submission) => {
        void mergeSubmissionRecord(submission);
      }}
      onDismissSubmission={(submission) => {
        void dismissSubmission(submission);
      }}
      history={history}
      visibleHistory={visibleHistory}
      showAllHistory={showAllHistory}
      canToggleShowAllHistory={history.length > LIMITS.HISTORY_DEFAULT_DISPLAY}
      onToggleShowAllHistory={() => setShowAllHistory((prev) => !prev)}
      onClearHistory={() => {
        void clearHistory();
      }}
    />
  );

  const renderRosterSection = () => (
    <RosterSection
      players={gameState.players}
      selectedPlayer={selectedPlayer}
      onSelectPlayer={setSelectedPlayer}
      inlineEdits={inlineEdits}
      buildInlineEdit={buildInlineEdit}
      updateInlineEdit={updateInlineEdit}
      saveInlineEdit={saveInlineEdit}
      onDeletePlayer={(playerId) => {
        updateGameState({
          ...gameState,
          players: gameState.players.filter((p) => p.id !== playerId),
        });
        if (selectedPlayer?.id === playerId) setSelectedPlayer(null);
      }}
      banishedOptions={BANISHED_OPTIONS}
      murderOptions={MURDER_OPTIONS}
      pasteContent={pasteContent}
      onPasteContentChange={setPasteContent}
      onParseAndAdd={parseAndAdd}
      editPlayerName={editPlayerName}
      editPlayerEmail={editPlayerEmail}
      editWeeklyBanished={editWeeklyBanished}
      editWeeklyMurdered={editWeeklyMurdered}
      onEditPlayerNameChange={setEditPlayerName}
      onEditPlayerEmailChange={setEditPlayerEmail}
      onEditWeeklyBanishedChange={setEditWeeklyBanished}
      onEditWeeklyMurderedChange={setEditWeeklyMurdered}
      onSavePlayerEdits={savePlayerEdits}
      onSaveWeeklyEdits={saveWeeklyEdits}
      onOpenPlayerAvatarPrompt={() => {
        if (!selectedPlayer) return;
        void (async () => {
          const url = await requestPrompt(
            "Enter image URL for player avatar:",
            selectedPlayer.portraitUrl || ""
          );
          if (url !== null) updatePlayerAvatar(selectedPlayer.id, url);
        })();
      }}
      castStatus={gameState.castStatus}
    />
  );

  const renderCastSection = () => (
    <CastSection
      castNames={CAST_NAMES}
      castStatus={gameState.castStatus}
      defaultStatus={defaultStatus}
      onSetCastPortrait={(name) => {
        void setCastPortrait(name);
      }}
      onUpdateCastMember={(name, field, value) => updateCastMember(name, field, value)}
    />
  );

  const renderDatabaseSection = () => (
    <DatabaseSection
      saveStatus={saveStatus}
      onSaveNow={onSaveNow}
      onSignOut={onSignOut}
      onDownloadGameState={downloadGameState}
      onClearAllPortraits={() => {
        void clearAllPortraits();
      }}
      isManagingTome={isManagingTome}
      onToggleManagingTome={() => setIsManagingTome((prev) => !prev)}
      gameStateJson={JSON.stringify(gameState, null, 2)}
      onHandleTomeImport={handleTomeImport}
    />
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case "operations":
        return renderOperationsSection();
      case "submissions":
        return renderSubmissionsSection();
      case "roster":
        return renderRosterSection();
      case "cast":
        return renderCastSection();
      case "database":
        return renderDatabaseSection();
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-5">
      <AdminWorkspaceHeader
        saveStatus={saveStatus}
        playersCount={gameState.players.length}
        activeCastCount={activeCastNames.length}
        totalCastCount={CAST_NAMES.length}
        pendingVotes={submissions.length}
        sectionTabs={sectionTabs}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      {msg.text && (
        <div
          className={`soft-card rounded-2xl p-3 text-sm ${
            msg.type === "success"
              ? "border-[color:var(--success)]/50 text-[color:var(--success)]"
              : "border-[color:var(--danger)]/50 text-[color:var(--danger)]"
          }`}
        >
          {msg.text}
        </div>
      )}

      {renderActiveSection()}

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="soft-card w-full max-w-md rounded-2xl p-5 space-y-4">
            <p className="text-sm text-[color:var(--text)] leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary px-4 text-[11px]"
                onClick={() => {
                  confirmDialog.resolve(false);
                  setConfirmDialog(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-4 text-[11px]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="soft-card w-full max-w-md rounded-2xl p-5 space-y-4">
            <label className="block text-sm text-[color:var(--text)]">{promptDialog.title}</label>
            <input
              autoFocus
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="field-soft w-full p-3 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary px-4 text-[11px]"
                onClick={() => {
                  promptDialog.resolve(null);
                  setPromptDialog(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-4 text-[11px]"
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
  );
};

export default AdminPanel;
