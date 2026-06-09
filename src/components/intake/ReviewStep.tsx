import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PurchaseFormValues } from './PurchaseInfoStep';

interface Props {
  frontImage: string | null;
  backImage: string | null;
  purchaseData: PurchaseFormValues;
  onBack: () => void;
  onConfirm: () => void;
  saving: boolean;
}

export default function ReviewStep({
  frontImage,
  backImage,
  purchaseData,
  onBack,
  onConfirm,
  saving,
}: Props) {
  const purchasePrice = parseFloat(purchaseData.purchase_price || '0');
  const shippingCost = parseFloat(purchaseData.shipping_cost || '0');
  const costBasis = purchasePrice + shippingCost;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[#14314F]">Review &amp; confirm</h3>
        <p className="text-sm text-gray-500 mt-1">
          Check everything looks right before saving. AI analysis will start automatically after you confirm.
        </p>
      </div>

      {/* Images */}
      <div className="flex gap-3">
        {frontImage && (
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 mb-1">Front</p>
            <img src={frontImage} alt="Card front" className="w-full max-h-40 object-contain rounded-lg border" />
          </div>
        )}
        {backImage && (
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 mb-1">Back</p>
            <img src={backImage} alt="Card back" className="w-full max-h-40 object-contain rounded-lg border" />
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">Card details</h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-500">Name</dt>
          <dd className="font-medium text-gray-800">{purchaseData.card_name || '—'}</dd>
          <dt className="text-gray-500">Player / Character</dt>
          <dd className="font-medium text-gray-800">{purchaseData.player_name || '—'}</dd>
          <dt className="text-gray-500">Year</dt>
          <dd className="font-medium text-gray-800">{purchaseData.year || '—'}</dd>
          <dt className="text-gray-500">Set</dt>
          <dd className="font-medium text-gray-800">{purchaseData.set_name || '—'}</dd>
          <dt className="text-gray-500">Card number</dt>
          <dd className="font-medium text-gray-800">{purchaseData.card_number || '—'}</dd>
          <dt className="text-gray-500">Sport / Game</dt>
          <dd className="font-medium text-gray-800">{purchaseData.sport || '—'}</dd>
        </dl>
      </div>

      {/* Purchase Info */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">Purchase details</h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-500">Purchase price</dt>
          <dd className="font-medium text-gray-800">${purchasePrice.toFixed(2)}</dd>
          <dt className="text-gray-500">Shipping cost</dt>
          <dd className="font-medium text-gray-800">${shippingCost.toFixed(2)}</dd>
          <dt className="text-gray-500">Source</dt>
          <dd className="font-medium text-gray-800">{purchaseData.purchase_site || '—'}</dd>
          <dt className="text-gray-500">Purchase date</dt>
          <dd className="font-medium text-gray-800">{purchaseData.purchase_date || '—'}</dd>
        </dl>
        <div className="flex justify-between items-center border-t pt-2 mt-2">
          <span className="text-sm font-semibold text-gray-700">Cost basis</span>
          <Badge className="bg-[#14314F] text-white text-sm">${costBasis.toFixed(2)}</Badge>
        </div>
      </div>

      {/* AI notice */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          AI grading analysis will run automatically after saving. You can view the report on the card detail page once it completes (usually under 30 seconds).
        </p>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button
          onClick={onConfirm}
          className="bg-[#47682d] hover:bg-[#47682d]/90 text-white"
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save card & start analysis'
          )}
        </Button>
      </div>
    </div>
  );
}
