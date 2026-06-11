import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      .insert({ card_id, status: 'processing' })
      .select()
      .single()

    if (insertError) throw insertError

    const prompt = `You are a professional sports card grader with expertise equivalent to PSA, BGS, and SGC graders. Analyze these card images and provide a detailed grading assessment.

Grade each dimension on a 1-10 scale where 10 is perfect/gem mint:
- CENTERING: Border ratios left-to-right and top-to-bottom (50/50 is perfect)
- CORNERS: All four corners for wear, fraying, or rounding
- EDGES: All four edges for nicks, chips, or roughness  
- SURFACE: Front and back for scratches, print defects, stains, or creases

Respond with ONLY valid JSON — no markdown, no explanation outside the JSON:
{
  "overall_grade": <1-10 to one decimal>,
  "confidence": <0.0-1.0>,
  "centering_lr": <left border % e.g. 55 means 55/45>,
  "centering_tb": <top border % e.g. 52 means 52/48>,
  "corner_score": <1-10>,
  "edge_score": <1-10>,
  "surface_front_score": <1-10>,
  "surface_back_score": <1-10>,
  "summary": "<2-3 sentences describing condition and key defects>"
}`

    const images = [
      { type: 'image', source: { type: 'url', url: image_front } },
    ]
    if (image_back && image_back !== image_front) {
      images.push({ type: 'image', source: { type: 'url', url: image_back } })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [...images, { type: 'text', text: prompt }],
        }],
      }),
    })

    if (!response.ok) throw new Error(`Anthropic error: ${await response.text()}`)

    const aiData = await response.json()
    const rawText = aiData.content[0]?.text ?? '{}'

    let grades: any = {}
    try {
      const match = rawText.match(/\{[\s\S]*\}/)
      grades = match ? JSON.parse(match[0]) : {}
    } catch {
      grades = { overall_grade: 5, confidence: 0.5, summary: rawText }
    }

    const surfaceScore = ((grades.surface_front_score ?? 5) + (grades.surface_back_score ?? 5)) / 2

    await supabase.from('ai_reports').update({
      status: 'complete',
      completed_at: new Date().toISOString(),
      overall_grade: grades.overall_grade ?? 5,
      confidence_score: grades.confidence ?? 0.7,
      centering_lr: grades.centering_lr ?? 50,
      centering_tb: grades.centering_tb ?? 50,
      corner_score: grades.corner_score ?? 5,
      edge_score: grades.edge_score ?? 5,
      surface_score: surfaceScore,
      written_summary: grades.summary ?? 'Analysis complete.',
      raw_response: grades,
    }).eq('id', report.id)

    await supabase.from('cards').update({ status: 'analyzed' }).eq('id', card_id)

    return new Response(
      JSON.stringify({ job_id: report.id, card_id, status: 'complete' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    console.error('grade-analyze:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})