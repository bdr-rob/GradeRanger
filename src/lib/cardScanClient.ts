import { supabase } from "@/lib/supabase";
import type {
  CardScanAnalysisData,
  CardScanApiResponse,
} from "@/types/cardScan";

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getScannerApiBaseUrl(): string | undefined {
  const url = import.meta.env.VITE_SCANNER_API_URL?.trim();
  return url || undefined;
}

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
      "Demo mode — grade-analyze edge function unavailable and VITE_SCANNER_API_URL not set.",
    centeringRatio: 0.5,
    centeringGradeLabel: "8",
    explanation:
      "Placeholder output for UI development. Production uses Claude Sonnet via the grade-analyze edge function.",
    warnings: [],
  };
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

/**
 * Converts a base64 string to a Blob and uploads it to Supabase Storage.
 * Returns the public URL — required because Claude fetches images by URL,
 * not by inline base64 in the request body.
 */
async function uploadBase64ToStorage(
  base64: string,
  cardId: string,
  side: "front" | "back"
): Promise<string> {
  // Strip data URI prefix if present (data:image/jpeg;base64,...)
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;

  const byteChars = atob(raw);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: "image/jpeg" });
  const path = `cards/${cardId}/${side}-${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from("card-images")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

  if (error) throw new Error(`Upload failed (${side}): ${error.message}`);

  return supabase.storage.from("card-images").getPublicUrl(path).data.publicUrl;
}

// ─── Response Mapping ─────────────────────────────────────────────────────────

/**
 * Maps the grade-analyze edge function response → CardScanAnalysisData.
 *
 * Scale differences handled here:
 *   centering score   → already 0–100 (set by Claude prompt)
 *   corners/edges     → 0–10 (PSA scale) → multiply × 10 → 0–100
 *   surface front/back → 0–10 → average → × 10 → 0–100
 *   confidence        → 0–1 → × 100 → 0–100
 */
function mapReportToScanData(report: any): CardScanAnalysisData {
  const dim = report.dimensions ?? {};
  const centering = dim.centering ?? {};
  const corners = dim.corners ?? {};
  const edges = dim.edges ?? {};
  const surface = dim.surface ?? {};
  const grades = report.grades ?? {};

  // Centering (already 0–100)
  const lr = centering.lr ?? 80;
  const tb = centering.tb ?? 80;
  const centeringScore = centering.score ?? Math.round((lr + tb) / 2);

  // Other dimensions (0–10 → 0–100)
  const cornersScore = Math.round((corners.score ?? 8) * 10);
  const edgesScore = Math.round((edges.score ?? 8) * 10);
  const surfaceAvg = ((surface.front ?? 8) + (surface.back ?? 8)) / 2;
  const surfaceScore = Math.round(surfaceAvg * 10);

  // Confidence (0–1 → 0–100)
  const confidence = Math.round((report.confidence ?? 0.75) * 100);

  // Centering grade label from worst-axis offset
  const lrOffset = Math.min(lr, 100 - lr); // e.g. 85/15 → 15
  const tbOffset = Math.min(tb, 100 - tb);
  const worstOffset = Math.min(lrOffset, tbOffset);
  const centeringGradeLabel =
    worstOffset >= 47 ? "10" :
    worstOffset >= 44 ? "9.5" :
    worstOffset >= 40 ? "9" :
    worstOffset >= 35 ? "8.5" :
    worstOffset >= 30 ? "8" : "7";

  // Centering ratio (0.5 = perfect)
  const centeringRatio = Math.min(lr, 100 - lr) / 100;

  // Aggregate all defects into warnings
  const warnings: string[] = [
    ...(report.warnings ?? []),
    ...(corners.defects ?? []),
    ...(edges.defects ?? []),
    ...(surface.defects ?? []),
  ];
  const cardId = report.card_identification;
  
  // Explanation — lead with grading recommendation
  const explanation = [
    report.grading_recommendation
      ? `Best submission: ${report.grading_recommendation} — ${report.grading_recommendation_reason ?? ""}`
      : "",
    report.summary ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    centering: centeringScore,
    corners: cornersScore,
    edges: edgesScore,
    surface: surfaceScore,
    predictedGrade: {
      PSA: grades.PSA?.grade ?? report.overall_grade ?? 8,
      Beckett: grades.BGS?.grade ?? report.overall_grade ?? 8,
      CGC: grades.CGC?.grade ?? report.overall_grade ?? 8,
    },
    confidence,
    // dealScore is 0 here — it requires live market pricing and is calculated
    // separately by calculateDealScore() in scoringModel once pricing is fetched
    dealScore: 0,
    notes: report.summary ?? "",
    centeringRatio,
    centeringGradeLabel,
    explanation,
    warnings,
  };
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

/**
 * Analyze front + back card images with three-tier fallback:
 *
 *   1. Claude Sonnet via grade-analyze edge function   ← PRODUCTION
 *   2. Local Python scanner at VITE_SCANNER_API_URL    ← DEV FALLBACK
 *   3. getDemoAnalysis()                               ← LAST RESORT
 */
export async function analyzeCardRemote(
  frontImageBase64: string,
  backImageBase64: string,
  cardId = `scan-${Date.now()}`
): Promise<CardScanAnalysisData> {

  // ── PATH 1: Claude Sonnet (production) ───────────────────────────────────
  try {
    // Upload images to Supabase Storage → get public URLs for Claude
    const [frontUrl, backUrl] = await Promise.all([
      uploadBase64ToStorage(frontImageBase64, cardId, "front"),
      uploadBase64ToStorage(backImageBase64, cardId, "back"),
    ]);

    const { data, error } = await supabase.functions.invoke("grade-analyze", {
      body: { card_id: cardId, image_front: frontUrl, image_back: backUrl },
    });

    if (error) throw error;

    // Edge function returns complete immediately (synchronous Claude call)
    if (data?.status === "complete" && data?.report) {
      return mapReportToScanData(data.report);
    }

    throw new Error("grade-analyze returned unexpected shape");
  } catch (err) {
    console.warn("[cardScanClient] grade-analyze failed:", err);
  }

  // ── PATH 2: Local Python scanner (dev fallback) ───────────────────────────
  const base = getScannerApiBaseUrl();
  if (base) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: frontImageBase64,
          backImageBase64,
        }),
      });

      const json = (await res.json()) as CardScanApiResponse & {
        detail?: string | string[];
      };

      if (res.ok && json.success && json.data) {
        return json.data;
      }

      const detail = json.detail;
      throw new Error(
        Array.isArray(detail)
          ? detail.map(String).join(", ")
          : typeof detail === "string"
          ? detail
          : json.error ?? `Scanner error (${res.status})`
      );
    } catch (localErr) {
      console.warn("[cardScanClient] local scanner failed:", localErr);
    }
  }

  // ── PATH 3: Demo data (last resort) ──────────────────────────────────────
  console.warn("[cardScanClient] All paths failed — returning demo data");
  return getDemoAnalysis();
}