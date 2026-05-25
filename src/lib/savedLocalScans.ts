import { v4 as uuidv4 } from 'uuid';
import type { CardScanAnalysisData, SavedLocalScan } from '@/types/cardScan';

const STORAGE_KEY = 'gradranger_local_scans_v1';
const MAX_ITEMS = 50;

function parseStored(): SavedLocalScan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is SavedLocalScan =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as SavedLocalScan).id === 'string' &&
        typeof (x as SavedLocalScan).savedAt === 'string' &&
        typeof (x as SavedLocalScan).analysis === 'object' &&
        (x as SavedLocalScan).analysis !== null,
    );
  } catch {
    return [];
  }
}

export function getLocalSavedScans(): SavedLocalScan[] {
  return parseStored();
}

export function removeLocalSavedScan(id: string): void {
  const next = parseStored().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/**
 * Saves analysis (and optional image) to localStorage. Drops the image if quota is exceeded.
 */
export function addLocalSavedScan(input: {
  analysis: CardScanAnalysisData;
  imageDataUrl?: string | null;
  backImageDataUrl?: string | null;
}): SavedLocalScan {
  const scans = parseStored();
  const record: SavedLocalScan = {
    id: uuidv4(),
    savedAt: new Date().toISOString(),
    analysis: input.analysis,
    imageDataUrl: input.imageDataUrl ?? undefined,
    backImageDataUrl: input.backImageDataUrl ?? undefined,
  };

  const tryPersist = (r: SavedLocalScan) => {
    const next = [r, ...scans].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  try {
    tryPersist(record);
    return record;
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.code === 22)
    ) {
      const withoutImage: SavedLocalScan = {
        ...record,
        imageDataUrl: undefined,
        backImageDataUrl: undefined,
      };
      tryPersist(withoutImage);
      return withoutImage;
    }
    throw e;
  }
}
