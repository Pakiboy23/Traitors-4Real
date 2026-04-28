import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

// Literal access required — Next.js inlines NEXT_PUBLIC_* at build time only for direct property expressions.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
