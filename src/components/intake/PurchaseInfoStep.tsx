import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PURCHASE_SOURCES } from '@/types/cards';

export interface PurchaseFormValues {
  card_name: string;
  player_name: string;
  year: string;
  set_name: string;
  card_number: string;
  sport: string;
  purchase_price: string;
  shipping_cost: string;
  purchase_site: string;
  purchase_order: string;
  purchase_date: string;
  notes: string;
}

interface Props {
  defaultValues?: Partial<PurchaseFormValues>;
  onNext: (values: PurchaseFormValues) => void;
  onBack: () => void;
}

export default function PurchaseInfoStep({ defaultValues, onNext, onBack }: Props) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PurchaseFormValues>({
    defaultValues: {
      card_name: '',
      player_name: '',
      year: '',
      set_name: '',
      card_number: '',
      sport: '',
      purchase_price: '',
      shipping_cost: '0',
      purchase_site: '',
      purchase_order: '',
      purchase_date: new Date().toISOString().split('T')[0],
      notes: '',
      ...defaultValues,
    },
  });

  const purchasePrice = parseFloat(watch('purchase_price') || '0');
  const shippingCost = parseFloat(watch('shipping_cost') || '0');
  const costBasis = (isNaN(purchasePrice) ? 0 : purchasePrice) + (isNaN(shippingCost) ? 0 : shippingCost);

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[#14314F]">Card details &amp; purchase info</h3>
        <p className="text-sm text-gray-500 mt-1">Tell us about the card and what you paid for it.</p>
      </div>

      {/* Card Identification */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-1">
          <Label htmlFor="card_name">Card name <span className="text-red-500">*</span></Label>
          <Input
            id="card_name"
            placeholder="e.g. Charizard, Mike Trout Rookie"
            {...register('card_name', { required: 'Card name is required' })}
          />
          {errors.card_name && <p className="text-xs text-red-500">{errors.card_name.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="player_name">Player / Character</Label>
          <Input id="player_name" placeholder="e.g. Mike Trout" {...register('player_name')} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="year">Year</Label>
          <Input id="year" placeholder="e.g. 2011" {...register('year')} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="set_name">Set / Series</Label>
          <Input id="set_name" placeholder="e.g. Topps Update" {...register('set_name')} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="card_number">Card number</Label>
          <Input id="card_number" placeholder="e.g. US175" {...register('card_number')} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="sport">Sport / Game</Label>
          <Input id="sport" placeholder="e.g. Baseball, Pokémon" {...register('sport')} />
        </div>
      </div>

      {/* Purchase Details */}
      <div className="border-t pt-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Purchase details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="purchase_price">Purchase price (USD) <span className="text-red-500">*</span></Label>
            <Input
              id="purchase_price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('purchase_price', { required: 'Purchase price is required' })}
            />
            {errors.purchase_price && <p className="text-xs text-red-500">{errors.purchase_price.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="shipping_cost">Shipping cost (USD)</Label>
            <Input id="shipping_cost" type="number" step="0.01" min="0" placeholder="0.00" {...register('shipping_cost')} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="purchase_site">Purchase source</Label>
            <Select onValueChange={(v) => setValue('purchase_site', v)}>
              <SelectTrigger id="purchase_site">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {PURCHASE_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="purchase_date">Purchase date <span className="text-red-500">*</span></Label>
            <Input id="purchase_date" type="date" {...register('purchase_date', { required: true })} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="purchase_order">Order number</Label>
            <Input id="purchase_order" placeholder="Optional" {...register('purchase_order')} />
          </div>
        </div>
      </div>

      {/* Cost Basis Display */}
      <div className="bg-[#47682d]/5 border border-[#47682d]/20 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Cost basis (purchase + shipping)</span>
          <span className="text-lg font-bold text-[#14314F]">${costBasis.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" placeholder="Any additional notes about this card…" rows={2} {...register('notes')} />
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit" className="bg-[#47682d] hover:bg-[#47682d]/90 text-white">
          Review &amp; confirm
        </Button>
      </div>
    </form>
  );
}
