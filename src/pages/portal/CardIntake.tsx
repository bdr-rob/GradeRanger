import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';
import ScanStep from '@/components/intake/ScanStep';
import PurchaseInfoStep, { type PurchaseFormValues } from '@/components/intake/PurchaseInfoStep';
import ReviewStep from '@/components/intake/ReviewStep';
import { submitCardForAnalysis } from '@/lib/api/aiAnalysis';

type Step = 'scan' | 'purchase' | 'review';
const STEPS: { id: Step; label: string }[] = [
  { id: 'scan', label: 'Scan card' },
  { id: 'purchase', label: 'Purchase info' },
  { id: 'review', label: 'Review & confirm' },
];

function StepIndicator({ steps, current }: { steps: typeof STEPS; current: Step }) {
  const currentIdx = steps.findIndex((s) => s.id === current);
  return (
    <nav className="flex items-center gap-2">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = step.id === current;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors',
                done ? 'bg-[#47682d] text-white' : active ? 'bg-[#14314F] text-white' : 'bg-gray-200 text-gray-500',
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                'text-sm font-medium hidden sm:inline',
                active ? 'text-[#14314F]' : done ? 'text-[#47682d]' : 'text-gray-400',
              )}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div className={cn('h-px w-6 sm:w-10', done ? 'bg-[#47682d]' : 'bg-gray-200')} />
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default function CardIntake() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('scan');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [purchaseData, setPurchaseData] = useState<PurchaseFormValues | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePurchaseNext = (values: PurchaseFormValues) => {
    setPurchaseData(values);
    setStep('review');
  };

  const handleConfirm = async () => {
    if (!user || !purchaseData) return;
    setSaving(true);

    try {
      // 1. Upload images to Supabase Storage
      let frontUrl: string | null = null;
      let backUrl: string | null = null;

      if (frontImage) {
        const blob = await fetch(frontImage).then((r) => r.blob());
        const path = `${user.id}/${Date.now()}_front.jpg`;
        const { error: upErr } = await supabase.storage.from('card-images').upload(path, blob, { upsert: false });
        if (!upErr) {
          const { data } = supabase.storage.from('card-images').getPublicUrl(path);
          frontUrl = data.publicUrl;
        }
      }

      if (backImage) {
        const blob = await fetch(backImage).then((r) => r.blob());
        const path = `${user.id}/${Date.now()}_back.jpg`;
        const { error: upErr } = await supabase.storage.from('card-images').upload(path, blob, { upsert: false });
        if (!upErr) {
          const { data } = supabase.storage.from('card-images').getPublicUrl(path);
          backUrl = data.publicUrl;
        }
      }

      // 2. Create card record
      const { data: card, error: cardErr } = await supabase
        .from('cards')
        .insert({
          user_id: user.id,
          card_name: purchaseData.card_name,
          player_name: purchaseData.player_name || null,
          year: purchaseData.year || null,
          set_name: purchaseData.set_name || null,
          card_number: purchaseData.card_number || null,
          sport: purchaseData.sport || null,
          status: 'intake',
          image_front_url: frontUrl,
          image_back_url: backUrl,
          notes: purchaseData.notes || null,
        })
        .select()
        .single();

      if (cardErr || !card) throw cardErr ?? new Error('Failed to create card');

      // 3. Create purchase record
      const purchasePrice = parseFloat(purchaseData.purchase_price || '0');
      const shippingCost = parseFloat(purchaseData.shipping_cost || '0');

      await supabase.from('purchases').insert({
        card_id: card.id,
        purchase_price: purchasePrice,
        shipping_cost: shippingCost,
        purchase_site: purchaseData.purchase_site || null,
        purchase_order: purchaseData.purchase_order || null,
        purchase_date: purchaseData.purchase_date || null,
        notes: purchaseData.notes || null,
      });

      // 4. Kick off AI analysis (non-blocking)
      if (frontUrl) {
        submitCardForAnalysis(card.id, frontUrl, backUrl ?? frontUrl).catch(() => {
          // Analysis will show as pending — user can retry from card detail page
        });
      }

      toast({ title: 'Card saved', description: 'AI analysis is running in the background.' });
      navigate(`/portal/cards/${card.id}`);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error saving card', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[#14314F]">Add a new card</h2>
        <p className="text-gray-500 mt-1">Upload images, enter purchase details, and we'll run AI grading analysis automatically.</p>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        {step === 'scan' && (
          <ScanStep
            frontImage={frontImage}
            backImage={backImage}
            onFrontChange={setFrontImage}
            onBackChange={setBackImage}
            onNext={() => setStep('purchase')}
          />
        )}
        {step === 'purchase' && (
          <PurchaseInfoStep
            defaultValues={purchaseData ?? undefined}
            onNext={handlePurchaseNext}
            onBack={() => setStep('scan')}
          />
        )}
        {step === 'review' && purchaseData && (
          <ReviewStep
            frontImage={frontImage}
            backImage={backImage}
            purchaseData={purchaseData}
            onBack={() => setStep('purchase')}
            onConfirm={handleConfirm}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
