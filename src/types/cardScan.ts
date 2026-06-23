/** Request body for POST /analyze */
export interface CardScanRequest {
  /** Front of the card */
  imageBase64: string;
  /** Back of the card (required) */
  backImageBase64: string;
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

/** Persisted output of the 5-stage GradingDecisionEngine */
export interface GradingDecision {
  stage1Result: 'advance' | 'eliminated';
  stage2Result: 'gem_mint' | 'strong_9' | 'fail';
  stage3Zone: 'green' | 'yellow' | 'red';
  route: 'PSA' | 'BGS' | 'SGC' | 'hold' | 'do_not_submit';
  rawCost?: number;
  allInCost?: number;
  netProfit?: number;
  finalChecklist: boolean;
  decidedAt: string;
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

  /** Saved after user completes the grading decision engine */
  gradingDecision?: GradingDecision;
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
  /** Front preview */
  imageDataUrl?: string;
  /** Back preview */
  backImageDataUrl?: string;
}

// ── Change 1: PredictedGrades — add SGC and TAG ────────────────────────────
export interface PredictedGrades {
  PSA: number;
  Beckett: number;    // BGS
  CGC: number;
  SGC?: number;       // ← add
  TAG?: number;       // ← add
}
// ── Change 2: GradingDecision.route — add CGC and TAG ─────────────────────
export interface GradingDecision {
  stage1Result: 'advance' | 'eliminated';
  stage2Result: 'gem_mint' | 'strong_9' | 'fail';
  stage3Zone: 'green' | 'yellow' | 'red';
  route: 'PSA' | 'BGS' | 'CGC' | 'SGC' | 'TAG' | 'hold' | 'do_not_submit'; // ← added CGC, TAG
  rawCost?: number;
  allInCost?: number;
  netProfit?: number;
  finalChecklist: boolean;
  decidedAt: string;
}
