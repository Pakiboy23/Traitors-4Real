import type { SeasonState } from "../../types";

/**
 * Keys used to put archived addresses back on an admin read.
 * Public JSON never contains these values.
 */
export interface ArchivedSeasonEmails {
  players: Record<string, string>;
  history: Record<string, string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readStringRecord = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && child.trim()) out[key] = child.trim();
  }
  return out;
};

export const readArchivedSeasonEmails = (archived: unknown): ArchivedSeasonEmails => {
  if (!isRecord(archived)) return { players: {}, history: {} };
  return {
    players: readStringRecord(archived.players),
    history: readStringRecord(archived.history),
  };
};

/**
 * Drop every `email` key in a season document.
 *
 * The public client runs this even when the row already came from
 * `season_states_public`, so a view that still echoes the column cannot
 * land in UI state. Array order and every other field stay put.
 */
export const redactPublicSeasonState = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => redactPublicSeasonState(item)) as T;
  }
  if (isRecord(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "email") continue;
      next[key] = redactPublicSeasonState(child);
    }
    return next as T;
  }
  return value;
};

/**
 * Admin reads the redacted season JSON plus `season_state_emails`.
 * A non-empty email already on the document wins, so a pre-migration row
 * still round-trips. Otherwise the archive fills the blank.
 */
export const mergeArchivedEmails = (
  state: SeasonState,
  archived: unknown
): SeasonState => {
  const archive = readArchivedSeasonEmails(archived);
  const players = Array.isArray(state.players) ? state.players : [];
  const history = Array.isArray(state.weeklySubmissionHistory)
    ? state.weeklySubmissionHistory
    : [];
  return {
    ...state,
    players: players.map((player) => {
      const current = typeof player.email === "string" ? player.email.trim() : "";
      const restored = player.id ? archive.players[player.id] : undefined;
      return { ...player, email: current || restored || "" };
    }),
    weeklySubmissionHistory: history.map((entry) => {
      const current = typeof entry.email === "string" ? entry.email.trim() : "";
      const restored = entry.id ? archive.history[entry.id] : undefined;
      return { ...entry, email: current || restored || "" };
    }),
  };
};

/** Portrait map key for the public read. Names are already on the board. */
export const publicPortraitKey = (name: string) => name.trim().toLowerCase();
