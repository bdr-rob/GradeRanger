import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// eBay's user-token OAuth scopes — sell.inventory to create listings,
// sell.account to read business policies (fulfillment/payment/return) so
// ebay-publish-listing can auto-discover them instead of asking for IDs.
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
].join(' ')

function ebayBase() {
  const sandbox = (Deno.env.get('EBAY_ENV') ?? 'production') === 'sandbox'
  return {
    authBase: sandbox ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com',
    apiBase: sandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com',
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const clientId = Deno.env.get('EBAY_CLIENT_ID')
    const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET')
    // The RuName eBay issues for this app — NOT a literal URL. Configure the
    // actual https://.../portal/ebay/callback redirect in the eBay Developer
    // Portal against this RuName; eBay only needs the RuName value here.
    const redirectUri = Deno.env.get('EBAY_REDIRECT_URI')
    if (!clientId || !clientSecret || !redirectUri) {
      return json({ error: 'EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_REDIRECT_URI (RuName) must all be set' }, 500)
    }

    const { authBase, apiBase } = ebayBase()
    const { action, code } = await req.json().catch(() => ({}))

    if (action === 'authorize_url') {
      const url = `${authBase}/oauth2/authorize?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code&scope=${encodeURIComponent(SCOPES)}`
      return json({ url })
    }

    if (action === 'exchange_code') {
      if (!code) return json({ error: 'code required' }, 400)

      // Identify the calling user from their own session JWT (forwarded
      // automatically by supabase.functions.invoke) so the token gets
      // written under the right user_id via RLS, not a service-role bypass.
      const authHeader = req.headers.get('Authorization') ?? ''
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user }, error: userErr } = await userClient.auth.getUser()
      if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

      const basicAuth = btoa(`${clientId}:${clientSecret}`)
      const tokenRes = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      })

      if (!tokenRes.ok) {
        return json({ error: `eBay token exchange failed: ${await tokenRes.text()}` }, 502)
      }

      const tokens = await tokenRes.json()
      const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 0) * 1000).toISOString()

      const { error: upsertErr } = await userClient.from('marketplace_connections').upsert({
        user_id: user.id,
        platform: 'ebay',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        is_active: true,
      }, { onConflict: 'user_id,platform' })

      if (upsertErr) return json({ error: upsertErr.message }, 500)
      return json({ connected: true })
    }

    return json({ error: 'action must be one of: authorize_url, exchange_code' }, 400)
  } catch (err) {
    console.error('ebay-oauth error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
