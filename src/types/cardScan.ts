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
  /** Horizontal balance: ~0.5 is centered; below 0.5 shifted left, above shifted right */
  centeringRatio?: number;
  /** PSA-style label from centering heuristic (informational only) */
  centeringGradeLabel?: string;
  explanation?: string;
  warnings?: string[];
}

export interface CardScanApiResponse {
  success: boolean;
  error?: string;
  data?: CardScanAnalysisData;
}
