import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// globalThis singleton survives Turbopack chunk splits and HMR re-evaluation.
declare global {
  // eslint-disable-next-line no-var
  var __supabase: SupabaseClient | undefined;
}

export const supabase =
  globalThis.__supabase ??
  (globalThis.__supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  ));
