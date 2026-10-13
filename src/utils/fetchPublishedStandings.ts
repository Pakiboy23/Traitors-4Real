import { supabase } from "../lib/supabase";
import { logger } from "./logger";
import {
  orderByPublishedStandings,
  parsePublishedStandings,
  type PublishedStandings,
} from "./publishedStandings";
import type { PublicWeeklyRecap } from "./weeklyRecap";

export const SEASON_STANDINGS_FUNCTION = "season-standings";

/**
 * Asks the season-standings Edge Function for the board.
 * Returns null on any failure so the caller can keep the local board.
 */
export const fetchPublishedStandings = async (
  seasonId: string
): Promise<PublishedStandings | null> => {
  try {
    const { data, error } = await supabase.functions.invoke(SEASON_STANDINGS_FUNCTION, {
      body: { seasonId },
      timeout: 4000,
    });
    if (error) {
      logger.warn("season-standings request failed:", error);
      return null;
    }
    return parsePublishedStandings(data);
  } catch (error) {
    logger.warn("season-standings request failed:", error);
    return null;
  }
};

/** Public recap scores follow the server board. Week movement stays on the recap. */
export const recapWithServerStandings = async (
  recap: PublicWeeklyRecap
): Promise<PublicWeeklyRecap> => {
  const published = await fetchPublishedStandings(recap.seasonId);
  if (!published || published.seasonId !== recap.seasonId) return recap;
  const ordered = orderByPublishedStandings(recap.standings, published);
  if (!ordered) return recap;
  return { ...recap, standings: ordered };
};
