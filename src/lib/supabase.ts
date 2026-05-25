import { createClient } from '@supabase/supabase-js';

/**
 * Reads Supabase settings from .env so local/dev keys stay correct.
 * Fallback values exist for backwards compatibility — prefer env in production.
 *
 * Use Project Settings → API: **Project URL** + **anon public** key (JWT `eyJ...`).
 */
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  'https://siwatqcfmopzjdfykhqv.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_OHQnLWjqug_VHiGWCvqu6A_T9G_LZkg';

if (import.meta.env.DEV && !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[GradRanger] VITE_SUPABASE_ANON_KEY is not set — using bundled fallback. If signup/login says "Failed to fetch", paste your anon key from Supabase → Settings → API into .env and restart npm run dev.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
