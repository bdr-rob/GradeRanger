// Shared helpers for talking to eBay's Sell APIs — used by
// ebay-publish-listing. Token acquisition/refresh lives here since it's
// identical regardless of which Sell API call follows it.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function ebayBase() {
  const sandbox = (Deno.env.get('EBAY_ENV') ?? 'production') === 'sandbox'
  return sandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
}

// Returns a usable access token for this user's eBay connection, refreshing
// it first if it's expired or about to expire. Throws if there's no active
// connection — caller should surface that as "connect eBay in Settings".
export async function getValidEbayToken(client: SupabaseClient, userId: string): Promise<string> {
  const { data: conn, error } = await client
    .from('marketplace_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'ebay')
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(`Could not read eBay connection: ${error.message}`)
  if (!conn) throw new Error('No active eBay connection — connect eBay in Settings first')

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0
  if (expiresAt - Date.now() > 60_000) return conn.access_token // valid for >1 more minute

  const clientId = Deno.env.get('EBAY_CLIENT_ID')
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('EBAY_CLIENT_ID/EBAY_CLIENT_SECRET not set')

  const basicAuth = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(`${ebayBase()}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
    }),
  })

  if (!res.ok) throw new Error(`eBay token refresh failed: ${await res.text()}`)
  const tokens = await res.json()
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 0) * 1000).toISOString()

  const { error: updateErr } = await client
    .from('marketplace_connections')
    .update({ access_token: tokens.access_token, token_expires_at: newExpiresAt })
    .eq('id', conn.id)
  if (updateErr) throw new Error(`Could not persist refreshed eBay token: ${updateErr.message}`)

  return tokens.access_token
}

export async function ebayGet(path: string, token: string) {
  const res = await fetch(`${ebayBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`eBay GET ${path} failed — HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function ebayPut(path: string, token: string, body: unknown) {
  const res = await fetch(`${ebayBase()}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`eBay PUT ${path} failed — HTTP ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

export async function ebayPost(path: string, token: string, body?: unknown) {
  const res = await fetch(`${ebayBase()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`eBay POST ${path} failed — HTTP ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}
