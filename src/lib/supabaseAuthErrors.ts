/**
 * Turn Supabase/auth/network failures into actionable UI copy for beginners.
 */
export function describeAuthNetworkError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';

  const lower = raw.toLowerCase();
  const isFetchFailure =
    raw === 'Failed to fetch' ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed');

  if (isFetchFailure) {
    return (
      'Cannot reach Supabase. Fix: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file (Supabase → Project Settings → API — use the anon key that starts with eyJ). Restart npm run dev. In Supabase → Authentication → URL Configuration, add your site (e.g. http://localhost:8080). Try disabling ad blockers; resume the project if it was paused.'
    );
  }

  return raw || 'Something went wrong. Please try again.';
}
