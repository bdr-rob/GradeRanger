import { supabase } from '@/lib/supabase';

export interface ScannedImage {
  id: string;        // local uuid
  base64: string;    // jpeg base64 (no data: prefix)
  preview: string;   // data:image/jpeg;base64,... for <img> display
}

export interface XimilarMatch {
  id: string;
  player: string;
  name: string;
  year: string;
  set_name: string;
  card_number: string;
  sport: string;
  parallel?: string;
  variation?: string;
}

export interface RecognizedCard {
  localId: string;
  image: ScannedImage;
  bestMatch: XimilarMatch | null;
  confidence: number; // 0–1
  allMatches: XimilarMatch[];
  // User-editable fields
  purchasePrice: string;
  purchaseLocation: string;
  confirmed: boolean;
}

export async function recognizeCards(images: ScannedImage[]): Promise<RecognizedCard[]> {
  const { data, error } = await supabase.functions.invoke('ximilar-recognize', {
    body: {
      images: images.map((img) => ({ id: img.id, base64: img.base64 })),
    },
  });

  if (error) throw new Error(error.message);

  // Map Ximilar response records back to our images
  const recordMap = new Map<string, any>();
  for (const rec of data.records ?? []) {
    recordMap.set(rec._id, rec);
  }

  return images.map((img) => {
    const rec = recordMap.get(img.id);
    const bestMatch = rec?.best_match ?? null;
    const confidence = rec?.best_match_probability ?? 0;
    const allMatches = rec?.matches?.map((m: any) => m.card) ?? [];

    return {
      localId: img.id,
      image: img,
      bestMatch,
      confidence,
      allMatches,
      purchasePrice: '',
      purchaseLocation: '',
      confirmed: false,
    };
  });
}