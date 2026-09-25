import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

/**
 * Server-only Supabase client. The service-role key bypasses RLS, so this
 * module must stay on the server: recap routes import it, client components
 * must not. Next does not inline a non-NEXT_PUBLIC env var into the browser
 * bundle unless a client component imports this file.
 */
export const createSupabaseAdmin = (): SupabaseClient<Database> | null => {
  if (typeof window !== "undefined") return null;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
