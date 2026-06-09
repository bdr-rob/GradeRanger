/**
 * Grade Ranger AI Analysis API client.
 *
 * The actual API call goes through a Supabase Edge Function so the
 * API key is never exposed to the browser.
 *
 * Fallback: if the edge function is unavailable we use the local
 * Python scanner at VITE_SCANNER_API_URL (which returns scores in
 * the same shape after normalisation below).
 */

import { supabase } from '@/lib/supabase';
import type { AIReport } from '@/types/cards';

export interface SubmitAnalysisResult {
  job_id: string;
  card_id: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  estimated_completion_seconds?: number;
}

export interface PollResult {
  job_id: string;
  card_id: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  progress_pct?: number;
  report?: {
    report_id: string;
    overall_grade: number;
    confidence: number;
    dimensions: {
      centering: { lr: number; tb: number; score: number };
      corners: { score: number; notes?: string };
      edges: { score: number; notes?: string };
      surface: { front: number; back: number; notes?: string };
    };
    summary: string;
    annotated_front_url?: string;
    annotated_back_url?: string;
  };
  error_code?: string;
  error_message?: string;
}

const SCANNER_API_URL = import.meta.env.VITE_SCANNER_API_URL ?? 'http://127.0.0.1:8000';

/**
 * Submit a card for AI analysis.
 * Tries the Grade Ranger AI API via Supabase edge function first;
 * falls back to the local Python scanner for development.
 */
export async function submitCardForAnalysis(
  cardId: string,
  imageFrontUrl: string,
  imageBackUrl: string,
): Promise<SubmitAnalysisResult> {
  try {
    const { data, error } = await supabase.functions.invoke('grade-analyze', {
      body: { card_id: cardId, image_front: imageFrontUrl, image_back: imageBackUrl },
    });
    if (error) throw error;
    return data as SubmitAnalysisResult;
  } catch {
    // Fallback: create a pending record and kick off the local scanner
    const { data: report, error: insertError } = await supabase
      .from('ai_reports')
      .insert({ card_id: cardId, status: 'pending' })
      .select()
      .single();

    if (insertError) throw insertError;
    runLocalScanner(cardId, report.id, imageFrontUrl, imageBackUrl);
    return { job_id: report.id, card_id: cardId, status: 'queued', estimated_completion_seconds: 10 };
  }
}

/**
 * Poll the status of an AI analysis job.
 */
export async function pollAnalysisJob(jobId: string): Promise<PollResult> {
  const { data, error } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) throw error;
  const report = data as AIReport;

  if (report.status === 'complete') {
    return {
      job_id: report.id,
      card_id: report.card_id,
      status: 'complete',
      report: {
        report_id: report.id,
        overall_grade: report.overall_grade ?? 0,
        confidence: report.confidence_score ?? 0,
        dimensions: {
          centering: {
            lr: report.centering_lr ?? 50,
            tb: report.centering_tb ?? 50,
            score: ((report.centering_lr ?? 50) + (report.centering_tb ?? 50)) / 2,
          },
          corners: { score: report.corner_score ?? 0 },
          edges: { score: report.edge_score ?? 0 },
          surface: { front: report.surface_score ?? 0, back: report.surface_score ?? 0 },
        },
        summary: report.written_summary ?? '',
        annotated_front_url: report.annotated_front_url,
        annotated_back_url: report.annotated_back_url,
      },
    };
  }

  if (report.status === 'failed') {
    return {
      job_id: report.id,
      card_id: report.card_id,
      status: 'failed',
      error_code: (report.raw_response as any)?.error_code,
      error_message: (report.raw_response as any)?.error_message ?? 'Analysis failed',
    };
  }

  return { job_id: report.id, card_id: report.card_id, status: report.status as any };
}

/**
 * Run the local Python scanner as a development fallback.
 * Converts OpenCV scores (0-100) to the ai_reports schema and saves them.
 */
async function runLocalScanner(
  cardId: string,
  reportId: string,
  frontUrl: string,
  _backUrl: string,
) {
  try {
    // Update to processing
    await supabase.from('ai_reports').update({ status: 'processing' }).eq('id', reportId);

    const res = await fetch(`${SCANNER_API_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: '', backImageBase64: '', image_url: frontUrl }),
    });

    if (!res.ok) throw new Error('Scanner returned error');
    const scan = await res.json();
    const d = scan.data ?? scan;

    // Convert scanner scores (0-100) into a grade-like 0-10 scale
    const toGrade = (score: number) => Math.round((score / 100) * 10 * 10) / 10;
    const centering = d.centering ?? 80;
    const corners = d.corners ?? 80;
    const edges = d.edges ?? 80;
    const surface = d.surface ?? 80;
    const overall = Math.round(((centering + corners + edges + surface) / 4 / 10) * 10) / 10;

    await supabase
      .from('ai_reports')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        overall_grade: toGrade(overall * 10),
        confidence_score: d.confidence ?? 0.75,
        centering_lr: centering,
        centering_tb: centering,
        corner_score: toGrade(corners),
        edge_score: toGrade(edges),
        surface_score: toGrade(surface),
        written_summary: d.explanation ?? 'Analysis complete.',
        raw_response: d,
      })
      .eq('id', reportId);

    // Flip card status
    await supabase.from('cards').update({ status: 'intake' }).eq('id', cardId);
  } catch (err) {
    await supabase
      .from('ai_reports')
      .update({ status: 'failed', raw_response: { error_message: String(err) } })
      .eq('id', reportId);
  }
}
