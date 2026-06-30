import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TrackingEvent {
  timestamp: string
  status: string
  description: string
  location: string | null
  source: 'shipstation' | 'easypost'
}

interface TrackingResult {
  trackingNumber: string
  carrier: string | null
  status: string
  estimatedDelivery: string | null
  events: TrackingEvent[]
  source: 'shipstation' | 'easypost'
}

// ── ShipStation ──────────────────────────────────────────────────────────────

async function fetchFromShipStation(
  trackingNumber: string,
  apiKey: string,
  apiSecret: string,
): Promise<TrackingResult | null> {
  const auth = btoa(`${apiKey}:${apiSecret}`)
  const url = `https://ssapi.shipstation.com/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}&includeShipmentItems=false`

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) return null

  const data = await res.json()
  const shipments: any[] = data?.shipments ?? []
  if (shipments.length === 0) return null

  const s = shipments[0]
  const events: TrackingEvent[] = (s.trackingHistory ?? []).map((e: any) => ({
    timestamp: e.eventDate ?? e.date ?? '',
    status: e.eventType ?? e.status ?? '',
    description: e.description ?? e.eventType ?? '',
    location: e.location ?? null,
    source: 'shipstation' as const,
  }))

  return {
    trackingNumber,
    carrier: s.carrierCode ?? null,
    status: s.shipmentStatus ?? s.deliveryStatus ?? 'unknown',
    estimatedDelivery: s.estimatedDeliveryDate ?? null,
    events,
    source: 'shipstation',
  }
}

// ── EasyPost ─────────────────────────────────────────────────────────────────

async function fetchFromEasyPost(
  trackingNumber: string,
  apiKey: string,
): Promise<TrackingResult | null> {
  // First look for an existing tracker by tracking code
  const listUrl = `https://api.easypost.com/v2/trackers?tracking_code=${encodeURIComponent(trackingNumber)}&page_size=1`
  const auth = 'Basic ' + btoa(apiKey + ':')

  let tracker: any = null

  const listRes = await fetch(listUrl, { headers: { Authorization: auth } })
  if (listRes.ok) {
    const listData = await listRes.json()
    if ((listData?.trackers ?? []).length > 0) {
      tracker = listData.trackers[0]
    }
  }

  // If not found, create a new tracker (EasyPost auto-detects carrier)
  if (!tracker) {
    const createRes = await fetch('https://api.easypost.com/v2/trackers', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracker: { tracking_code: trackingNumber } }),
    })
    if (!createRes.ok) return null
    tracker = await createRes.json()
  }

  if (!tracker) return null

  const events: TrackingEvent[] = (tracker.tracking_details ?? []).map((d: any) => ({
    timestamp: d.datetime ?? d.created_at ?? '',
    status: d.status ?? '',
    description: d.message ?? d.description ?? d.status ?? '',
    location: [d.tracking_location?.city, d.tracking_location?.state, d.tracking_location?.country]
      .filter(Boolean)
      .join(', ') || null,
    source: 'easypost' as const,
  }))

  return {
    trackingNumber,
    carrier: tracker.carrier ?? null,
    status: tracker.status ?? 'unknown',
    estimatedDelivery: tracker.est_delivery_date ?? null,
    events,
    source: 'easypost',
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { trackingNumber } = await req.json()
    if (!trackingNumber?.trim()) {
      return new Response(JSON.stringify({ error: 'trackingNumber is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user integrations from their profile
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('integrations')
      .eq('id', user.id)
      .single()

    const integrations = (profile?.integrations ?? {}) as Record<string, any>
    const ss   = integrations?.shipstation   ?? {}
    const ep   = integrations?.easypost      ?? {}

    let result: TrackingResult | null = null

    // 1. Try ShipStation
    if (ss.api_key && ss.api_secret) {
      result = await fetchFromShipStation(trackingNumber.trim(), ss.api_key, ss.api_secret)
    }

    // 2. Fall back to EasyPost
    if (!result && ep.api_key) {
      result = await fetchFromEasyPost(trackingNumber.trim(), ep.api_key)
    }

    if (!result) {
      return new Response(
        JSON.stringify({
          error: 'no_integrations',
          message: 'No tracking data found. Connect ShipStation or EasyPost in Settings > Integrations to enable live tracking.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Sort events newest-first
    result.events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
