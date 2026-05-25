/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCANNER_API_URL?: string;
  /** e.g. https://xxxx.supabase.co — Project Settings → API */
  readonly VITE_SUPABASE_URL?: string;
  /** anon / public key (JWT starting with eyJ…) — Project Settings → API */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
