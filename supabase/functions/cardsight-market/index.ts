import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  fetchCardSightPricing,
  summarizeRawPricing,
  summarizeGradedPricing,
  fetchCardSightMarketplace,
  summarizeRawListings,
  type CardSightSaleRecord,
  type CardSightListingRecord,
} from '../_shared/cardsightPricing.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FlatSale {
  date: string
  price: number
  source?: string
  grade?: string
  company?: string
}

interface FlatListing {
  price: number
  source?: string
  title?: string
  url?: string
  listingType?: string
  endDate?: string
  bidCount?: number
  grade?: string
  company?: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('CARDSIGHT_API_KEY')
    if (!apiKey) throw new Error('CARDSIGHT_API_KEY not set')

    const { card_id, cardsight_card_id, period } = await req.json()
    if (!cardsight_card_id) return new Response(
      JSON.stringify({ error: 'cardsight_card_id required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

    const [
      { data, status: pricingStatus, errorText: pricingError },
      { data: marketplaceData, status: marketplaceStatus, errorText: marketplaceError },
    ] = await Promise.all([
      fetchCardSightPricing(cardsight_card_id, apiKey, { period: period ?? 'all' }),
      fetchCardSightMarketplace(cardsight_card_id, apiKey),
    ])

    const pricingSummary = summarizeRawPricing(data)
    const listingsSummary = summarizeRawListings(marketplaceData)
    const gradedValues = summarizeGradedPricing(data)

    // Completed sales are sparse right now — fall back to active listing
    // prices for the headline value when there's no sales history at all.
    const usingListingsFallback = pricingSummary.median == null && listingsSummary.median != null
    const currentPrice = pricingSummary.median ?? listingsSummary.median
    const rawLow        = pricingSummary.low   ?? listingsSummary.low
    const rawHigh        = pricingSummary.high ?? listingsSummary.high

    const rawRecords = data?.raw?.records ?? []

    // Price history chart — raw (ungraded) completed sales over time
    const history = rawRecords
      .filter((r: CardSightSaleRecord) => r.date && typeof r.price === 'number')
      .map((r: CardSightSaleRecord) => ({ date: r.date, price: r.price }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Recent sales table — raw + graded, most recent first
    const flatRaw: FlatSale[] = rawRecords.map((r: CardSightSaleRecord) => ({
      date: r.date, price: r.price, source: r.source,
    }))
    const flatGraded: FlatSale[] = []
    for (const company of data?.graded ?? []) {
      for (const grade of company.grades ?? []) {
        for (const r of grade.records ?? []) {
          flatGraded.push({
            date: r.date, price: r.price, source: r.source,
            grade: grade.grade_value, company: company.company_name,
          })
        }
      }
    }

    const sales = [...flatRaw, ...flatGraded]
      .filter((s) => s.date && typeof s.price === 'number')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
      .map((s) => ({
        date: s.date,
        price: s.price,
        platform: s.source ?? null,
        condition: s.company && s.grade ? `${s.company} ${s.grade}` : null,
        grade: s.grade ?? null,
      }))

    // Active marketplace listings — raw + graded, most expensive first isn't
    // useful here, so just keep CardSight's own ordering, most recent batch.
    const flatRawListings: FlatListing[] = (marketplaceData?.raw?.records ?? []).map((r: CardSightListingRecord) => ({
      price: r.price, source: r.source, title: r.title, url: r.url,
      listingType: r.listing_type, endDate: r.end_date, bidCount: r.bid_count,
    }))
    const flatGradedListings: FlatListing[] = []
    for (const company of marketplaceData?.graded ?? []) {
      for (const grade of company.grades ?? []) {
        for (const r of grade.records ?? []) {
          flatGradedListings.push({
            price: r.price, source: r.source, title: r.title, url: r.url,
            listingType: r.listing_type, endDate: r.end_date, bidCount: r.bid_count,
            grade: grade.grade_value, company: company.company_name,
          })
        }
      }
    }

    const listings = [...flatRawListings, ...flatGradedListings]
      .filter((l) => typeof l.price === 'number')
      .slice(0, 20)
      .map((l) => ({
        price: l.price,
        title: l.title ?? null,
        platform: l.source ?? null,
        url: l.url ?? null,
        listingType: l.listingType ?? null,
        endDate: l.endDate ?? null,
        bidCount: l.bidCount ?? null,
        condition: l.company && l.grade ? `${l.company} ${l.grade}` : null,
        grade: l.grade ?? null,
      }))

    // Save to market_valuations if we have a card_id and price
    if (card_id && currentPrice != null) {
      const sb = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      const { error } = await sb.from('market_valuations').upsert({
        card_id,
        raw_median: currentPrice,
        raw_low:    rawLow,
        raw_high:   rawHigh,
        graded_values: Object.keys(gradedValues).length ? gradedValues : null,
        data_source: usingListingsFallback ? 'CardSight (active listings)' : 'CardSight',
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'card_id' })
      if (error) console.error('market_valuations upsert error:', error)
    }

    return new Response(JSON.stringify({
      currentPrice,
      rawLow,
      rawHigh,
      usingListingsFallback,
      history,
      sales,
      listings,
      gradedValues,
      _debug: {
        pricingStatus,
        pricingError: pricingError ?? null,
        marketplaceStatus,
        marketplaceError: marketplaceError ?? null,
        totalRecords:      data?.meta?.total_records ?? null,
        lastSaleDate:      data?.meta?.last_sale_date ?? null,
        rawCount:          rawRecords.length,
        listingsCount:     marketplaceData?.raw?.records?.length ?? 0,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('cardsight-market error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})