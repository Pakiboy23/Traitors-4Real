/**
 * Input validation utilities for form submissions and user input
 */

/**
 * Sanitizes a name by removing potentially dangerous characters
 * and limiting length
 */
export const sanitizeName = (name: string): string => {
  return name
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML injection
    .slice(0, 100); // Limit length
};

/**
 * Sanitizes an email address
 */
export const sanitizeEmail = (email: string): string => {
  return email
    .trim()
    .toLowerCase()
    .replace(/[<>]/g, '')
    .slice(0, 254); // RFC 5321 max length
};

/**
 * Validates an email format
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || email.length === 0) return false;
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates a name is not empty and within reasonable length
 */
export const isValidName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 100;
};

/**
 * Validates that a player has made at least one prediction
 */
export const hasValidPredictions = (
  banished: string,
  murdered: string,
  bonusGames?: {
    redemptionRoulette?: string;
    doubleOrNothing?: boolean;
    shieldGambit?: string;
    traitorTrio?: string[];
  }
): boolean => {
  const hasBanished = Boolean(banished && banished.trim());
  const hasMurdered = Boolean(murdered && murdered.trim());
  const hasRedemption = Boolean(bonusGames?.redemptionRoulette?.trim());
  const hasDouble = Boolean(bonusGames?.doubleOrNothing);
  const hasShield = Boolean(bonusGames?.shieldGambit?.trim());
  const hasTrio = Boolean(bonusGames?.traitorTrio?.some(t => t.trim()));

  return hasBanished || hasMurdered || hasRedemption || hasDouble || hasShield || hasTrio;
};

/**
 * Validates draft picks array
 */
export const hasValidPicks = (picks: any[]): boolean => {
  return Array.isArray(picks) && picks.length > 0;
};

/**
 * Sanitizes a URL for portrait images
 */
export const sanitizeUrl = (url: string): string => {
  const trimmed = url.trim();
  // Basic URL validation
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return '';
  }
};

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a player submission for weekly council
 */
export const validateWeeklySubmission = (
  name: string,
  email: string,
  banished: string,
  murdered: string,
  bonusGames?: {
    redemptionRoulette?: string;
    doubleOrNothing?: boolean;
    shieldGambit?: string;
    traitorTrio?: string[];
  }
): ValidationResult => {
  const errors: string[] = [];

  if (!isValidName(name)) {
    errors.push('Please enter a valid name');
  }

  if (!isValidEmail(email)) {
    errors.push('Please enter a valid email address');
  }

  if (!hasValidPredictions(banished, murdered, bonusGames)) {
    errors.push('Please make at least one prediction');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a draft entry submission
 */
export const validateDraftEntry = (
  name: string,
  email: string,
  picks: any[]
): ValidationResult => {
  const errors: string[] = [];

  if (!isValidName(name)) {
    errors.push('Please enter a valid name');
  }

  if (!isValidEmail(email)) {
    errors.push('Please enter a valid email address');
  }

  if (!hasValidPicks(picks)) {
    errors.push('Please select at least one draft pick');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
