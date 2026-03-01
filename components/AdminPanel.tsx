import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BonusGamePredictions,
  BonusPointBreakdownEntry,
  GameState,
  FinalePredictions,
  CAST_NAMES,
  COUNCIL_LABELS,
  inferActiveWeekId,
  normalizeWeekId,
  PlayerEntry,
  ScoreAdjustment,
  SeasonConfig,
  ShowConfig,
  UiVariant,
  DraftPick,
  WeeklySubmissionHistoryEntry,
  WeeklyScoreSnapshot,
} from '../types';
import { calculatePlayerScore } from "../src/utils/scoring";
import { pocketbaseUrl } from "../src/lib/pocketbase";
import { LIMITS } from "../src/utils/scoringConstants";
import { logger } from "../src/utils/logger";
import { RULE_PACKS } from "../src/config/rulePacks";
import {
  archiveSeason,
  cloneSeason,
  createSeason,
  createScoreAdjustment,
  deleteScoreAdjustment,
  deleteSubmission,
  fetchSeasonState,
  fetchWeeklySubmissions,
  finalizeSeason,
  listSeasons as listSeasonRecords,
  listScoreAdjustments,
  markSubmissionMerged,
  markSubmissionSkipped,
  normalizeEmail,
  saveSeasonState,
  saveShowConfig,
  savePlayerPortrait,
  SubmissionRecord,
  subscribeToWeeklySubmissions,
} from "../services/pocketbase";
import {
  PremiumCard,
  PremiumPanelHeader,
  PremiumStatusBadge,
  PremiumTabs,
} from "../src/ui/premium";
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
  showConfig?: ShowConfig;
  seasonConfig?: SeasonConfig;
  seasons?: SeasonConfig[];
  activeSeasonId?: string | null;
  onSeasonChange?: (seasonId: string) => void;
  uiVariant: UiVariant;
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
  showConfig,
  seasonConfig,
  seasons = [],
  activeSeasonId,
  onSeasonChange,
  uiVariant,
}) => {
  const isPremiumUi = uiVariant === "premium";
  const castNames = Array.from(
    new Set([
      ...(showConfig?.castNames ?? []),
      ...Object.keys(gameState.castStatus || {}),
      ...CAST_NAMES,
    ])
  ).sort((a, b) => a.localeCompare(b));
  const activeCastNames = castNames.filter(
    (name) => !gameState.castStatus[name]?.isEliminated
  );
  const defaultFinaleLabel =
    showConfig?.terminology?.finaleLabelDefault || "Finale Gauntlet";
  const defaultFinaleLockAt = new Date(
    Date.now() + 24 * 60 * 60 * 1000
  ).toISOString();
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
  const [scoreAdjustments, setScoreAdjustments] = useState<ScoreAdjustment[]>(
    Array.isArray(gameState.scoreAdjustments) ? gameState.scoreAdjustments : []
  );
  const [newAdjustmentPlayerId, setNewAdjustmentPlayerId] = useState("");
  const [newAdjustmentPoints, setNewAdjustmentPoints] = useState("");
  const [newAdjustmentReason, setNewAdjustmentReason] = useState("");
  const [newAdjustmentWeekId, setNewAdjustmentWeekId] = useState("");
  const [seasonRecords, setSeasonRecords] = useState<SeasonConfig[]>(seasons);
  const [newSeasonId, setNewSeasonId] = useState("");
  const [newSeasonLabel, setNewSeasonLabel] = useState("");
  const [newSeasonTimezone, setNewSeasonTimezone] = useState("America/New_York");
  const [newSeasonRulePackId, setNewSeasonRulePackId] = useState("traitors-classic");
  const [newSeasonCastInput, setNewSeasonCastInput] = useState("");
  const [newSeasonDraftLockAt, setNewSeasonDraftLockAt] = useState("");
  const [newSeasonWeeklyLockAt, setNewSeasonWeeklyLockAt] = useState("");
  const [newSeasonFinaleLockAt, setNewSeasonFinaleLockAt] = useState("");
  const [cloneSeasonId, setCloneSeasonId] = useState("");
  const [showNameInput, setShowNameInput] = useState(
    showConfig?.showName || gameState.showConfig?.showName || ""
  );
  const [showShortNameInput, setShowShortNameInput] = useState(
    showConfig?.shortName || gameState.showConfig?.shortName || ""
  );
  const [showHeaderKickerInput, setShowHeaderKickerInput] = useState(
    showConfig?.branding?.headerKicker || gameState.showConfig?.branding?.headerKicker || ""
  );
  const [showAppTitleInput, setShowAppTitleInput] = useState(
    showConfig?.branding?.appTitle || gameState.showConfig?.branding?.appTitle || ""
  );
  const [showFooterCopyInput, setShowFooterCopyInput] = useState(
    showConfig?.branding?.footerCopy || gameState.showConfig?.branding?.footerCopy || ""
  );
  const [weeklyLabelInput, setWeeklyLabelInput] = useState(
    showConfig?.terminology?.weeklyCouncilLabel ||
      gameState.showConfig?.terminology?.weeklyCouncilLabel ||
      ""
  );
  const [jrLabelInput, setJrLabelInput] = useState(
    showConfig?.terminology?.jrCouncilLabel ||
      gameState.showConfig?.terminology?.jrCouncilLabel ||
      ""
  );
  const [draftLabelInput, setDraftLabelInput] = useState(
    showConfig?.terminology?.draftLabel ||
      gameState.showConfig?.terminology?.draftLabel ||
      ""
  );
  const [leaderboardLabelInput, setLeaderboardLabelInput] = useState(
    showConfig?.terminology?.leaderboardLabel ||
      gameState.showConfig?.terminology?.leaderboardLabel ||
      ""
  );
  const [adminLabelInput, setAdminLabelInput] = useState(
    showConfig?.terminology?.adminLabel ||
      gameState.showConfig?.terminology?.adminLabel ||
      ""
  );
  const [finaleLabelInput, setFinaleLabelInput] = useState(
    showConfig?.terminology?.finaleLabelDefault ||
      gameState.showConfig?.terminology?.finaleLabelDefault ||
      ""
  );
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (Array.isArray(gameState.scoreAdjustments)) {
      setScoreAdjustments(gameState.scoreAdjustments);
    }
  }, [gameState.scoreAdjustments]);

  useEffect(() => {
    setSeasonRecords(seasons);
  }, [seasons]);

  useEffect(() => {
    const source = showConfig ?? gameState.showConfig;
    if (!source) return;
    setShowNameInput(source.showName || "");
    setShowShortNameInput(source.shortName || "");
    setShowHeaderKickerInput(source.branding?.headerKicker || "");
    setShowAppTitleInput(source.branding?.appTitle || "");
    setShowFooterCopyInput(source.branding?.footerCopy || "");
    setWeeklyLabelInput(source.terminology?.weeklyCouncilLabel || "");
    setJrLabelInput(source.terminology?.jrCouncilLabel || "");
    setDraftLabelInput(source.terminology?.draftLabel || "");
    setLeaderboardLabelInput(source.terminology?.leaderboardLabel || "");
    setAdminLabelInput(source.terminology?.adminLabel || "");
    setFinaleLabelInput(source.terminology?.finaleLabelDefault || "");
  }, [showConfig, gameState.showConfig]);

  useEffect(() => {
    let cancelled = false;
    listSeasonRecords()
      .then((records) => {
        if (cancelled) return;
        if (Array.isArray(records) && records.length > 0) {
          setSeasonRecords(records);
        }
      })
      .catch((error) => logger.warn("Failed to refresh season records:", error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const seasonId = gameState.seasonId || seasonConfig?.seasonId;
    if (!seasonId) return;
    let cancelled = false;
    listScoreAdjustments(seasonId)
      .then((records) => {
        if (cancelled) return;
        if (!Array.isArray(records)) return;
        setScoreAdjustments(records);
        updateGameState((prev) => ({
          ...prev,
          scoreAdjustments: records,
        }));
      })
      .catch((error) => {
        logger.warn("Failed to load score adjustments:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [gameState.seasonId, seasonConfig?.seasonId, updateGameState]);

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
  const getActiveWeekId = () => inferActiveWeekId(gameStateRef.current);
  const createEmptyWeeklyResults = (weekId: string) => ({
    weekId,
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
      finalPotValue: null,
    },
  });
  const hasWeeklyPredictionContent = (
    weeklyPredictions?: PlayerEntry["weeklyPredictions"] | null
  ) => {
    if (!weeklyPredictions) return false;
    if (
      typeof weeklyPredictions.nextBanished === "string" &&
      weeklyPredictions.nextBanished.trim()
    ) {
      return true;
    }
    if (
      typeof weeklyPredictions.nextMurdered === "string" &&
      weeklyPredictions.nextMurdered.trim()
    ) {
      return true;
    }
    const finale = weeklyPredictions.finalePredictions;
    if (typeof finale?.finalWinner === "string" && finale.finalWinner.trim()) {
      return true;
    }
    if (
      typeof finale?.lastFaithfulStanding === "string" &&
      finale.lastFaithfulStanding.trim()
    ) {
      return true;
    }
    if (
      typeof finale?.lastTraitorStanding === "string" &&
      finale.lastTraitorStanding.trim()
    ) {
      return true;
    }
    if (typeof finale?.finalPotEstimate === "number" && Number.isFinite(finale.finalPotEstimate)) {
      return true;
    }
    const bonus = weeklyPredictions.bonusGames;
    if (!bonus) return false;
    if (typeof bonus.redemptionRoulette === "string" && bonus.redemptionRoulette.trim()) {
      return true;
    }
    if (typeof bonus.shieldGambit === "string" && bonus.shieldGambit.trim()) {
      return true;
    }
    if (
      Array.isArray(bonus.traitorTrio) &&
      bonus.traitorTrio.some((pick) => typeof pick === "string" && pick.trim())
    ) {
      return true;
    }
    return Boolean(bonus.doubleOrNothing);
  };
  const getSubmissionWeekId = (submission: SubmissionRecord) => {
    const payload = submission.payload as
      | {
          weekId?: string;
          weeklyPredictions?: { weekId?: string };
        }
      | undefined;
    return normalizeWeekId(payload?.weekId ?? payload?.weeklyPredictions?.weekId);
  };
  const getActiveSeasonId = () =>
    normalizeWeekId(gameStateRef.current.seasonId) ??
    normalizeWeekId(seasonConfig?.seasonId) ??
    normalizeWeekId(activeSeasonId);
  const getSubmissionSeasonId = (submission: SubmissionRecord) => {
    const payload = submission.payload as { seasonId?: string } | undefined;
    return normalizeWeekId(submission.seasonId ?? payload?.seasonId);
  };
  const getCurrentWeekStartMs = () => {
    const history = Array.isArray(gameStateRef.current.weeklyScoreHistory)
      ? gameStateRef.current.weeklyScoreHistory
      : [];
    if (history.length === 0) return null;
    const last = history[history.length - 1];
    const createdAtMs = Date.parse(last.createdAt || "");
    return Number.isNaN(createdAtMs) ? null : createdAtMs;
  };
  const isSubmissionForActiveWeek = (submission: SubmissionRecord) => {
    const activeSeason = getActiveSeasonId();
    const submissionSeason = getSubmissionSeasonId(submission);
    if (activeSeason) {
      if (submissionSeason && submissionSeason !== activeSeason) return false;
      if (!submissionSeason && seasonRecords.length > 0) return false;
    }

    const activeWeekId = getActiveWeekId();
    const submissionWeekId = getSubmissionWeekId(submission);
    if (submissionWeekId) return submissionWeekId === activeWeekId;
    const currentWeekStartMs = getCurrentWeekStartMs();
    if (currentWeekStartMs === null) return true;
    const createdAtMs = Date.parse(submission.created || "");
    if (Number.isNaN(createdAtMs)) return false;
    return createdAtMs >= currentWeekStartMs;
  };
  const isSubmissionBeforeFinaleLock = (submission: SubmissionRecord) => {
    const finaleConfig = gameStateRef.current.finaleConfig;
    if (!finaleConfig?.enabled) return true;
    const lockAtMs = Date.parse(finaleConfig.lockAt || "");
    if (Number.isNaN(lockAtMs)) return true;
    const createdAtMs = Date.parse(submission.created || "");
    if (Number.isNaN(createdAtMs)) return false;
    return createdAtMs <= lockAtMs;
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
  const getSubmissionFinalePredictions = (submission: SubmissionRecord) => {
    const payload = submission.payload as
      | {
          finalePredictions?: FinalePredictions;
          weeklyPredictions?: {
            finalePredictions?: FinalePredictions;
          };
        }
      | undefined;
    return payload?.weeklyPredictions?.finalePredictions ?? payload?.finalePredictions;
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
  const normalizeSubmissionFinalePredictions = (
    submission: SubmissionRecord
  ): FinalePredictions | undefined => {
    const finalePredictions = getSubmissionFinalePredictions(submission);
    if (!finalePredictions) return undefined;
    const finalWinner =
      typeof finalePredictions.finalWinner === "string"
        ? finalePredictions.finalWinner.trim()
        : "";
    const lastFaithfulStanding =
      typeof finalePredictions.lastFaithfulStanding === "string"
        ? finalePredictions.lastFaithfulStanding.trim()
        : "";
    const lastTraitorStanding =
      typeof finalePredictions.lastTraitorStanding === "string"
        ? finalePredictions.lastTraitorStanding.trim()
        : "";
    const finalPotEstimate =
      typeof finalePredictions.finalPotEstimate === "number" &&
      Number.isFinite(finalePredictions.finalPotEstimate)
        ? finalePredictions.finalPotEstimate
        : null;
    if (
      !finalWinner &&
      !lastFaithfulStanding &&
      !lastTraitorStanding &&
      finalPotEstimate === null
    ) {
      return undefined;
    }
    return {
      finalWinner,
      lastFaithfulStanding,
      lastTraitorStanding,
      finalPotEstimate,
    };
  };
  const getSubmissionPlayerId = (submission: SubmissionRecord) => {
    const payload = submission.payload as { playerId?: string } | undefined;
    return payload?.playerId ?? null;
  };

  const isWeeklySubmissionRecord = (submission: SubmissionRecord) => {
    const kind = String(submission.kind ?? "").trim().toLowerCase();
    if (kind === "weekly") return true;
    if (kind) return false;
    if (submission.weeklyBanished?.trim()) return true;
    if (submission.weeklyMurdered?.trim()) return true;
    if (getSubmissionBonusGames(submission)) return true;
    return Boolean(getSubmissionFinalePredictions(submission));
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
    const normalizedFinalePredictions = normalizeSubmissionFinalePredictions(submission);
    const submissionWeekId = getSubmissionWeekId(submission) ?? getActiveWeekId();
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
        weekId: submissionWeekId,
        nextBanished: submission.weeklyBanished || "",
        nextMurdered: submission.weeklyMurdered || "",
        bonusGames: {
          redemptionRoulette: normalizedBonusGames?.redemptionRoulette || "",
          doubleOrNothing: Boolean(normalizedBonusGames?.doubleOrNothing),
          shieldGambit: normalizedBonusGames?.shieldGambit || "",
          traitorTrio: normalizedBonusGames?.traitorTrio ?? [],
        },
        finalePredictions: normalizedFinalePredictions,
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
      weekId: getSubmissionWeekId(submission) ?? getActiveWeekId(),
      weeklyBanished: submission.weeklyBanished || "",
      weeklyMurdered: submission.weeklyMurdered || "",
      bonusGames: normalizeSubmissionBonusGames(submission),
      finalePredictions: normalizeSubmissionFinalePredictions(submission),
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
      const scopedSeasonId = getActiveSeasonId();
      let records = await fetchWeeklySubmissions({ seasonId: scopedSeasonId });
      if (records.length === 0) {
        try {
          const params = new URLSearchParams({
            perPage: "200",
            sort: "-created",
          });
          if (scopedSeasonId) {
            params.set("filter", `seasonId="${scopedSeasonId.replace(/"/g, '\\"')}"`);
          }
          const response = await fetch(
            `${pocketbaseUrl}/api/collections/submissions/records?${params.toString()}`
          );
          if (response.ok) {
            const data = (await response.json()) as { items?: SubmissionRecord[] };
            if (Array.isArray(data.items)) {
              records = data.items.filter((submission) => isWeeklySubmissionRecord(submission));
            }
          }
        } catch (fallbackError) {
          logger.warn("Fallback submissions fetch failed:", fallbackError);
        }
      }
      setSubmissions(records.filter((record) => isSubmissionForActiveWeek(record)));
    } catch (error: any) {
      setSubmissionsError(error?.message || String(error));
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, [activeSeasonId, pocketbaseUrl, seasonConfig?.seasonId, seasonRecords.length]);

  useEffect(() => {
    refreshSubmissions();
    const unsubscribe = subscribeToWeeklySubmissions((submission) => {
      if (!isSubmissionForActiveWeek(submission)) return;
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

  useEffect(() => {
    if (!selectedPlayer) return;
    const freshSelected = gameState.players.find((player) => player.id === selectedPlayer.id) || null;
    if (!freshSelected) {
      setSelectedPlayer(null);
      return;
    }
    if (freshSelected !== selectedPlayer) {
      setSelectedPlayer(freshSelected);
    }
  }, [gameState.players, selectedPlayer]);


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

          const matchedName = castNames.find(c => namePart.includes(c) || c.includes(namePart));
          if (matchedName) {
            picks.push({ member: matchedName, rank, role });
          }
        }

        if (lowerLine.includes("first eliminated:") || lowerLine.includes("first out:")) {
          const val = line.split(":")[1]?.trim() || "";
          predFirstOut = castNames.find(c => val.includes(c)) || val;
        }
        if (lowerLine.includes("winner pick:") || lowerLine.includes("sole winner:") || lowerLine.includes("winner:")) {
          const val = line.split(":")[1]?.trim() || "";
          predWinner = castNames.find(c => val.includes(c)) || val;
        }

        if (lowerLine.includes("next banished:")) {
          const val = line.split(":")[1]?.trim() || "";
          weeklyBanished = castNames.find(c => val.includes(c)) || val;
        }
        if (lowerLine.includes("next murdered:")) {
          const val = line.split(":")[1]?.trim() || "";
          weeklyMurdered = castNames.find(c => val.includes(c)) || val;
        }

        if (lowerLine.includes("traitor guesses") || lowerLine.includes("traitor suspects") || lowerLine.includes("the traitors")) {
          inTraitorSection = true;
        } else if (inTraitorSection) {
          const cleanedLine = line.replace(/^\d+[\.\)]/, "").replace(/^[-•*]/, "").trim();
          const matchedTraitor = castNames.find(c => cleanedLine.includes(c));
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
          weekId: getActiveWeekId(),
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
      const nextState = { ...prevState, castStatus: updatedStatus };
      gameStateRef.current = nextState;
      return nextState;
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
        logger.error("Failed to persist player portrait:", err);
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
    submission: SubmissionRecord,
    options?: { allowLate?: boolean }
  ) => {
    const activeWeekId = getActiveWeekId();
    const allowLate = Boolean(options?.allowLate);
    if (!isSubmissionForActiveWeek(submission)) {
      return { matched: false as const, stale: true as const, players };
    }
    if (!allowLate && !isSubmissionBeforeFinaleLock(submission)) {
      return { matched: false as const, late: true as const, players };
    }
    const league = getSubmissionLeague(submission);
    const match = findPlayerMatch(players, submission, league);
    const normalizedBonusGames = normalizeSubmissionBonusGames(submission);
    const normalizedFinalePredictions = normalizeSubmissionFinalePredictions(submission);
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
          weekId: activeWeekId,
          nextBanished: typeof incomingBanished === "string" ? incomingBanished : "",
          nextMurdered: typeof incomingMurdered === "string" ? incomingMurdered : "",
          bonusGames: {
            redemptionRoulette: incomingBonusGames.redemptionRoulette ?? "",
            doubleOrNothing: Boolean(incomingBonusGames.doubleOrNothing),
            shieldGambit: incomingBonusGames.shieldGambit ?? "",
            traitorTrio: incomingBonusGames.traitorTrio ?? [],
          },
          finalePredictions: normalizedFinalePredictions ?? {
            finalWinner: "",
            lastFaithfulStanding: "",
            lastTraitorStanding: "",
            finalPotEstimate: null,
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
        weekId: activeWeekId,
        nextBanished: "",
        nextMurdered: "",
        bonusGames: {},
        finalePredictions: {
          finalWinner: "",
          lastFaithfulStanding: "",
          lastTraitorStanding: "",
          finalPotEstimate: null,
        },
      };
      const existingBonus = existingWeekly.bonusGames ?? {};
      const existingFinale = existingWeekly.finalePredictions;
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
      const nextFinalePredictions = normalizedFinalePredictions
        ? {
            finalWinner:
              normalizedFinalePredictions.finalWinner || existingFinale?.finalWinner || "",
            lastFaithfulStanding:
              normalizedFinalePredictions.lastFaithfulStanding ||
              existingFinale?.lastFaithfulStanding ||
              "",
            lastTraitorStanding:
              normalizedFinalePredictions.lastTraitorStanding ||
              existingFinale?.lastTraitorStanding ||
              "",
            finalPotEstimate:
              typeof normalizedFinalePredictions.finalPotEstimate === "number"
                ? normalizedFinalePredictions.finalPotEstimate
                : existingFinale?.finalPotEstimate ?? null,
          }
        : existingFinale;
      return {
        ...player,
        name: submission.name || player.name,
        email: submission.email || player.email,
        weeklyPredictions: {
          weekId: activeWeekId,
          nextBanished:
            typeof incomingBanished === "string"
              ? incomingBanished
              : existingWeekly.nextBanished || "",
          nextMurdered:
            typeof incomingMurdered === "string"
              ? incomingMurdered
              : existingWeekly.nextMurdered || "",
          bonusGames: nextBonusGames,
          finalePredictions: nextFinalePredictions,
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
    let forcedLateMerge = false;
    let result = applySubmissionToPlayers(currentState.players, submission);
    if (!result.matched && result.late) {
      const shouldForceMerge = await requestConfirm(
        `Submission from ${submission.name} arrived after finale lock. Merge anyway?`
      );
      if (shouldForceMerge) {
        result = applySubmissionToPlayers(currentState.players, submission, {
          allowLate: true,
        });
        forcedLateMerge = result.matched;
      }
    }
    if (!result.matched) {
      if (result.stale) {
        void markSubmissionSkipped(submission.id, "skipped_stale").catch((error) =>
          logger.warn("Failed to mark stale submission:", error)
        );
      }
      if (result.late) {
        void markSubmissionSkipped(submission.id, "skipped_late").catch((error) =>
          logger.warn("Failed to mark late submission:", error)
        );
      }
      if (announce) {
        setMsg({
          text: result.stale
            ? `Skipped stale vote for ${submission.name}; it belongs to a previous week.`
            : result.late
            ? `Skipped late vote for ${submission.name}; submission arrived after finale lock.`
            : `No matching player found for ${submission.name}.`,
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
      await markSubmissionMerged(submission.id);
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
      if (announce) {
        setMsg({
          text: forcedLateMerge
            ? `Merged late weekly vote for ${submission.name}.`
            : `Merged weekly vote for ${submission.name}.`,
          type: "success",
        });
      }
    } catch (err: any) {
      if (announce) {
        setMsg({
          text: `Merged weekly vote, but failed to mark submission as merged: ${err?.message || err}`,
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
    const lateIds: string[] = [];
    const staleIds: string[] = [];
    const historyAdds: WeeklySubmissionHistoryEntry[] = [];
    let skipped = 0;
    let staleSkipped = 0;
    let lateSkipped = 0;

    list.forEach((submission) => {
      const historyEntry = buildHistoryEntry(submission, updatedPlayers);
      const result = applySubmissionToPlayers(updatedPlayers, submission);
      if (result.matched) {
        updatedPlayers = result.players;
        mergedIds.push(submission.id);
        historyAdds.push(historyEntry);
      } else if (result.stale) {
        staleSkipped += 1;
        staleIds.push(submission.id);
      } else if (result.late) {
        lateSkipped += 1;
        lateIds.push(submission.id);
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
      await Promise.all([
        ...mergedIds.map((id) => markSubmissionMerged(id)),
        ...lateIds.map((id) => markSubmissionSkipped(id, "skipped_late")),
        ...staleIds.map((id) => markSubmissionSkipped(id, "skipped_stale")),
      ]);
      setSubmissions((prev) => prev.filter((s) => !mergedIds.includes(s.id)));
      if (announce) {
        setMsg({
          text:
            `Merged ${mergedIds.length} weekly votes` +
            `${lateSkipped ? `, skipped ${lateSkipped} late` : ""}` +
            `${staleSkipped ? `, skipped ${staleSkipped} stale` : ""}` +
            `${skipped ? `, skipped ${skipped}` : ""}.`,
          type: "success",
        });
      }
    } catch (err: any) {
      if (announce) {
        setMsg({
          text: `Merged weekly votes, but failed to mark some submissions as merged: ${err?.message || err}`,
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
        weekId: getActiveWeekId(),
        nextBanished: editWeeklyBanished,
        nextMurdered: editWeeklyMurdered,
        bonusGames: selectedPlayer.weeklyPredictions?.bonusGames,
        finalePredictions: selectedPlayer.weeklyPredictions?.finalePredictions,
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
              weekId: getActiveWeekId(),
              nextBanished: edit.weeklyBanished,
              nextMurdered: edit.weeklyMurdered,
              bonusGames: player.weeklyPredictions?.bonusGames,
              finalePredictions: player.weeklyPredictions?.finalePredictions,
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

  const applyScoreAdjustmentsToState = (nextAdjustments: ScoreAdjustment[]) => {
    setScoreAdjustments(nextAdjustments);
    updateGameState((prev) => ({
      ...prev,
      scoreAdjustments: nextAdjustments,
    }));
  };

  const addScoreAdjustmentEntry = async () => {
    const seasonId = gameState.seasonId || seasonConfig?.seasonId || "season-1";
    const playerId = newAdjustmentPlayerId.trim();
    const reason = newAdjustmentReason.trim();
    const points = Number(newAdjustmentPoints);
    const weekId = normalizeWeekId(newAdjustmentWeekId);

    if (!playerId) {
      setMsg({ text: "Select a player for the score adjustment.", type: "error" });
      return;
    }
    if (!reason) {
      setMsg({ text: "Reason is required for every score adjustment.", type: "error" });
      return;
    }
    if (!Number.isFinite(points) || points === 0) {
      setMsg({ text: "Points must be a non-zero number.", type: "error" });
      return;
    }

    try {
      const created = await createScoreAdjustment({
        seasonId,
        playerId,
        weekId: weekId ?? undefined,
        reason,
        points,
        createdBy: "admin",
      });
      const next = [created, ...scoreAdjustments];
      applyScoreAdjustmentsToState(next);
      setNewAdjustmentPoints("");
      setNewAdjustmentReason("");
      setNewAdjustmentWeekId("");
      setMsg({ text: "Score adjustment added.", type: "success" });
    } catch (error) {
      logger.warn("Failed to create score adjustment in PocketBase:", error);
      const fallback: ScoreAdjustment = {
        id: `local-${Date.now()}`,
        seasonId,
        playerId,
        weekId: weekId ?? undefined,
        reason,
        points,
        createdBy: "admin",
        createdAt: new Date().toISOString(),
      };
      const next = [fallback, ...scoreAdjustments];
      applyScoreAdjustmentsToState(next);
      setMsg({
        text: "Score adjustment added locally; remote write failed.",
        type: "error",
      });
    }
  };

  const removeScoreAdjustmentEntry = async (adjustment: ScoreAdjustment) => {
    if (!(await requestConfirm("Delete this score adjustment?"))) return;
    try {
      if (!adjustment.id.startsWith("local-")) {
        await deleteScoreAdjustment(adjustment.id);
      }
    } catch (error) {
      logger.warn("Failed to delete score adjustment in PocketBase:", error);
    }
    const next = scoreAdjustments.filter((item) => item.id !== adjustment.id);
    applyScoreAdjustmentsToState(next);
    setMsg({ text: "Score adjustment removed.", type: "success" });
  };

  const parseSeasonCastNames = () => {
    const entries = newSeasonCastInput
      .split(/\n|,/g)
      .map((value) => value.trim())
      .filter(Boolean);
    return Array.from<string>(new Set(entries)).sort((a, b) => a.localeCompare(b));
  };
  const normalizeDateTimeInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) return null;
    return new Date(parsed).toISOString();
  };
  const handleSaveShowConfiguration = async () => {
    const base = showConfig ?? gameState.showConfig;
    if (!base) {
      setMsg({ text: "Show config is not loaded yet.", type: "error" });
      return;
    }

    const nextConfig: ShowConfig = {
      ...base,
      showName: showNameInput.trim() || base.showName,
      shortName: showShortNameInput.trim() || base.shortName,
      branding: {
        ...base.branding,
        headerKicker: showHeaderKickerInput.trim() || base.branding?.headerKicker || "",
        appTitle: showAppTitleInput.trim() || base.branding?.appTitle || "",
        footerCopy: showFooterCopyInput.trim() || base.branding?.footerCopy || "",
      },
      terminology: {
        ...base.terminology,
        weeklyCouncilLabel: weeklyLabelInput.trim() || base.terminology.weeklyCouncilLabel,
        jrCouncilLabel: jrLabelInput.trim() || base.terminology.jrCouncilLabel,
        draftLabel: draftLabelInput.trim() || base.terminology.draftLabel,
        leaderboardLabel:
          leaderboardLabelInput.trim() || base.terminology.leaderboardLabel,
        adminLabel: adminLabelInput.trim() || base.terminology.adminLabel,
        finaleLabelDefault:
          finaleLabelInput.trim() || base.terminology.finaleLabelDefault,
      },
    };

    try {
      await saveShowConfig(nextConfig, nextConfig.slug);
      updateGameState((prev) => ({
        ...prev,
        showConfig: nextConfig,
      }));
      setMsg({ text: "Show configuration saved.", type: "success" });
    } catch (error: any) {
      setMsg({
        text: `Failed to save show config: ${error?.message || error}`,
        type: "error",
      });
    }
  };

  const handleCreateSeason = async () => {
    const seasonId = newSeasonId.trim();
    const label = newSeasonLabel.trim();
    if (!seasonId) {
      setMsg({ text: "Season ID is required.", type: "error" });
      return;
    }
    if (!label) {
      setMsg({ text: "Season label is required.", type: "error" });
      return;
    }

    const castNames = parseSeasonCastNames();
    const stateCastNames =
      castNames.length > 0
        ? castNames
        : Object.keys(gameState.castStatus || {}).sort((a, b) => a.localeCompare(b));
    const nextCastStatus = Object.fromEntries(
      stateCastNames.map((name) => [
        name,
        {
          isWinner: false,
          isFirstOut: false,
          isTraitor: false,
          isEliminated: false,
          portraitUrl: null,
        },
      ])
    );

    try {
      const nextSeason: SeasonConfig = {
        seasonId,
        label,
        status: "live",
        timezone: newSeasonTimezone || "America/New_York",
        lockSchedule: {
          draftLockAt: normalizeDateTimeInput(newSeasonDraftLockAt),
          weeklyLockAt: normalizeDateTimeInput(newSeasonWeeklyLockAt),
          finaleLockAt: normalizeDateTimeInput(newSeasonFinaleLockAt),
        },
        activeWeekId: "week-1",
        finaleConfig: {
          enabled: false,
          label: showConfig?.terminology?.finaleLabelDefault || "Finale Gauntlet",
          lockAt:
            normalizeDateTimeInput(newSeasonFinaleLockAt) ||
            new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        rulePackId: newSeasonRulePackId || "traitors-classic",
      };
      await createSeason(nextSeason);
      await saveSeasonState(seasonId, {
        seasonId,
        rulePackId: nextSeason.rulePackId,
        showConfig: {
          ...(showConfig ?? gameState.showConfig),
          castNames: stateCastNames,
        },
        seasonConfig: nextSeason,
        activeWeekId: "week-1",
        players: [],
        castStatus: nextCastStatus,
        weeklyResults: createEmptyWeeklyResults("week-1"),
        finaleConfig: nextSeason.finaleConfig,
        scoreAdjustments: [],
        weeklySubmissionHistory: [],
        weeklyScoreHistory: [],
      });
      const refreshed = await listSeasonRecords();
      setSeasonRecords(refreshed);
      onSeasonChange?.(seasonId);
      setNewSeasonId("");
      setNewSeasonLabel("");
      setNewSeasonCastInput("");
      setNewSeasonDraftLockAt("");
      setNewSeasonWeeklyLockAt("");
      setNewSeasonFinaleLockAt("");
      setMsg({ text: "Season created and published.", type: "success" });
    } catch (error: any) {
      setMsg({
        text: `Failed to create season: ${error?.message || error}`,
        type: "error",
      });
    }
  };

  const handleLoadSeason = async (seasonId: string) => {
    try {
      const seasonState = await fetchSeasonState(seasonId);
      if (!seasonState) {
        setMsg({ text: "No saved state found for this season.", type: "error" });
        return;
      }
      updateGameState(seasonState);
      onSeasonChange?.(seasonId);
      setMsg({ text: `Loaded ${seasonId}.`, type: "success" });
    } catch (error: any) {
      setMsg({
        text: `Failed to load season: ${error?.message || error}`,
        type: "error",
      });
    }
  };

  const handleArchiveSeason = async (seasonId: string) => {
    if (!(await requestConfirm(`Archive season ${seasonId}?`))) return;
    try {
      await archiveSeason(seasonId);
      const refreshed = await listSeasonRecords();
      setSeasonRecords(refreshed);
      setMsg({ text: `Season ${seasonId} archived.`, type: "success" });
    } catch (error: any) {
      setMsg({
        text: `Failed to archive season: ${error?.message || error}`,
        type: "error",
      });
    }
  };

  const handleFinalizeSeason = async (seasonId: string) => {
    if (!(await requestConfirm(`Finalize season ${seasonId}?`))) return;
    try {
      await finalizeSeason(seasonId);
      const refreshed = await listSeasonRecords();
      setSeasonRecords(refreshed);
      if (
        (activeSeasonId && activeSeasonId === seasonId) ||
        gameState.seasonId === seasonId
      ) {
        updateGameState((prev) => ({
          ...prev,
          seasonConfig: {
            ...(prev.seasonConfig ?? {
              seasonId,
              label: seasonId,
              status: "finalized",
              timezone: "UTC",
              lockSchedule: {},
            }),
            status: "finalized",
          },
        }));
      }
      setMsg({ text: `Season ${seasonId} finalized.`, type: "success" });
    } catch (error: any) {
      setMsg({
        text: `Failed to finalize season: ${error?.message || error}`,
        type: "error",
      });
    }
  };

  const handleCloneSeason = async () => {
    const sourceSeasonId = cloneSeasonId || activeSeasonId || gameState.seasonId;
    if (!sourceSeasonId) {
      setMsg({ text: "Select a source season to clone.", type: "error" });
      return;
    }
    const targetSeasonId = newSeasonId.trim();
    const targetLabel = newSeasonLabel.trim();
    if (!targetSeasonId || !targetLabel) {
      setMsg({
        text: "Provide new season ID and label before cloning.",
        type: "error",
      });
      return;
    }
    try {
      await cloneSeason({
        sourceSeasonId,
        targetSeason: {
          seasonId: targetSeasonId,
          label: targetLabel,
          status: "draft",
          timezone: newSeasonTimezone || "America/New_York",
          lockSchedule: {
            draftLockAt: normalizeDateTimeInput(newSeasonDraftLockAt),
            weeklyLockAt: normalizeDateTimeInput(newSeasonWeeklyLockAt),
            finaleLockAt: normalizeDateTimeInput(newSeasonFinaleLockAt),
          },
          activeWeekId: "week-1",
          finaleConfig: {
            enabled: false,
            label: showConfig?.terminology?.finaleLabelDefault || "Finale Gauntlet",
            lockAt:
              normalizeDateTimeInput(newSeasonFinaleLockAt) ||
              new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          rulePackId: newSeasonRulePackId || "traitors-classic",
        },
      });
      const refreshed = await listSeasonRecords();
      setSeasonRecords(refreshed);
      setMsg({ text: "Season cloned.", type: "success" });
    } catch (error: any) {
      setMsg({
        text: `Failed to clone season: ${error?.message || error}`,
        type: "error",
      });
    }
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
    const snapshotWeekId =
      normalizeWeekId(currentState.weeklyResults?.weekId) ?? getActiveWeekId();
    const archivedPlayers = currentState.players.map((player) => {
      const weeklyPredictions = player.weeklyPredictions;
      if (!hasWeeklyPredictionContent(weeklyPredictions)) return player;
      if (normalizeWeekId(weeklyPredictions?.weekId)) return player;
      return {
        ...player,
        weeklyPredictions: {
          ...weeklyPredictions,
          weekId: snapshotWeekId,
        },
      };
    });
    const archivedState = {
      ...currentState,
      players: archivedPlayers,
    };
    const totals: Record<string, number> = {};
    archivedPlayers.forEach((player) => {
      totals[player.id] = calculatePlayerScore(archivedState, player).total;
    });
    const snapshotResults = currentState.weeklyResults
      ? JSON.parse(JSON.stringify(currentState.weeklyResults))
      : createEmptyWeeklyResults(snapshotWeekId);
    snapshotResults.weekId = snapshotWeekId;
    const snapshot: WeeklyScoreSnapshot = {
      id: `week-${Date.now()}`,
      label,
      createdAt: new Date().toISOString(),
      weeklyResults: snapshotResults,
      totals,
    };
    const nextHistory = [...scoreHistory, snapshot].slice(-LIMITS.SCORE_HISTORY_LIMIT);
    const nextActiveWeekId = `week-${nextHistory.length + 1}`;
    const nextState = {
      ...archivedState,
      activeWeekId: nextActiveWeekId,
      weeklyResults: createEmptyWeeklyResults(nextActiveWeekId),
      weeklyScoreHistory: nextHistory,
    };
    gameStateRef.current = nextState;
    updateGameState(nextState);
    void refreshSubmissions();
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
  const finaleConfig = gameState.finaleConfig ?? {
    enabled: false,
    label: defaultFinaleLabel,
    lockAt: defaultFinaleLockAt,
  };
  const finaleResults = gameState.weeklyResults?.finaleResults ?? {
    finalWinner: "",
    lastFaithfulStanding: "",
    lastTraitorStanding: "",
    finalPotValue: null,
  };
  const updateBonusResult = (
    key: "redemptionRoulette" | "shieldGambit",
    value: string
  ) => {
    const currentWeekId =
      normalizeWeekId(gameStateRef.current.weeklyResults?.weekId) ??
      getActiveWeekId();
    const nextState = {
      ...gameStateRef.current,
      weeklyResults: {
        ...(gameStateRef.current.weeklyResults ?? {}),
        weekId: currentWeekId,
        bonusGames: {
          ...(gameStateRef.current.weeklyResults?.bonusGames ?? {}),
          [key]: value,
        },
      },
    };
    gameStateRef.current = nextState;
    updateGameState(nextState);
  };
  const updateFinaleResult = (
    key: "finalWinner" | "lastFaithfulStanding" | "lastTraitorStanding",
    value: string
  ) => {
    const currentWeekId =
      normalizeWeekId(gameStateRef.current.weeklyResults?.weekId) ??
      getActiveWeekId();
    const nextState = {
      ...gameStateRef.current,
      weeklyResults: {
        ...(gameStateRef.current.weeklyResults ?? {}),
        weekId: currentWeekId,
        finaleResults: {
          ...(gameStateRef.current.weeklyResults?.finaleResults ?? {}),
          [key]: value,
        },
      },
    };
    gameStateRef.current = nextState;
    updateGameState(nextState);
  };
  const updateFinalePotValue = (value: number | null) => {
    const currentWeekId =
      normalizeWeekId(gameStateRef.current.weeklyResults?.weekId) ??
      getActiveWeekId();
    const nextState = {
      ...gameStateRef.current,
      weeklyResults: {
        ...(gameStateRef.current.weeklyResults ?? {}),
        weekId: currentWeekId,
        finaleResults: {
          ...(gameStateRef.current.weeklyResults?.finaleResults ?? {}),
          finalPotValue: value,
        },
      },
    };
    gameStateRef.current = nextState;
    updateGameState(nextState);
  };

  const sectionTabs: AdminSectionTab[] = [
    { id: "operations", label: "Operations", summary: "Weekly outcomes and score archives" },
    { id: "seasons", label: "Seasons", summary: "Season wizard, lifecycle, and switching" },
    { id: "adjustments", label: "Adjustments", summary: "Manual score ledger and audit trail" },
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
      finaleConfig={finaleConfig}
      finaleResults={finaleResults}
      bonusResults={bonusResults}
      onSetNextBanished={(value) =>
        updateGameState((prevState) => ({
          ...prevState,
          weeklyResults: {
            ...(prevState.weeklyResults ?? {}),
            weekId:
              normalizeWeekId(prevState.weeklyResults?.weekId) ??
              inferActiveWeekId(prevState),
            nextBanished: value,
          },
        }))
      }
      onSetNextMurdered={(value) =>
        updateGameState((prevState) => ({
          ...prevState,
          weeklyResults: {
            ...(prevState.weeklyResults ?? {}),
            weekId:
              normalizeWeekId(prevState.weeklyResults?.weekId) ??
              inferActiveWeekId(prevState),
            nextMurdered: value,
          },
        }))
      }
      onSetFinaleEnabled={(enabled) =>
        updateGameState((prevState) => ({
          ...prevState,
          finaleConfig: {
            enabled,
            label: prevState.finaleConfig?.label || defaultFinaleLabel,
            lockAt: prevState.finaleConfig?.lockAt || defaultFinaleLockAt,
          },
        }))
      }
      onSetFinaleLabel={(value) =>
        updateGameState((prevState) => ({
          ...prevState,
          finaleConfig: {
            enabled: Boolean(prevState.finaleConfig?.enabled),
            label: value,
            lockAt: prevState.finaleConfig?.lockAt || defaultFinaleLockAt,
          },
        }))
      }
      onSetFinaleLockAt={(value) =>
        updateGameState((prevState) => ({
          ...prevState,
          finaleConfig: {
            enabled: Boolean(prevState.finaleConfig?.enabled),
            label: prevState.finaleConfig?.label || defaultFinaleLabel,
            lockAt: value,
          },
        }))
      }
      onSetFinaleResult={updateFinaleResult}
      onSetFinalePotValue={updateFinalePotValue}
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
      getSubmissionFinalePredictions={normalizeSubmissionFinalePredictions}
      isSubmissionLateForFinale={(submission) => !isSubmissionBeforeFinaleLock(submission)}
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

  const renderAdjustmentsSection = () => (
    <section className="soft-card rounded-3xl p-5 md:p-6 space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
          Score Ledger
        </p>
        <h3 className="headline text-2xl">Manual Score Adjustments</h3>
        <p className="text-sm text-[color:var(--text-muted)]">
          Add or remove point corrections with an auditable reason.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select
          value={newAdjustmentPlayerId}
          onChange={(e) => setNewAdjustmentPlayerId(e.target.value)}
          className="field-soft p-3 text-sm"
        >
          <option value="">Select player...</option>
          {gameState.players
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
        </select>
        <input
          type="number"
          step="0.5"
          value={newAdjustmentPoints}
          onChange={(e) => setNewAdjustmentPoints(e.target.value)}
          className="field-soft p-3 text-sm"
          placeholder="Points (+/-)"
        />
        <input
          type="text"
          value={newAdjustmentWeekId}
          onChange={(e) => setNewAdjustmentWeekId(e.target.value)}
          className="field-soft p-3 text-sm"
          placeholder="Week ID (optional)"
        />
        <button
          type="button"
          onClick={() => {
            void addScoreAdjustmentEntry();
          }}
          className="btn-primary px-4 text-[11px]"
        >
          Add Adjustment
        </button>
      </div>

      <input
        type="text"
        value={newAdjustmentReason}
        onChange={(e) => setNewAdjustmentReason(e.target.value)}
        className="field-soft p-3 text-sm w-full"
        placeholder="Reason (required)"
      />

      <div className="space-y-2">
        {scoreAdjustments.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            No manual score adjustments recorded for this season.
          </p>
        ) : (
          scoreAdjustments.map((adjustment) => {
            const player = gameState.players.find((entry) => entry.id === adjustment.playerId);
            return (
              <article
                key={adjustment.id}
                className="soft-card soft-card-subtle rounded-2xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--text)] truncate">
                    {player?.name || adjustment.playerId}
                  </p>
                  <p className="text-xs text-[color:var(--text-muted)] truncate">
                    {adjustment.reason}
                    {adjustment.weekId ? ` · ${adjustment.weekId}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      adjustment.points >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {adjustment.points > 0 ? "+" : ""}
                    {adjustment.points}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void removeScoreAdjustmentEntry(adjustment);
                    }}
                    className="btn-secondary px-3 text-[11px]"
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );

  const renderSeasonsSection = () => (
    <section className="soft-card rounded-3xl p-5 md:p-6 space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
          Season Shell
        </p>
        <h3 className="headline text-2xl">New Season Wizard</h3>
        <p className="text-sm text-[color:var(--text-muted)]">
          Create, clone, archive, and switch seasons without code changes.
        </p>
      </div>

      <div className="soft-card soft-card-subtle rounded-2xl p-4 space-y-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            Show Setup
          </p>
          <p className="text-sm text-[color:var(--text-muted)]">
            White-label branding and terminology used across the app shell.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={showNameInput}
            onChange={(e) => setShowNameInput(e.target.value)}
            className="field-soft p-3 text-sm"
            placeholder="Show name"
          />
          <input
            type="text"
            value={showShortNameInput}
            onChange={(e) => setShowShortNameInput(e.target.value)}
            className="field-soft p-3 text-sm"
            placeholder="Short name"
          />
          <input
            type="text"
            value={showHeaderKickerInput}
            onChange={(e) => setShowHeaderKickerInput(e.target.value)}
            className="field-soft p-3 text-sm"
            placeholder="Header kicker"
          />
          <input
            type="text"
            value={showAppTitleInput}
            onChange={(e) => setShowAppTitleInput(e.target.value)}
            className="field-soft p-3 text-sm"
            placeholder="App title"
          />
          <input
            type="text"
            value={showFooterCopyInput}
            onChange={(e) => setShowFooterCopyInput(e.target.value)}
            className="field-soft p-3 text-sm md:col-span-2"
            placeholder="Footer copy"
          />
          <input
            type="text"
            value={weeklyLabelInput}
            onChange={(e) => setWeeklyLabelInput(e.target.value)}
            className="field-soft p-3 text-sm"
            placeholder="Weekly label"
          />
          <input
            type="text"
            value={jrLabelInput}
            onChange={(e) => setJrLabelInput(e.target.value)}
            className="field-soft p-3 text-sm"
            placeholder="JR label"
          />
          <input
            type="text"
            value={draftLabelInput}
            onChange={(e) => setDraftLabelInput(e.target.value)}
            className="field-soft p-3 text-sm"
            placeholder="Draft label"
          />
          <input
            type="text"
            value={leaderboardLabelInput}
            onChange={(e) => setLeaderboardLabelInput(e.target.value)}
            className="field-soft p-3 text-sm"
            placeholder="Leaderboard label"
          />
          <input
            type="text"
            value={adminLabelInput}
            onChange={(e) => setAdminLabelInput(e.target.value)}
            className="field-soft p-3 text-sm"
            placeholder="Admin label"
          />
          <input
            type="text"
            value={finaleLabelInput}
            onChange={(e) => setFinaleLabelInput(e.target.value)}
            className="field-soft p-3 text-sm"
            placeholder="Finale label"
          />
        </div>
        <button
          type="button"
          className="btn-secondary px-4 text-[11px]"
          onClick={() => {
            void handleSaveShowConfiguration();
          }}
        >
          Save Show Config
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          value={newSeasonId}
          onChange={(e) => setNewSeasonId(e.target.value)}
          className="field-soft p-3 text-sm"
          placeholder="Season ID (e.g. traitors-s5)"
        />
        <input
          type="text"
          value={newSeasonLabel}
          onChange={(e) => setNewSeasonLabel(e.target.value)}
          className="field-soft p-3 text-sm"
          placeholder="Season label"
        />
        <input
          type="text"
          value={newSeasonTimezone}
          onChange={(e) => setNewSeasonTimezone(e.target.value)}
          className="field-soft p-3 text-sm"
          placeholder="Timezone (e.g. America/New_York)"
        />
        <select
          value={newSeasonRulePackId}
          onChange={(e) => setNewSeasonRulePackId(e.target.value)}
          className="field-soft p-3 text-sm"
          >
          {RULE_PACKS.map((rulePack) => (
            <option key={rulePack.id} value={rulePack.id}>
              {rulePack.name}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={newSeasonDraftLockAt}
          onChange={(e) => setNewSeasonDraftLockAt(e.target.value)}
          className="field-soft p-3 text-sm"
          placeholder="Draft lock"
        />
        <input
          type="datetime-local"
          value={newSeasonWeeklyLockAt}
          onChange={(e) => setNewSeasonWeeklyLockAt(e.target.value)}
          className="field-soft p-3 text-sm"
          placeholder="Weekly lock"
        />
        <input
          type="datetime-local"
          value={newSeasonFinaleLockAt}
          onChange={(e) => setNewSeasonFinaleLockAt(e.target.value)}
          className="field-soft p-3 text-sm md:col-span-2"
          placeholder="Finale lock"
        />
      </div>

      <textarea
        value={newSeasonCastInput}
        onChange={(e) => setNewSeasonCastInput(e.target.value)}
        className="field-soft p-3 text-sm w-full min-h-[110px]"
        placeholder="Cast import (one per line or comma-separated). Leave blank to reuse current cast."
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary px-4 text-[11px]"
          onClick={() => {
            void handleCreateSeason();
          }}
        >
          Publish New Season
        </button>
        <select
          value={cloneSeasonId}
          onChange={(e) => setCloneSeasonId(e.target.value)}
          className="field-soft p-2.5 text-sm"
        >
          <option value="">Clone source season...</option>
          {seasonRecords.map((season) => (
            <option key={season.seasonId} value={season.seasonId}>
              {season.label} ({season.seasonId})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary px-4 text-[11px]"
          onClick={() => {
            void handleCloneSeason();
          }}
        >
          Clone to New Season
        </button>
      </div>

      <div className="space-y-2">
        {seasonRecords.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            No seasons found in shell collections yet.
          </p>
        ) : (
          seasonRecords.map((season) => (
            <article
              key={season.seasonId}
              className="soft-card soft-card-subtle rounded-2xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[color:var(--text)] truncate">
                  {season.label}
                </p>
                <p className="text-xs text-[color:var(--text-muted)] truncate">
                  {season.seasonId} · {season.status.toUpperCase()} · {season.rulePackId || "traitors-classic"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary px-3 text-[11px]"
                  onClick={() => {
                    void handleLoadSeason(season.seasonId);
                  }}
                >
                  {activeSeasonId === season.seasonId ? "Loaded" : "Load"}
                </button>
                {season.status === "live" || season.status === "draft" ? (
                  <button
                    type="button"
                    className="btn-secondary px-3 text-[11px]"
                    onClick={() => {
                      void handleFinalizeSeason(season.seasonId);
                    }}
                  >
                    Finalize
                  </button>
                ) : null}
                {season.status !== "archived" && (
                  <button
                    type="button"
                    className="btn-secondary px-3 text-[11px]"
                    onClick={() => {
                      void handleArchiveSeason(season.seasonId);
                    }}
                  >
                    Archive
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
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
      castNames={castNames}
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
      case "seasons":
        return renderSeasonsSection();
      case "adjustments":
        return renderAdjustmentsSection();
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
    <div className={`w-full space-y-4 ${isPremiumUi ? "premium-page premium-admin-shell" : ""}`}>
      <PremiumCard className="premium-panel-pad premium-stack-sm">
        <PremiumPanelHeader
          kicker="Admin"
          title="Operations Console"
          description="Manage weekly outcomes, intake queue, roster quality, cast status, and persistence."
          rightSlot={<PremiumStatusBadge tone={lastWriteError ? "negative" : "accent"}>{saveStatus}</PremiumStatusBadge>}
        />
        <div className="lg:hidden">
          <PremiumTabs
            items={sectionTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
            activeId={activeSection}
            onChange={(id) => setActiveSection(id as AdminSection)}
          />
        </div>
      </PremiumCard>

      <div className="admin-console-shell">
        <aside className="admin-console-left hidden lg:block">
          <PremiumCard className="premium-panel-pad-compact">
            <p className="premium-kicker mb-2">Sections</p>
            <nav className="space-y-1">
              {sectionTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id)}
                  className={`admin-console-nav-item ${
                    activeSection === tab.id ? "admin-console-nav-item-active" : ""
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="admin-console-nav-summary">{tab.summary}</span>
                </button>
              ))}
            </nav>
          </PremiumCard>
        </aside>

        <section className="admin-console-main">
          {msg.text && (
            <div
              className={`premium-inline-alert rounded-2xl p-3 text-sm ${
                msg.type === "success"
                  ? "bg-emerald-500/10 text-[color:var(--success)]"
                  : "bg-rose-500/10 text-[color:var(--danger)]"
              }`}
            >
              {msg.text}
            </div>
          )}

          {renderActiveSection()}
        </section>

        <aside className="admin-console-right">
          <PremiumCard className="premium-panel-pad-compact premium-stack-sm">
            <p className="premium-kicker">Workspace Status</p>
            <div className="space-y-2">
              <div className="premium-row-item">
                <p className="premium-row-title">Players</p>
                <p className="premium-row-value">{gameState.players.length}</p>
              </div>
              <div className="premium-row-item">
                <p className="premium-row-title">Active Cast</p>
                <p className="premium-row-value">
                  {activeCastNames.length}/{castNames.length}
                </p>
              </div>
              <div className="premium-row-item">
                <p className="premium-row-title">Pending Votes</p>
                <p className="premium-row-value">{submissions.length}</p>
              </div>
            </div>
          </PremiumCard>

          <PremiumCard className="premium-panel-pad-compact premium-stack-sm">
            <p className="premium-kicker">Quick Actions</p>
            <div className="grid grid-cols-1 gap-2">
              {onSaveNow && (
                <button type="button" className="premium-btn premium-btn-primary" onClick={onSaveNow}>
                  Save Now
                </button>
              )}
              <button type="button" className="premium-btn premium-btn-secondary" onClick={refreshSubmissions}>
                Refresh Intake
              </button>
              {onSignOut && (
                <button type="button" className="premium-btn premium-btn-ghost" onClick={onSignOut}>
                  Sign Out
                </button>
              )}
            </div>
          </PremiumCard>
        </aside>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="premium-card premium-panel-pad w-full max-w-md rounded-2xl space-y-4">
            <p className="text-sm text-[color:var(--text)] leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="premium-btn premium-btn-secondary px-4 text-[11px]"
                onClick={() => {
                  confirmDialog.resolve(false);
                  setConfirmDialog(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="premium-btn premium-btn-primary px-4 text-[11px]"
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
          <div className="premium-card premium-panel-pad w-full max-w-md rounded-2xl space-y-4">
            <label className="block text-sm text-[color:var(--text)]">{promptDialog.title}</label>
            <input
              autoFocus
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="premium-field premium-input-compact w-full"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="premium-btn premium-btn-secondary px-4 text-[11px]"
                onClick={() => {
                  promptDialog.resolve(null);
                  setPromptDialog(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="premium-btn premium-btn-primary px-4 text-[11px]"
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
