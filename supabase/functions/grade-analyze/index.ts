import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const XIMILAR_BASE = 'https://api.ximilar.com'
const POLL_INTERVAL_MS = 2000
const POLL_MAX_ATTEMPTS = 50 // ~100s of Ximilar polling in background

function authHeaders(apiKey: string) {
  return { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' }
}

async function submitGradingJob(apiKey: string, records: Record<string, unknown>[]) {
  const res = await fetch(`${XIMILAR_BASE}/account/v2/request/`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({ type: 'card-grader', endpoint: 'grade', records }),
  })
  if (!res.ok) throw new Error(`Ximilar submit failed — HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

async function pollGradingJob(apiKey: string, jobId: string) {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${XIMILAR_BASE}/account/v2/request/${jobId}`, {
      headers: authHeaders(apiKey),
    })
    if (!res.ok) throw new Error(`Ximilar poll failed — HTTP ${res.status}: ${await res.text()}`)
    const job = await res.json()
    if (job.status === 'DONE') return job
    if (job.status === 'FAILED' || job.status === 'ERROR') {
      throw new Error(`Ximilar grading job failed: ${JSON.stringify(job)}`)
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  throw new Error('Ximilar grading job timed out')
}

function parseCenteringShare(ratio: string | undefined): number | null {
  if (!ratio) return null
  const left = parseFloat(ratio.split('/')[0])
  return Number.isFinite(left) ? left : null
}

// Run Ximilar grading + save result — intended to be called via EdgeRuntime.waitUntil()
async function runGradingInBackground(
  supabase: ReturnType<typeof createClient>,
  reportId: string,
  cardId: string,
  imageFront: string,
  imageBack: string,
  apiKey: string,
) {
  try {
    const records: Record<string, unknown>[] = [{ _url: imageFront }]
    if (imageBack && imageBack !== imageFront) {
      records.push({ _url: imageBack })
    }

    const submitted = await submitGradingJob(apiKey, records)
    const job = await pollGradingJob(apiKey, submitted.id)

    const resultRecords: any[] = job.response?.records ?? []
    const front = resultRecords[0]
    const back = resultRecords[1]
    if (!front) throw new Error('Ximilar returned no grading records')

    const grades = front.grades ?? {}
    const centering = front.card?.[0]?.centering
    const corners = grades.corners ?? null
    const edges = grades.edges ?? null
    const surface = front.card?.[0]?.surface?.grade ?? back?.card?.[0]?.surface?.grade ?? null
    const finalGrade = grades.final ?? null
    const conditionLabel = grades.condition ?? null

    const summaryParts = [
      finalGrade != null
        ? `Predicted grade ${finalGrade.toFixed(1)}${conditionLabel ? ` (${conditionLabel})` : ''}.`
        : 'Grading complete.',
      centering ? `Centering ${centering['left/right']} left/right, ${centering['top/bottom']} top/bottom.` : null,
      corners != null ? `Corners ${corners}.` : null,
      edges != null ? `Edges ${edges}.` : null,
      surface != null ? `Surface ${surface}.` : null,
    ].filter(Boolean)

    await supabase.from('ai_reports').update({
      status: 'complete',
      completed_at: new Date().toISOString(),
      overall_grade: finalGrade,
      confidence_score: front._objects?.[0]?.prob ?? 0.9,
      centering_lr: parseCenteringShare(centering?.['left/right']),
      centering_tb: parseCenteringShare(centering?.['top/bottom']),
      corner_score: corners,
      edge_score: edges,
      surface_score: surface,
      condition_label: conditionLabel,
      written_summary: summaryParts.join(' '),
      annotated_front_url: front._full_url_card ?? front._exact_url_card ?? null,
      annotated_back_url: back?._full_url_card ?? back?._exact_url_card ?? null,
      raw_response: { records: resultRecords },
    }).eq('id', reportId)

    await supabase.from('cards').update({ status: 'analyzed' }).eq('id', cardId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.from('ai_reports').update({
      status: 'failed',
      error_message: message,
      raw_response: { error_message: message },
    }).eq('id', reportId)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { card_id, image_front, image_back } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const apiKey = Deno.env.get('XIMILAR_API_KEY')
    if (!apiKey) throw new Error('XIMILAR_API_KEY not set')

    if (!image_front) throw new Error('image_front is required')

    // Delete any prior failed/complete reports so polling picks up the new one
    await supabase
      .from('ai_reports')
      .delete()
      .eq('card_id', card_id)
      .in('status', ['failed', 'complete'])

    // Create the processing record immediately — client polls this
    const { data: report, error: insertError } = await supabase
      .from('ai_reports')
      .insert({ card_id, status: 'processing', source: 'ximilar' })
      .select()
      .single()

    if (insertError) throw insertError

    // Run the actual Ximilar job in the background so we can respond immediately.
    // EdgeRuntime.waitUntil keeps the function alive until the promise resolves.
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime
    if (runtime?.waitUntil) {
      runtime.waitUntil(
        runGradingInBackground(supabase, report.id, card_id, image_front, image_back ?? image_front, apiKey)
      )
    } else {
      // Local dev: just fire-and-forget (won't await completion)
      runGradingInBackground(supabase, report.id, card_id, image_front, image_back ?? image_front, apiKey)
    }

    // Return immediately — client will poll ai_reports for status
    return new Response(
      JSON.stringify({ job_id: report.id, card_id, status: 'processing' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('grade-analyze:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
