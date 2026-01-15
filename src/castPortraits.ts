import { CAST_NAMES } from "../types";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const CAST_PORTRAIT_PATHS = Object.fromEntries(
  CAST_NAMES.map((name) => [name, `/cast-portraits/${slugify(name)}.png`])
);

export const getCastPortraitSrc = (
  name: string,
  fallback?: string | null
) => CAST_PORTRAIT_PATHS[name] || fallback || "";
