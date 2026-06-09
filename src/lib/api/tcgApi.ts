/**
 * TCG API (tcgapi.dev) client — market pricing for TCG cards.
 * Requires a Pro plan ($49.99/mo) for commercial use.
 * Sports cards are NOT covered — use eBay Browse API for those.
 */

const TCG_API_BASE = 'https://api.tcgapi.dev/v1';
const API_KEY = import.meta.env.VITE_TCG_API_KEY ?? '';

export interface TcgCard {
  id: number;
  name: string;
  set_name: string;
  rarity?: string;
  market_price?: number;
  low_price?: number;
  median_price?: number;
  lowest_with_shipping?: number;
  image_url?: string;
}

export interface TcgSearchResult {
  data: TcgCard[];
  rate_limit?: { daily_limit: number; daily_remaining: number };
}

export async function searchTcgPrices(
  cardName: string,
  game?: string,
): Promise<TcgSearchResult> {
  if (!API_KEY) {
    console.warn('[TCG API] VITE_TCG_API_KEY not set — returning empty result');
    return { data: [] };
  }

  const params = new URLSearchParams({ q: cardName });
  if (game) params.set('game', game);

  const res = await fetch(`${TCG_API_BASE}/search?${params}`, {
    headers: { 'X-API-Key': API_KEY },
  });

  if (!res.ok) {
    console.error('[TCG API] request failed', res.status);
    return { data: [] };
  }

  return res.json();
}

export async function getTcgCardById(id: number): Promise<TcgCard | null> {
  if (!API_KEY) return null;

  const res = await fetch(`${TCG_API_BASE}/cards/${id}`, {
    headers: { 'X-API-Key': API_KEY },
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}
