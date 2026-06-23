import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const XIMILAR_BASE = 'https://api.ximilar.com'
const POLL_INTERVAL_MS = 1500
const POLL_MAX_ATTEMPTS = 60 // ~90s — covers ~10-20s/image x2 images with headroom

function authHeaders(apiKey: string) {
  return { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' }
}

// Card-grader is async-only: submit a job, then poll until DONE. We poll
// synchronously inside this function call (rather than returning a job id
// for the client to poll against Ximilar directly) so the existing
// ai_reports-based polling contract — and every component built on it —
// doesn't need to change.
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

// "46/54" -> 46 (the left/top share, matching how AIReportViewer already
// renders centering_lr/centering_tb as a percentage).
function parseCenteringShare(ratio: string | undefined): number | null {
  if (!ratio) return null
  const left = parseFloat(ratio.split('/')[0])
  return Number.isFinite(left) ? left : null
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

    // Create processing record immediately
    const { data: report, error: insertError } = await supabase
      .from('ai_reports')
      .insert({ card_id, status: 'processing', source: 'ximilar' })
      .select()
      .single()

    if (insertError) throw insertError

    try {
      const apiKey = Deno.env.get('XIMILAR_API_KEY')
      if (!apiKey) throw new Error('XIMILAR_API_KEY not set')

      const records: Record<string, unknown>[] = [{ _url: image_front }]
      if (image_back && image_back !== image_front) {
        records.push({ _url: image_back })
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
      // Surface/centering are inherently per-side — prefer front, fall back to back.
      const surface = front.card?.[0]?.surface?.grade ?? back?.card?.[0]?.surface?.grade ?? null
      const finalGrade = grades.final ?? null
      const conditionLabel = grades.condition ?? null

      const summaryParts = [
        finalGrade != null ? `Predicted grade ${finalGrade.toFixed(1)}${conditionLabel ? ` (${conditionLabel})` : ''}.` : 'Grading complete.',
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
      }).eq('id', report.id)

      await supabase.from('cards').update({ status: 'analyzed' }).eq('id', card_id)

      return new Response(
        JSON.stringify({ job_id: report.id, card_id, status: 'complete' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    } catch (gradingErr) {
      // The processing row already exists and the client polls it directly —
      // if we don't flip it to failed here, the UI is stuck on "Analyzing…" forever.
      // AIReportViewer reads the failure reason from raw_response.error_message,
      // so set both that and the dedicated column.
      const message = gradingErr instanceof Error ? gradingErr.message : String(gradingErr)
      await supabase.from('ai_reports').update({
        status: 'failed',
        error_message: message,
        raw_response: { error_message: message },
      }).eq('id', report.id)
      throw gradingErr
    }

  } catch (err) {
    console.error('grade-analyze:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
