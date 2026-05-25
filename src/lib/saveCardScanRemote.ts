import { supabase } from '@/lib/supabase';
import type { CardScanAnalysisData } from '@/types/cardScan';

/** Human-readable notes for portfolio / watchlist rows */
export function buildScanNotes(results: CardScanAnalysisData): string {
  const pg = results.predictedGrade;
  const parts: string[] = [
    `AI scan — PSA est. ${pg.PSA}, BGS ${pg.Beckett}, CGC ${pg.CGC}`,
    `Subgrades: Centering ${results.centering}%, Corners ${results.corners}%, Edges ${results.edges}%, Surface ${results.surface}%`,
  ];
  if (results.centeringRatio != null) {
    parts.push(`Centering ratio: ${results.centeringRatio.toFixed(3)}`);
  }
  if (results.explanation) parts.push(results.explanation);
  if (results.notes) parts.push(results.notes);
  return parts.join('\n\n');
}

export async function saveScanToPortfolio(
  userId: string,
  results: CardScanAnalysisData,
): Promise<{ error: Error | null }> {
  const player =
    results.cardDetails?.player && results.cardDetails.player !== 'Unknown'
      ? results.cardDetails.player
      : 'Scanned card';
  const set =
    results.cardDetails?.set && results.cardDetails.set !== 'Unknown'
      ? results.cardDetails.set
      : 'Unknown set';

  let year = new Date().getFullYear();
  if (results.cardDetails?.year && results.cardDetails.year !== 'Unknown') {
    const y = parseInt(String(results.cardDetails.year), 10);
    if (!Number.isNaN(y)) year = y;
  }

  const grade =
    typeof results.predictedGrade.PSA === 'number'
      ? results.predictedGrade.PSA
      : null;

  const { error } = await supabase.from('portfolio_items').insert([
    {
      user_id: userId,
      player,
      year,
      set,
      grade,
      grading_company: 'Scanner estimate',
      quantity: 1,
      notes: buildScanNotes(results),
    },
  ]);

  return { error: error ? new Error(error.message) : null };
}

export async function saveScanToWatchlist(
  userId: string,
  results: CardScanAnalysisData,
): Promise<{ error: Error | null }> {
  const card_name =
    results.cardDetails?.player && results.cardDetails.player !== 'Unknown'
      ? results.cardDetails.player
      : 'Scanned card';
  const card_set =
    results.cardDetails?.set && results.cardDetails.set !== 'Unknown'
      ? results.cardDetails.set
      : null;

  const { error } = await supabase.from('watchlist').insert({
    user_id: userId,
    card_name,
    card_set,
    notes: buildScanNotes(results),
  });

  return { error: error ? new Error(error.message) : null };
}
