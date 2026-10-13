/**
 * Stored ids that are themselves email addresses.
 * Any `@` counts. A dotted domain is not required: `alice@local` is still an address.
 */
export const isEmailShapedId = (value: string): boolean => value.includes("@");

/**
 * Ids that must not appear on a public board.
 * `jr-` ids are minted from the normalized email (`jr-alice-example-com`).
 */
export const isPrivateRosterId = (value: string): boolean => {
  const trimmed = value.trim();
  return isEmailShapedId(trimmed) || /^jr-/i.test(trimmed);
};

export const nameSlug = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, "-");

type RosterPlayer = {
  id?: string | null;
  name?: string | null;
  publicId?: string | null;
};

/**
 * Public roster id for one player.
 *
 * A non-private stored id is kept. An email, a `jr-` id, or a missing id
 * becomes the name slug. The slug is not computed from the address. Scoring
 * still uses the stored id; only the published row and the client match use this.
 */
const preferredPublicRosterId = (player: RosterPlayer, index: number): string => {
  const rawId = typeof player.id === "string" ? player.id.trim() : "";
  if (rawId && !isPrivateRosterId(rawId)) return rawId;
  const slug = typeof player.name === "string" ? nameSlug(player.name) : "";
  // A name like "JR Player" slugs to `jr-player`. That must not be published:
  // the parser treats every `jr-` id as private.
  if (slug && !isPrivateRosterId(slug)) return slug;
  return `player-${index + 1}`;
};

const storedPublicId = (player: RosterPlayer): string => {
  const raw = typeof player.publicId === "string" ? player.publicId.trim() : "";
  if (raw && !isPrivateRosterId(raw)) return raw;
  return "";
};

/**
 * One stable public id per row, in player-array order.
 * Collisions get a numeric suffix so the set stays unique without the email.
 * Unique preferred ids are reserved first, so a suffix cannot copy one.
 */
export const publicRosterIds = (players: readonly RosterPlayer[]): string[] => {
  const stored = players.map(storedPublicId);
  const storedCounts = new Map<string, number>();
  for (const id of stored) {
    if (!id) continue;
    storedCounts.set(id, (storedCounts.get(id) ?? 0) + 1);
  }
  const preferred = players.map((player, index) => {
    const kept = stored[index] ?? "";
    if (kept && (storedCounts.get(kept) ?? 0) === 1) return kept;
    return preferredPublicRosterId(player, index);
  });
  const counts = new Map<string, number>();
  for (const id of preferred) counts.set(id, (counts.get(id) ?? 0) + 1);
  const used = new Set<string>();
  for (const id of preferred) {
    if ((counts.get(id) ?? 0) < 2) used.add(id);
  }
  for (const id of stored) {
    if (id && (storedCounts.get(id) ?? 0) === 1) used.add(id);
  }
  return players.map((player, index) => {
    const kept = stored[index] ?? "";
    if (kept && (storedCounts.get(kept) ?? 0) === 1) return kept;
    const id = preferred[index] ?? preferredPublicRosterId(player, index);
    // A preferred id that appears once is already reserved in `used` for this
    // row. Returning it is what keeps a unique roster id unsuffixed. A second
    // row, including one whose stored public id claimed this value, has a
    // count above 1 and takes a suffix that skips `used`.
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

/**
 * Stamp a public id on each player. A stored id stays with that player when
 * the roster is reordered, so collision suffixes are not reassigned by array order.
 */
export const assignPublicRosterIds = <T extends RosterPlayer>(players: readonly T[]): T[] => {
  const ids = publicRosterIds(players);
  return players.map((player, index) =>
    player.publicId === ids[index] ? player : { ...player, publicId: ids[index] }
  );
};
