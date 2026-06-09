import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, ShoppingBag } from 'lucide-react';
import SaleCompleter from '@/components/SaleCompleter';
import type { Listing, Card, Purchase } from '@/types/cards';

interface ListingWithCard extends Listing {
  card?: Card & { purchases?: Purchase[] };
}

const MARKETPLACE_LABELS: Record<string, string> = {
  ebay: 'eBay',
  shopify: 'Shopify',
  cardtrader: 'CardTrader',
  tcgplayer: 'TCGPlayer',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  sold: 'bg-blue-100 text-blue-700',
  expired: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

export default function ListingsDashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState<ListingWithCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'sold'>('active');

  const loadListings = async () => {
    if (!user) return;
    const query = supabase
      .from('listings')
      .select('*, card:cards(*, purchases(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query.eq('status', filter);
    }

    const { data } = await query;
    setListings((data as ListingWithCard[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    loadListings();
  }, [user, filter]);

  const daysListed = (listedAt: string) => {
    return Math.floor((Date.now() - new Date(listedAt).getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#14314F]">Listings</h2>
          <p className="text-gray-500 mt-1">Track your active and historical marketplace listings.</p>
        </div>
        <Button asChild className="bg-[#47682d] hover:bg-[#47682d]/90 text-white">
          <Link to="/portal/intake">Add card to list</Link>
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['active', 'sold', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize ${
              filter === f ? 'bg-[#14314F] text-white border-[#14314F]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading listings…</span>
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No {filter !== 'all' ? filter : ''} listings yet.</p>
          <Button asChild variant="link" className="mt-1">
            <Link to="/portal/intake">Add a card to sell</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const card = listing.card;
            const purchase = card?.purchases?.[0];
            const costBasis = purchase?.cost_basis ?? 0;
            const days = daysListed(listing.listed_at);

            return (
              <div
                key={listing.id}
                className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 bg-white"
              >
                {/* Thumbnail */}
                {card?.image_front_url ? (
                  <img
                    src={card.image_front_url}
                    alt={card.card_name}
                    className="w-14 h-14 object-contain rounded-lg border bg-gray-50 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg border bg-gray-100 flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-6 w-6 text-gray-300" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/portal/cards/${listing.card_id}`}
                      className="font-medium text-[#14314F] hover:underline truncate"
                    >
                      {card?.card_name ?? 'Unknown card'}
                    </Link>
                    <Badge className={STATUS_COLORS[listing.status]}>{listing.status}</Badge>
                    <Badge variant="outline">{MARKETPLACE_LABELS[listing.marketplace]}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Listed {days === 0 ? 'today' : `${days} day${days !== 1 ? 's' : ''} ago`}
                    {costBasis > 0 && ` · Cost basis $${costBasis.toFixed(2)}`}
                  </p>
                </div>

                {/* Price + actions */}
                <div className="shrink-0 text-right space-y-1">
                  <p className="font-bold text-[#14314F] text-lg">${listing.listing_price.toFixed(2)}</p>
                  <div className="flex gap-2 justify-end">
                    {listing.listing_url && (
                      <a href={listing.listing_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 px-2">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                    {listing.status === 'active' && (
                      <SaleCompleter
                        listing={listing}
                        costBasis={costBasis}
                        onComplete={loadListings}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
