/**
 * Where a cast member's portrait lives.
 *
 * This used to be a lookup table built from the hardcoded celebrity cast, which
 * meant it only ever resolved for that one season: drop a photo in for anybody
 * else and nothing happened, because their name was not a key. Portraits are
 * now derived from the name, so adding `public/cast-portraits/abbey-benjamin.png`
 * is the whole job.
 *
 * A derived path can point at a file that does not exist, so every caller
 * renders through <CastPortrait>, which falls back to the initial when the
 * image fails to load. Returning a path here is a claim about naming, not a
 * promise that the file is present.
 */

export const slugifyCastName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const getCastPortraitSrc = (
  name: string,
  fallback?: string | null
): string => {
  // An explicit URL on the cast member wins: it is set deliberately, and may
  // point somewhere other than the bundled folder.
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();

  const slug = slugifyCastName(name ?? "");
  return slug ? `/cast-portraits/${slug}.png` : "";
};
