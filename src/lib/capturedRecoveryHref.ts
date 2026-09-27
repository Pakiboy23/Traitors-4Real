/**
 * Snapshot the landing URL before the Supabase client is constructed.
 *
 * detectSessionInUrl reads the fragment, then clears it. This module must
 * stay free of that client so importing it first still sees `#access_token`.
 */
export const capturedRecoveryHref =
  typeof window === "undefined" ? "" : window.location.href;
