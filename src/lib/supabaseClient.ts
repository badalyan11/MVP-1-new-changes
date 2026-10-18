import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when the app has been pointed at a Supabase project (see README). */
export const isCloudConfigured = Boolean(url && anonKey);

// The anon key is designed to be public: it can only do what the database's
// row-level security rules allow for the signed-in person.
export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
