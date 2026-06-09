import { createClient } from '@supabase/supabase-js';

/**
 * Reads Supabase settings from .env so local/dev keys stay correct.
 * Fallback values exist for backwards compatibility — prefer env in production.
 *
 * Use Project Settings → API: **Project URL** + **anon public** key (JWT `eyJ...`).
 */
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  'https://bgufxqivlxlfebayydcl.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWZ4cWl2bHhsZmViYXl5ZGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTQzNzIsImV4cCI6MjA5NjUzMDM3Mn0.IVCaOH8PJHeLT0hMDENdSwb6rcBs_pa-nCFziTYsVDI';

if (import.meta.env.DEV && !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[GradRanger] VITE_SUPABASE_ANON_KEY is not set — using bundled fallback. If signup/login says "Failed to fetch", paste your anon key from Supabase → Settings → API into .env and restart npm run dev.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
