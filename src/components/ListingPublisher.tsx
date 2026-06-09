import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ExternalLink } from 'lucide-react';
import type { Card, ListingMarketplace } from '@/types/cards';

interface Props {
  card: Card;
  suggestedPrice?: number;
  onSuccess?: () => void;
}

const MARKETPLACES: { id: ListingMarketplace; label: string; description: string }[] = [
  { id: 'ebay', label: 'eBay', description: 'List on eBay marketplace' },
  { id: 'shopify', label: 'Shopify', description: 'List on your Shopify store' },
  { id: 'cardtrader', label: 'CardTrader', description: 'List on CardTrader (TCG focus)' },
];

export default function ListingPublisher({ card, suggestedPrice, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [selectedPlatforms, setSelectedPlatforms] = useState<ListingMarketplace[]>(['ebay']);
  const [price, setPrice] = useState(suggestedPrice?.toFixed(2) ?? '');
  const [shipping, setShipping] = useState('5.00');
  const [description, setDescription] = useState(
    `${card.card_name}${card.player_name ? ` — ${card.player_name}` : ''}${card.year ? ` (${card.year})` : ''}. ${card.set_name ?? ''}. ${card.notes ?? ''}`.trim(),
  );
  const [saving, setSaving] = useState(false);

  const togglePlatform = (platform: ListingMarketplace) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  };

  const handlePublish = async () => {
    if (!user || selectedPlatforms.length === 0) return;
    const listingPrice = parseFloat(price);
    if (isNaN(listingPrice) || listingPrice <= 0) {
      toast({ title: 'Please enter a valid price', variant: 'destructive' });
      return;
    }

    setSaving(true);

    try {
      for (const marketplace of selectedPlatforms) {
        // Create listing record
        const { data: listing, error } = await supabase
          .from('listings')
          .insert({
            card_id: card.id,
            user_id: user.id,
            marketplace,
            listing_price: listingPrice,
            shipping_amount: parseFloat(shipping) || 0,
            status: 'active',
          })
          .select()
          .single();

        if (error) throw error;

        // Push to marketplace via edge function (non-blocking for now)
        supabase.functions.invoke(`${marketplace}-list`, {
          body: {
            listing_id: listing.id,
            card: { ...card, description },
            price: listingPrice,
            shipping: parseFloat(shipping) || 0,
          },
        }).catch(() => {
          // Listing is saved locally even if push fails
        });
      }

      // Update card status to listed
      await supabase.from('cards').update({ status: 'listed' }).eq('id', card.id);

      toast({
        title: 'Listing created',
        description: `Listed on ${selectedPlatforms.join(', ')}`,
      });

      onSuccess?.();
      navigate('/portal/listings');
    } catch {
      toast({ title: 'Error creating listing', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-[#14314F]">List for sale</h3>
        <p className="text-sm text-gray-500 mt-1">Choose marketplaces and set your price.</p>
      </div>

      {/* Platform selection */}
      <div className="space-y-3">
        <Label>Marketplaces</Label>
        {MARKETPLACES.map((mp) => (
          <label
            key={mp.id}
            className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-[#14314F]/30"
          >
            <Checkbox
              checked={selectedPlatforms.includes(mp.id)}
              onCheckedChange={() => togglePlatform(mp.id)}
            />
            <div>
              <p className="text-sm font-medium text-gray-800">{mp.label}</p>
              <p className="text-xs text-gray-500">{mp.description}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Listing price (USD)</Label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="pl-6"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Shipping (USD)</Label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              className="pl-6"
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label>Listing description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Card description for the listing…"
        />
      </div>

      {/* Card images preview */}
      {(card.image_front_url || card.image_back_url) && (
        <div className="flex gap-2">
          {card.image_front_url && (
            <img src={card.image_front_url} alt="Front" className="h-20 w-auto object-contain rounded border" />
          )}
          {card.image_back_url && (
            <img src={card.image_back_url} alt="Back" className="h-20 w-auto object-contain rounded border" />
          )}
        </div>
      )}

      <Button
        className="w-full bg-[#47682d] hover:bg-[#47682d]/90 text-white"
        onClick={handlePublish}
        disabled={saving || selectedPlatforms.length === 0}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
        Publish listing{selectedPlatforms.length > 1 ? 's' : ''}
      </Button>
    </div>
  );
}
