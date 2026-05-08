import type {
  CardScanAnalysisData,
  CardScanApiResponse,
} from '@/types/cardScan';

export function getScannerApiBaseUrl(): string | undefined {
  const url = import.meta.env.VITE_SCANNER_API_URL?.trim();
  return url || undefined;
}

/** Deterministic demo payload when no API URL is configured (local dev). */
export function getDemoAnalysis(): CardScanAnalysisData {
  return {
    centering: 82,
    corners: 79,
    edges: 84,
    surface: 88,
    predictedGrade: { PSA: 8, Beckett: 8.5, CGC: 8.5 },
    confidence: 72,
    dealScore: 3.5,
    notes:
      'Demo mode — no scanner API URL set. Add VITE_SCANNER_API_URL in .env to use the Python service.',
    centeringRatio: 0.5,
    centeringGradeLabel: '9',
    explanation:
      'This is placeholder output so you can style the UI. Connect the FastAPI scanner for real estimates.',
    warnings: [],
  };
}

export async function analyzeCardRemote(
  imageBase64NoPrefix: string,
): Promise<CardScanAnalysisData> {
  const base = getScannerApiBaseUrl();
  if (!base) {
    throw new Error('Scanner API URL is not configured');
  }

  const url = `${base.replace(/\/$/, '')}/analyze`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: imageBase64NoPrefix }),
  });

  const json = (await res.json()) as CardScanApiResponse & {
    detail?: string | string[];
  };

  if (!res.ok || !json.success || !json.data) {
    const detail = json.detail;
    const detailStr = Array.isArray(detail)
      ? detail.map(String).join(', ')
      : typeof detail === 'string'
        ? detail
        : undefined;
    throw new Error(
      detailStr || json.error || `Analysis failed (${res.status})`,
    );
  }

  return json.data;
}
