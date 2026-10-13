/** Stored ids that are themselves email addresses. */
const EMAIL_SHAPED_ID = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export const isEmailShapedId = (value: string): boolean => EMAIL_SHAPED_ID.test(value.trim());

export const nameSlug = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, "-");

/**
 * Public roster id for one player.
 *
 * A non-email stored id is kept. An email-shaped id, or a missing id, becomes
 * the name slug. The slug is not computed from the address. Scoring still
 * uses the stored id; only the published row and the client match use this.
 */
const preferredPublicRosterId = (
  player: { id?: string | null; name?: string | null },
  index: number
): string => {
  const rawId = typeof player.id === "string" ? player.id.trim() : "";
  if (rawId && !isEmailShapedId(rawId)) return rawId;
  const slug = typeof player.name === "string" ? nameSlug(player.name) : "";
  return slug || `player-${index + 1}`;
};

/**
 * One stable public id per row, in player-array order.
 * Collisions get a numeric suffix so the set stays unique without the email.
 * Unique preferred ids are reserved first, so a suffix cannot copy one.
 */
export const publicRosterIds = (
  players: readonly { id?: string | null; name?: string | null }[]
): string[] => {
  const preferred = players.map((player, index) => preferredPublicRosterId(player, index));
  const counts = new Map<string, number>();
  for (const id of preferred) counts.set(id, (counts.get(id) ?? 0) + 1);
  const used = new Set<string>();
  for (const id of preferred) {
    if ((counts.get(id) ?? 0) < 2) used.add(id);
  }
  return preferred.map((id) => {
    if ((counts.get(id) ?? 0) < 2) return id;
    let next = 1;
    let candidate = `${id}-${next}`;
    while (used.has(candidate)) {
      next += 1;
      candidate = `${id}-${next}`;
    }
    used.add(candidate);
    return candidate;
  });
};
