import { normalizeWeekId } from "../../types";

/**
 * Identity for one player's vote in one week.
 * Email wins over name so a history row and a pending row for the same
 * person land in the same group. The week is part of the key, so a previous
 * week cannot block this one.
 */
export const weeklyVoteKey = (input: {
  email?: string;
  name?: string;
  league?: string;
  weekId?: string | null;
}): string => {
  const email = (input.email || "").trim().toLowerCase();
  const name = (input.name || "").trim().toLowerCase();
  const league = input.league === "jr" ? "jr" : "main";
  const weekId = normalizeWeekId(input.weekId) ?? "";
  return `${league}|${email || name}|${weekId}`;
};

export type WeeklyVoteStamp = {
  id: string;
  created?: string;
  playerKey: string;
  weekId: string;
};

const createdRank = (created?: string): number => {
  if (!created) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(created);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

/**
 * Choose which ready rows may write weekly predictions.
 *
 * The pending queue stays newest-first. Applying every row in that order lets
 * an older same-week submission overwrite the newer one, and an explicit blank
 * is a real write. The newest created time wins whether the older row is in
 * the same batch or arrives after the newer vote is already in history.
 * Ties keep the first pending row in queue order. A recorded vote at that
 * same time already stands.
 */
export const partitionWeeklyMergeWinners = (
  pending: WeeklyVoteStamp[],
  recorded: WeeklyVoteStamp[]
): { winnerIds: string[]; supersededIds: string[] } => {
  const recordedMax = new Map<string, number>();
  recorded.forEach((entry) => {
    const next = createdRank(entry.created);
    const previous = recordedMax.get(entry.playerKey);
    if (previous === undefined || next > previous) recordedMax.set(entry.playerKey, next);
  });

  const pendingMax = new Map<string, number>();
  pending.forEach((entry) => {
    const next = createdRank(entry.created);
    const previous = pendingMax.get(entry.playerKey);
    if (previous === undefined || next > previous) pendingMax.set(entry.playerKey, next);
  });

  const winnerIds: string[] = [];
  const supersededIds: string[] = [];
  const claimed = new Set<string>();

  pending.forEach((entry) => {
    const pendingBest = pendingMax.get(entry.playerKey) ?? createdRank(entry.created);
    const recordedBest = recordedMax.get(entry.playerKey);
    const best = recordedBest === undefined ? pendingBest : Math.max(pendingBest, recordedBest);
    const mine = createdRank(entry.created);
    const historyHoldsBest = recordedBest !== undefined && recordedBest >= mine;
    if (mine < best || claimed.has(entry.playerKey) || historyHoldsBest) {
      supersededIds.push(entry.id);
      return;
    }
    claimed.add(entry.playerKey);
    winnerIds.push(entry.id);
  });

  return { winnerIds, supersededIds };
};

export const mergeReadyWeeklySubmissions = <TPlayer, THistory, TSubmission extends { id: string; created?: string }>(input: {
  players: TPlayer[];
  ready: Array<{ submission: TSubmission; playerKey: string; weekId: string }>;
  recorded: WeeklyVoteStamp[];
  apply: (players: TPlayer[], submission: TSubmission) => { players: TPlayer[]; applied: boolean };
  historyFor: (submission: TSubmission, players: TPlayer[]) => THistory;
}): {
  players: TPlayer[];
  historyAdds: THistory[];
  mergedIds: string[];
  supersededIds: string[];
} => {
  const decision = partitionWeeklyMergeWinners(
    input.ready.map((item) => ({
      id: item.submission.id,
      created: item.submission.created,
      playerKey: item.playerKey,
      weekId: item.weekId,
    })),
    input.recorded
  );
  const winners = new Set(decision.winnerIds);
  let players = input.players;
  const historyAdds: THistory[] = [];
  const mergedIds: string[] = [];

  input.ready.forEach((item) => {
    if (!winners.has(item.submission.id)) return;
    const applied = input.apply(players, item.submission);
    if (!applied.applied) return;
    historyAdds.push(input.historyFor(item.submission, players));
    players = applied.players;
    mergedIds.push(item.submission.id);
  });

  return {
    players,
    historyAdds,
    mergedIds,
    supersededIds: decision.supersededIds,
  };
};
