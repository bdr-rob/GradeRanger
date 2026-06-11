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

    const XIMILAR_API_KEY = Deno.env.get('XIMILAR_API_KEY')
    if (!XIMILAR_API_KEY) throw new Error('XIMILAR_API_KEY not configured')

    const records = images.map((img: { id: string; base64?: string; url?: string }) =>
      img.base64
        ? { _id: img.id, _base64: img.base64 }
        : { _id: img.id, _url: img.url }
    )

    // Try the general collectibles endpoint
    const response = await fetch('https://api.ximilar.com/collectibles/v2/recognize', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${XIMILAR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records }),
    })

    const responseText = await response.text()

    if (!response.ok) {
      // Return the actual Ximilar error so we can debug it
      throw new Error(`Ximilar ${response.status}: ${responseText}`)
    }

    const data = JSON.parse(responseText)

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