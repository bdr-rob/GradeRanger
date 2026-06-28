import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Get user from JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authErr || !user) return new Response('Unauthorized', { status: 401 })

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Sum holdings (non-sold, non-intake without value)
  const { data: holdings } = await supabase
    .from('cards')
    .select('purchase_price, market_value, status')
    .eq('user_id', user.id)
    .neq('status', 'sold')

  // Sum sold cards for realized gains (market_value is best approximation without a sold_price field)
  const { data: sold } = await supabase
    .from('cards')
    .select('purchase_price, market_value')
    .eq('user_id', user.id)
    .eq('status', 'sold')

  const totalCost  = (holdings ?? []).reduce((s, c) => s + (c.purchase_price ?? 0), 0)
  const totalValue = (holdings ?? []).reduce((s, c) => s + (c.market_value  ?? c.purchase_price ?? 0), 0)
  const cardCount  = (holdings ?? []).length
  const realizedGains = (sold ?? []).reduce((s, c) => {
    const gain = (c.market_value ?? c.purchase_price ?? 0) - (c.purchase_price ?? 0)
    return s + gain
  }, 0)

  const { error } = await supabase
    .from('portfolio_snapshots')
    .upsert({
      user_id:        user.id,
      snapshot_date:  today,
      total_cost:     Math.round(totalCost  * 100) / 100,
      total_value:    Math.round(totalValue * 100) / 100,
      card_count:     cardCount,
      realized_gains: Math.round(realizedGains * 100) / 100,
    }, { onConflict: 'user_id,snapshot_date' })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({
    ok: true, date: today, total_cost: totalCost, total_value: totalValue, card_count: cardCount,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
