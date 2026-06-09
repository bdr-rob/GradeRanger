import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import type { Listing } from '@/types/cards';

interface Props {
  listing: Listing;
  costBasis: number;
  gradingFeePaid?: number;
  onComplete?: () => void;
}

export default function SaleCompleter({ listing, costBasis, gradingFeePaid = 0, onComplete }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [salePrice, setSalePrice] = useState(listing.listing_price.toFixed(2));
  const [marketplaceFee, setMarketplaceFee] = useState('');
  const [shippingPaid, setShippingPaid] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const salePriceNum = parseFloat(salePrice) || 0;
  const feeNum = parseFloat(marketplaceFee) || 0;
  const shippingNum = parseFloat(shippingPaid) || 0;
  const netProceeds = salePriceNum - feeNum - shippingNum;
  const netProfitLoss = netProceeds - costBasis - gradingFeePaid;
  const isProfit = netProfitLoss >= 0;

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Create transaction record
      const { error: txErr } = await supabase.from('transactions').insert({
        listing_id: listing.id,
        card_id: listing.card_id,
        sale_price: salePriceNum,
        marketplace_fee: feeNum,
        shipping_paid: shippingNum,
        grading_fee_paid: gradingFeePaid,
        cost_basis: costBasis,
        completed_at: new Date().toISOString(),
        notes: notes || null,
      });

      if (txErr) throw txErr;

      // Update listing
      await supabase
        .from('listings')
        .update({ status: 'sold', sold_at: new Date().toISOString() })
        .eq('id', listing.id);

      // Update card status
      await supabase.from('cards').update({ status: 'sold' }).eq('id', listing.card_id);

      toast({
        title: 'Sale recorded',
        description: `Net P&L: ${isProfit ? '+' : ''}$${netProfitLoss.toFixed(2)}`,
      });

      setOpen(false);
      onComplete?.();
    } catch {
      toast({ title: 'Error recording sale', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Mark as sold
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record sale</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Sale price (USD)</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input type="number" step="0.01" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="pl-6" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Marketplace fee (USD)</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input type="number" step="0.01" min="0" value={marketplaceFee} onChange={(e) => setMarketplaceFee(e.target.value)} className="pl-6" placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Shipping paid (USD)</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input type="number" step="0.01" min="0" value={shippingPaid} onChange={(e) => setShippingPaid(e.target.value)} className="pl-6" />
              </div>
            </div>
          </div>

          {/* P&L Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Sale price</span>
              <span>${salePriceNum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-red-500">
              <span>− Marketplace fee</span>
              <span>${feeNum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-red-500">
              <span>− Shipping paid</span>
              <span>${shippingNum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium text-gray-700">Net proceeds</span>
              <span className="font-medium">${netProceeds.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-red-500">
              <span>− Cost basis</span>
              <span>${costBasis.toFixed(2)}</span>
            </div>
            {gradingFeePaid > 0 && (
              <div className="flex justify-between text-red-500">
                <span>− Grading fee</span>
                <span>${gradingFeePaid.toFixed(2)}</span>
              </div>
            )}
            <div className={`flex justify-between border-t pt-2 font-bold ${isProfit ? 'text-green-600' : 'text-red-500'}`}>
              <span className="flex items-center gap-1">
                {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                Net profit / loss
              </span>
              <span>{isProfit ? '+' : ''}${netProfitLoss.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Buyer details, notes…" />
          </div>

          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={handleComplete}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Record sale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
