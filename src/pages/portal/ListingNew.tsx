import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Tag } from 'lucide-react';
import type { Card, ListingMarketplace } from '@/types/cards';

const MARKETPLACES: { value: ListingMarketplace; label: string }[] = [
  { value: 'ebay', label: 'eBay' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'cardtrader', label: 'CardTrader' },
  { value: 'tcgplayer', label: 'TCGPlayer' },
  { value: 'other', label: 'Other' },
];

function generateTitle(card: any): string {
  const parts = [
    card.year, card.release_name ?? card.set_name, card.player_name ?? card.card_name,
    card.card_number ? `#${card.card_number}` : null,
    card.parallel, card.rarity,
    card.official_grade ? `${card.grading_company ?? ''} ${card.official_grade}`.trim() : null,
  ].filter(Boolean);
  return parts.join(' ').slice(0, 80);
}

function generateDescription(card: any): string {
  const lines = [
    card.description || null,
    card.set_name ? `Set: ${card.release_name ?? card.set_name}` : null,
    card.card_number ? `Card #: ${card.card_number}` : null,
    card.parallel ? `Parallel: ${card.parallel}` : null,
    card.rarity ? `Rarity: ${card.rarity}` : null,
    Array.isArray(card.attributes) && card.attributes.length ? `Attributes: ${card.attributes.join(', ')}` : null,
    card.official_grade ? `Grade: ${card.grading_company ?? ''} ${card.official_grade}`.trim() : null,
  ].filter(Boolean);
  return lines.join('\n');
}

export default function ListingNew() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cardId = searchParams.get('card');

  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [marketplace, setMarketplace] = useState<ListingMarketplace>('ebay');
  const [price, setPrice] = useState('');
  const [shipping, setShipping] = useState('0');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!cardId) { setLoading(false); return; }
    supabase.from('cards').select('*, market_valuations(*)').eq('id', cardId).single().then(({ data }) => {
      if (data) {
        setCard(data as Card);
        const c = data as any;
        setPrice(c.market_value != null ? String(c.market_value) : c.market_valuations?.[0]?.raw_median ?? '');
        setTitle(generateTitle(c));
        setDescription(generateDescription(c));
      }
      setLoading(false);
    });
  }, [cardId]);

  const saveListing = async () => {
    if (!user || !cardId || !price) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('listings')
      .insert({
        card_id: cardId,
        user_id: user.id,
        marketplace,
        listing_price: parseFloat(price) || 0,
        shipping_amount: parseFloat(shipping) || 0,
        title,
        description,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Could not save listing', description: error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    await supabase.from('cards').update({ status: 'listed' }).eq('id', cardId);
    toast({ title: 'Listing saved as draft' });
    navigate('/portal/listings');
  };

  if (!cardId) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 text-gray-400">
        <Tag className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p>No card selected. Pick a card from your collection first, then choose "List for sale."</p>
        <Button asChild variant="link" className="mt-2"><Link to="/portal">Back to collection</Link></Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading card…
      </div>
    );
  }

  if (!card) {
    return <p className="text-center py-16 text-gray-400">Card not found.</p>;
  }

  const c = card as any;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to={`/portal/cards/${cardId}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#14314F] mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to card
        </Link>
        <h2 className="text-2xl font-bold text-[#14314F]">Prepare listing</h2>
        <p className="text-gray-500 mt-1">{c.card_name} — review the details below before saving as a draft.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex gap-4">
          {c.image_front_url && (
            <img src={c.image_front_url} alt="" className="w-20 h-28 object-contain rounded border bg-gray-50 shrink-0" />
          )}
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Marketplace</Label>
            <Select value={marketplace} onValueChange={(v) => setMarketplace(v as ListingMarketplace)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Listing price ($)</Label>
            <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            {c.market_value != null && (
              <p className="text-xs text-gray-400">CardSight market value: ${Number(c.market_value).toFixed(2)}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Shipping ($)</Label>
            <Input type="number" step="0.01" min="0" value={shipping} onChange={(e) => setShipping(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          <p className="text-xs text-gray-400">{title.length}/80</p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
        </div>

        <Button
          className="w-full bg-[#47682d] hover:bg-[#47682d]/90 text-white"
          disabled={saving || !price}
          onClick={saveListing}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save as draft
        </Button>
      </div>
    </div>
  );
}
