export type DuplicateNameReason = "same-name" | "initials" | "similar";

export interface DuplicatePlayerFlag {
  playerId: string;
  otherPlayerId: string;
  playerName: string;
  otherName: string;
  reason: DuplicateNameReason;
}

export interface NamedPlayer {
  id: string;
  name: string;
  email?: string | null;
}

/** Lowercase, drop punctuation, collapse whitespace. "K.K." and "KK" both become "kk". */
export const normalizePlayerName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokensOf = (normalized: string): string[] =>
  normalized.split(" ").filter((part) => part.length > 0);

const initialsOf = (normalized: string): string =>
  tokensOf(normalized)
    .map((part) => part[0] ?? "")
    .join("");

const levenshtein = (left: string, right: string): number => {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let row = 0; row < rows; row += 1) grid[row][0] = row;
  for (let col = 0; col < cols; col += 1) grid[0][col] = col;
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      grid[row][col] = Math.min(
        grid[row - 1][col] + 1,
        grid[row][col - 1] + 1,
        grid[row - 1][col - 1] + cost
      );
    }
  }
  return grid[left.length][right.length];
};

const initialsMatch = (shortName: string, longName: string): boolean => {
  if (shortName.includes(" ") || shortName.length < 2 || shortName.length > 4) return false;
  const words = tokensOf(longName);
  if (words.length !== shortName.length) return false;
  return initialsOf(longName) === shortName;
};

/**
 * Same normalized name, initials (KK / Kiley Kaiser), or a one-or-two
 * character typo on a longer name. Short unrelated names are left alone.
 */
export const duplicateNameReason = (
  leftName: string,
  rightName: string
): DuplicateNameReason | null => {
  const left = normalizePlayerName(leftName);
  const right = normalizePlayerName(rightName);
  if (!left || !right) return null;
  if (left === right) return "same-name";
  if (initialsMatch(left, right) || initialsMatch(right, left)) return "initials";
  const leftTokens = tokensOf(left);
  const rightTokens = tokensOf(right);
  if (
    leftTokens.length >= 2 &&
    rightTokens.length >= 2 &&
    leftTokens[0] === rightTokens[0] &&
    leftTokens[leftTokens.length - 1] === rightTokens[rightTokens.length - 1]
  ) {
    return "similar";
  }
  if (left.length >= 4 && right.length >= 4 && Math.abs(left.length - right.length) <= 2) {
    if (levenshtein(left, right) <= 2) return "similar";
  }
  return null;
};

/**
 * Pairs an admin should look at. Does not merge, drop, or rewrite anyone —
 * two rows with similar names stay two rows until a person picks which to keep.
 */
export const findLikelyDuplicatePlayers = (players: NamedPlayer[]): DuplicatePlayerFlag[] => {
  const flags: DuplicatePlayerFlag[] = [];
  const seen = new Set<string>();
  for (let leftIndex = 0; leftIndex < players.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < players.length; rightIndex += 1) {
      const left = players[leftIndex];
      const right = players[rightIndex];
      if (!left?.id || !right?.id || left.id === right.id) continue;
      const reason = duplicateNameReason(left.name || "", right.name || "");
      if (!reason) continue;
      const key = [left.id, right.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      flags.push({
        playerId: left.id,
        otherPlayerId: right.id,
        playerName: left.name,
        otherName: right.name,
        reason,
      });
    }
  }
  return flags;
};

export const duplicateFlagsTouching = (
  players: NamedPlayer[],
  playerIds: string[]
): DuplicatePlayerFlag[] => {
  const ids = new Set(playerIds);
  return findLikelyDuplicatePlayers(players).filter(
    (flag) => ids.has(flag.playerId) || ids.has(flag.otherPlayerId)
  );
};

export const duplicateReasonLabel = (reason: DuplicateNameReason): string => {
  switch (reason) {
    case "same-name":
      return "Same name";
    case "initials":
      return "Initials match the full name";
    case "similar":
      return "Names are similar";
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
};

export const formatDuplicateImportWarning = (flags: DuplicatePlayerFlag[]): string => {
  if (flags.length === 0) return "";
  const pairs = flags
    .map((flag) => `${flag.playerName} and ${flag.otherName}`)
    .join("; ");
  return ` Flagged likely duplicates for review (not merged): ${pairs}.`;
};
