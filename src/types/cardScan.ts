/** Request body for POST /analyze */
export interface CardScanRequest {
  imageBase64: string;
}

export interface PredictedGrades {
  PSA: number;
  Beckett: number;
  CGC: number;
}

export interface CardDetails {
  player?: string;
  year?: string;
  set?: string;
}

/** ✅ NEW: Detailed identification (upgrade from CardDetails) */
export interface CardIdentification {
  player: string;
  year: string;
  set: string;
  variant?: string;
  confidence: number;
}

/** ✅ NEW: Market pricing */
export interface CardPricing {
  raw_avg: number;
  psa9_avg: number;
  psa10_avg: number;
}

/** ✅ NEW: Profit / decision engine */
export interface ProfitAnalysis {
  expected_value: number;
  grading_cost: number;
  recommendation: "BUY" | "WATCH" | "PASS";
}

/** Shared shape for UI + scanner API (camelCase over the wire). */
export interface CardScanAnalysisData {
  centering: number;
  corners: number;
  edges: number;
  surface: number;

  predictedGrade: PredictedGrades;

  confidence: number;
  dealScore: number;

  notes?: string;
  cardDetails?: CardDetails;

  /** ✅ ADD HERE — new system */
  cardIdentification?: CardIdentification;
  pricing?: CardPricing;
  profitAnalysis?: ProfitAnalysis;

  /** Horizontal balance: ~0.5 is centered */
  centeringRatio?: number;

  /** PSA-style label */
  centeringGradeLabel?: string;

  explanation?: string;
  warnings?: string[];
}

export interface CardScanApiResponse {
  success: boolean;
  error?: string;
  data?: CardScanAnalysisData;
}

/** Where the user chose to store a scan */
export type CardScanSaveTarget = 'device' | 'portfolio' | 'watchlist';

/** Browser-only saved scan */
export interface SavedLocalScan {
  id: string;
  savedAt: string;
  analysis: CardScanAnalysisData;
  imageDataUrl?: string;
}


