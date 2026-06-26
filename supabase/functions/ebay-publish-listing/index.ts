import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getValidEbayToken, ebayGet, ebayPut, ebayPost } from '../_shared/ebay.ts'

// NOTE: eBay's exact category/condition/aspect requirements vary by item
// type and aren't fully knowable without a live sandbox round-trip — this
// is a best-effort first pass at the Inventory + Offer API flow. Expect to
// need to adjust categoryId/condition/aspects once tested against a real
// eBay account; the error messages below are written to make eBay's own
// validation failures legible rather than hiding them.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MARKETPLACE_ID = 'EBAY_US'
// Sports Trading Cards (single). For TCG cards this category is wrong —
// eBay has separate category trees per game (Pokemon, Magic, etc.) under
// "Collectible Card Games". Swap based on card.sport/segment once that
// mapping is worked out against eBay's category API.
const DEFAULT_CATEGORY_ID = '261328'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userErr } = await client.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const { listing_id } = await req.json()
    if (!listing_id) return json({ error: 'listing_id required' }, 400)

    const { data: listing, error: listingErr } = await client
      .from('listings')
      .select('*, card:cards(*)')
      .eq('id', listing_id)
      .single()
    if (listingErr || !listing) return json({ error: 'Listing not found' }, 404)
    if (listing.marketplace !== 'ebay') return json({ error: 'This listing is not an eBay listing' }, 400)

    const token = await getValidEbayToken(client, user.id)
    const card = listing.card

    // Auto-discover business policies (fulfillment/payment/return) and
    // merchant location rather than asking for IDs — requires at least one
    // of each already configured in eBay Seller Hub.
    const [fulfillment, payment, returns, locations] = await Promise.all([
      ebayGet(`/sell/account/v1/fulfillment_policy?marketplace_id=${MARKETPLACE_ID}`, token),
      ebayGet(`/sell/account/v1/payment_policy?marketplace_id=${MARKETPLACE_ID}`, token),
      ebayGet(`/sell/account/v1/return_policy?marketplace_id=${MARKETPLACE_ID}`, token),
      ebayGet(`/sell/inventory/v1/location`, token),
    ])

    const fulfillmentPolicyId = fulfillment.fulfillmentPolicies?.[0]?.fulfillmentPolicyId
    const paymentPolicyId = payment.paymentPolicies?.[0]?.paymentPolicyId
    const returnPolicyId = returns.returnPolicies?.[0]?.returnPolicyId
    const merchantLocationKey = locations.locations?.[0]?.merchantLocationKey

    const missing = [
      !fulfillmentPolicyId && 'a fulfillment (shipping) policy',
      !paymentPolicyId && 'a payment policy',
      !returnPolicyId && 'a return policy',
      !merchantLocationKey && 'a merchant inventory location',
    ].filter(Boolean)
    if (missing.length) {
      return json({
        error: `Your eBay seller account is missing ${missing.join(', ')}. Set these up in Seller Hub before publishing.`,
      }, 422)
    }

    const sku = card.id

    await ebayPut(`/sell/inventory/v1/inventory_item/${sku}`, token, {
      availability: { shipToLocationAvailability: { quantity: listing.quantity ?? 1 } },
      condition: card.official_grade ? 'USED_EXCELLENT' : 'USED_GOOD',
      product: {
        title: (listing.title ?? card.card_name ?? 'Trading Card').slice(0, 80),
        description: listing.description ?? card.description ?? '',
        imageUrls: [card.image_front_url, card.image_back_url].filter(Boolean),
        aspects: {
          ...(card.player_name ? { 'Player/Athlete': [card.player_name] } : {}),
          ...(card.year ? { Year: [String(card.year)] } : {}),
          ...(card.set_name ? { Set: [card.set_name] } : {}),
          ...(card.card_number ? { 'Card Number': [card.card_number] } : {}),
          ...(card.official_grade ? { Grade: [String(card.official_grade)] } : {}),
        },
      },
    })

    const offer = await ebayPost(`/sell/inventory/v1/offer`, token, {
      sku,
      marketplaceId: MARKETPLACE_ID,
      format: 'FIXED_PRICE',
      availableQuantity: listing.quantity ?? 1,
      categoryId: DEFAULT_CATEGORY_ID,
      listingDescription: listing.description ?? card.description ?? '',
      pricingSummary: { price: { value: String(listing.listing_price), currency: 'USD' } },
      listingPolicies: { fulfillmentPolicyId, paymentPolicyId, returnPolicyId },
      merchantLocationKey,
    })

    const publishResult = await ebayPost(`/sell/inventory/v1/offer/${offer.offerId}/publish`, token)
    const ebayListingId = publishResult.listingId

    const { error: updateErr } = await client
      .from('listings')
      .update({
        external_listing_id: ebayListingId,
        listing_url: `https://www.ebay.com/itm/${ebayListingId}`,
        status: 'active',
        listed_at: new Date().toISOString(),
      })
      .eq('id', listing_id)
    if (updateErr) throw new Error(`Published to eBay but failed to update listing record: ${updateErr.message}`)

    return json({ published: true, ebayListingId, listingUrl: `https://www.ebay.com/itm/${ebayListingId}` })
  } catch (err) {
    console.error('ebay-publish-listing error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
