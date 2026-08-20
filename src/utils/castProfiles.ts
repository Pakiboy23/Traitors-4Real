import { NEW_BLOOD_CAST, type CastProfile } from "../config/newBloodCast";
import type { CastMemberStatus } from "../../types";

export interface CastOption {
  name: string;
  age?: number | null;
  occupation?: string | null;
  hometown?: string | null;
  isEliminated: boolean;
  portraitUrl?: string | null;
}

/**
 * One-line context for a cast member, e.g. "37 · Nurse · Mangham, LA".
 *
 * Everything is optional, so this drops missing parts rather than printing
 * empty separators — a season published before its cast is fleshed out still
 * renders cleanly.
 */
export const describeCastMember = (
  member: Pick<CastOption, "age" | "occupation" | "hometown">
): string =>
  [
    typeof member.age === "number" && Number.isFinite(member.age) ? String(member.age) : null,
    member.occupation?.trim() || null,
    member.hometown?.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");

/** Compact form for a collapsed control, where the hometown does not fit. */
export const summariseCastMember = (
  member: Pick<CastOption, "age" | "occupation">
): string =>
  [
    typeof member.age === "number" && Number.isFinite(member.age) ? String(member.age) : null,
    member.occupation?.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");

export const toCastOptions = (
  castStatus: Record<string, CastMemberStatus>
): CastOption[] =>
  Object.entries(castStatus)
    .map(([name, status]) => ({
      name,
      age: status?.age ?? null,
      occupation: status?.occupation ?? null,
      hometown: status?.hometown ?? null,
      isEliminated: Boolean(status?.isEliminated),
      portraitUrl: status?.portraitUrl ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Filters the roster by a free-text query.
 *
 * Matches occupation and hometown as well as name, because with an unfamiliar
 * cast a player is far more likely to remember "the astrophysicist" or
 * "the one from Boston" than which of twenty-two strangers that was.
 */
export const filterCastOptions = (
  options: CastOption[],
  query: string
): CastOption[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;

  return options.filter((option) =>
    [option.name, option.occupation, option.hometown, String(option.age ?? "")]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(needle))
  );
};

/**
 * Normalises one cast member's stored record.
 *
 * Extracted from App's state normalisation because that code rebuilds the
 * object field by field: anything not explicitly carried across is silently
 * dropped on every load. Profile data went missing exactly that way, so this
 * lives here where it can be tested.
 */
/**
 * Bundled profiles, by name.
 *
 * Stored state is the authority, but before the first sync there is no stored
 * state — and a roster of bare names is the exact problem the redesigned picker
 * exists to solve. Seeding from the bundled cast means a cold or offline start
 * still shows who these twenty-two strangers are.
 */
const BUNDLED_PROFILES: Record<string, CastProfile> = Object.fromEntries(
  NEW_BLOOD_CAST.map((member) => [member.name, member])
);

export const normalizeCastMemberStatus = (
  input?: Partial<CastMemberStatus> | null,
  /** Used to fill age, occupation and hometown when state carries none. */
  name?: string
): CastMemberStatus => {
  const bundled = name ? BUNDLED_PROFILES[name] : undefined;
  return {
    isWinner: Boolean(input?.isWinner),
    isFirstOut: Boolean(input?.isFirstOut),
    isTraitor: Boolean(input?.isTraitor),
    isEliminated: Boolean(input?.isEliminated),
    portraitUrl:
      typeof input?.portraitUrl === "string" && input.portraitUrl.trim()
        ? input.portraitUrl
        : null,
    age:
      typeof input?.age === "number" && Number.isFinite(input.age)
        ? input.age
        : bundled?.age ?? null,
    occupation:
      typeof input?.occupation === "string" && input.occupation.trim()
        ? input.occupation
        : bundled?.occupation ?? null,
    hometown:
      typeof input?.hometown === "string" && input.hometown.trim()
        ? input.hometown
        : bundled?.hometown ?? null,
  };
};

/**
 * Works out which names make up a season's roster.
 *
 * The hardcoded CAST_NAMES list used to be merged into every roster
 * unconditionally, which meant a new season inherited the previous season's
 * cast no matter what it declared — twenty-three celebrities welded onto a
 * twenty-two person civilian line-up. It is a fallback for state that predates
 * per-season casts, not an addition.
 */
export const resolveCastNames = (
  showConfigNames: string[] | undefined,
  incomingNames: string[],
  fallbackNames: string[]
): string[] => {
  const declared = [...(showConfigNames ?? []), ...incomingNames].filter(
    (name) => typeof name === "string" && name.trim()
  );
  const source = declared.length > 0 ? declared : fallbackNames;
  return Array.from(new Set(source)).sort((a, b) => a.localeCompare(b));
};
