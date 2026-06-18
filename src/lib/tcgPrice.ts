import { supabase } from './supabase'

export interface TcgPriceResult {
  id: number
  name: string
  set_name: string
  rarity: string
  printing: string
  market_price: number | null
  low_price: number | null
  median_price: number | null
  image_url: string | null
}

export async function lookupTcgPrice(
  cardName: string,
  game: string,
  setName?: string
): Promise<TcgPriceResult[]> {
  if (!cardName) return []

  const { data, error } = await supabase.functions.invoke('tcg-price-lookup', {
    body: { cardName, game, setName },
  })

  if (error || data?.error) return []
  return data.cards ?? []
}