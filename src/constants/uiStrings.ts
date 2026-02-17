/**
 * UI String Constants
 * Centralized location for all user-facing text strings
 * Benefits: Easy updates, consistency, potential i18n in the future
 */

export const ERROR_MESSAGES = {
  // Validation errors
  NAME_REQUIRED: 'Please enter your name',
  EMAIL_REQUIRED: 'Please enter your email address',
  EMAIL_INVALID: 'Please enter a valid email address',
  NAME_AND_EMAIL_REQUIRED: 'Please enter your name and email before submitting',
  AT_LEAST_ONE_PREDICTION: 'Please select at least one prediction',

  // Draft errors
  NO_DRAFT_ENTRY: "We couldn't find your draft entry yet. Please submit your draft once first.",
  NO_PICKS: 'No recognizable Draft Squad members found.',
  EMPTY_SCROLL: 'The scroll is empty.',
  MISSING_PLAYER_NAME: 'The Tome is missing a Player Name.',

  // Submission errors
  SUBMISSION_FAILED: 'Submission could not be completed. Please try again.',
  WEEKLY_SUBMISSION_FAILED: 'Weekly votes could not be submitted. Please try again.',

  // Generic errors
  SOMETHING_WENT_WRONG: 'Something went wrong. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
} as const;

export const SUCCESS_MESSAGES = {
  // Submission success
  WEEKLY_VOTE_SUBMITTED: 'Your Weekly Council vote has been submitted!',
  JR_VOTE_SUBMITTED: 'Your Jr. Council vote has been submitted!',
  DRAFT_SUBMITTED: 'Your draft has been submitted successfully!',

  // Admin actions
  PLAYER_UPDATED: 'Player details updated successfully',
  WEEKLY_UPDATED: 'Weekly Council updated',
  SCORES_ARCHIVED: 'Scores archived successfully',
  SUBMISSION_MERGED: 'Weekly vote merged successfully',
  HISTORY_CLEARED: 'Merged history cleared',
  PORTRAITS_REMOVED: 'All portraits removed',
  DATABASE_RESTORED: 'Database fully restored from Tome',
  ENTRY_INSCRIBED: "entry has been inscribed",
} as const;

export const WARNING_MESSAGES = {
  AT_LEAST_ONE_WEEKLY_OR_BONUS: 'Please select at least one weekly or bonus prediction',
  CONFIRM_DELETE: 'Are you sure you want to delete this?',
  CONFIRM_CLEAR_HISTORY: 'Clear merged submission history?',
  CONFIRM_REMOVE_PORTRAITS: 'Remove all stored portraits?',
  CONFIRM_DISMISS: 'Dismiss submission from',
} as const;

export const INFO_MESSAGES = {
  // Instructions
  DRAFT_INSTRUCTIONS: 'Already drafted? Submit your weekly banished and murdered predictions here.',
  JR_INSTRUCTIONS: 'Missed the initial draft? You can still play each week by submitting your council predictions. No draft entry required.',
  WEEKLY_OPPORTUNITIES: 'Weekly Opportunities',

  // Status
  NO_ENTRIES_YET: 'No entries yet.',
  NO_SUBMISSIONS_YET: 'No submissions yet.',
  NO_PLAYERS_TO_SCORE: 'No players to score yet.',
  NO_TRIUMPHS_YET: 'No triumphs yet revealed.',
  NO_PENALTIES_YET: 'No penalties yet. Clean sheet.',
  NO_SNAPSHOTS_YET: 'No weekly snapshots yet. Archive after each episode to track progress.',
  NO_MERGED_SUBMISSIONS: 'No merged submissions yet. New merges will appear here.',

  // Loading
  LOADING_SUBMISSIONS: 'Loading submissions...',
  SUBMITTING: 'Submitting...',

  // Sync
  LIVE_SYNC: 'Live Sync',
  LIVE_UPDATES: 'Live updates as results land',
} as const;

export const LABELS = {
  // Form labels
  NAME: 'Name',
  EMAIL: 'Email',
  YOUR_NAME: 'Your Name',
  YOUR_EMAIL: 'Your Email',

  // Predictions
  NEXT_BANISHED: 'Next Banished',
  NEXT_MURDERED: 'Next Murdered',
  PRED_FIRST_OUT: '1st Out',
  WINNER: 'Winner',
  TRAITOR_GUESSES: 'Traitor Guesses',

  // Bonus games
  REDEMPTION_ROULETTE: 'Redemption Roulette',
  DOUBLE_OR_NOTHING: 'Double or Nothing',
  SHIELD_GAMBIT: 'Shield Gambit',
  TRAITOR_TRIO: 'Traitor Trio',
  BONUS_ROUND: 'Bonus Round',

  // Actions
  SUBMIT: 'Submit',
  SAVE: 'Save',
  CANCEL: 'Cancel',
  DELETE: 'Delete',
  MERGE: 'Merge',
  DISMISS: 'Dismiss',
  REFRESH: 'Refresh',
  MERGE_ALL: 'Merge All',
  ARCHIVE_WEEK: 'Archive Week',
  DOWNLOAD_JSON: 'Download JSON',
  SIGN_OUT: 'Sign Out',
  TRY_AGAIN: 'Try Again',
  RETURN_HOME: 'Return Home',

  // Tabs
  HOME: 'Home',
  DRAFT: 'Draft',
  WEEKLY_COUNCIL: 'Weekly Council',
  LEADERBOARD: 'Leaderboard',
  ADMIN: 'Admin',

  // Status
  SEASON_MVP: 'Season MVP',
  WEEKLY_MVP: 'Weekly MVP',
  STILL_IN: 'Still In',
  ELIMINATED: 'Eliminated',
  TRAITOR: 'Traitor',
  FIRST_OUT: 'First Out',

  // Admin
  ADMIN_CONSOLE: 'Admin Console',
  CAST_STATUS: 'Cast Status',
  WEEKLY_RESULTS: 'Weekly Results',
  WEEKLY_SUBMISSIONS: 'Weekly Submissions',
  MERGED_HISTORY: 'Merged History',
  LEAGUE_ROSTER: 'League Roster',
  WEEKLY_SCORE_TRACKING: 'Weekly Score Tracking',

  // Misc
  SELECT: 'Select...',
  NONE: 'None',
  NO_MURDER: 'No Murder',
} as const;

export const BONUS_GAME_DESCRIPTIONS = {
  REDEMPTION_ROULETTE: 'Predict the next revealed traitor. +8 points if correct, but -1 if wrong. If your total score is negative, you automatically get a 2x boost (+16).',
  DOUBLE_OR_NOTHING: 'Opt in to double your weekly stakes. Correct picks earn 2x points and misses are 2x penalties.',
  SHIELD_GAMBIT: 'Guess who wins the next shield. +5 points if correct, with an extra +3 bonus when you\'re in the red.',
  TRAITOR_TRIO: 'Pick all 3 current traitors correctly for massive points. Partial credit given for each correct pick.',
} as const;

export const PLACEHOLDERS = {
  NAME: 'Name',
  EMAIL: 'Email',
  PASTE_SUBMISSION: 'Paste submission text or spreadsheet rows here...',
  PASTE_JSON: 'Paste JSON Tome here to overwrite database...',
} as const;
