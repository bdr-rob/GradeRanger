import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { images } = await req.json()
    // images: Array<{ id: string, base64?: string, url?: string }>

    const XIMILAR_API_KEY = Deno.env.get('XIMILAR_API_KEY')
    if (!XIMILAR_API_KEY) throw new Error('XIMILAR_API_KEY not configured')

    const records = images.map((img: { id: string; base64?: string; url?: string }) =>
      img.base64
        ? { _id: img.id, _base64: img.base64 }
        : { _id: img.id, _url: img.url }
    )

    const response = await fetch('https://api.ximilar.com/card/v2/recognize', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${XIMILAR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Ximilar API error: ${err}`)
    }

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})