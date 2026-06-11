import { useState } from 'react';
import { CheckCircle, Edit3, AlertTriangle, Loader2, Save, ChevronDown } from 'lucide-react';
import { RecognizedCard } from '@/lib/ximilar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  cards: RecognizedCard[];
  onComplete: () => void;
}

export default function CardReviewTable({ cards: initial, onComplete }: Props) {
  const { user } = useAuth();
  const [cards, setCards] = useState<RecognizedCard[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (localId: string, patch: Partial<RecognizedCard>) =>
    setCards((prev) =>
      prev.map((c) => (c.localId === localId ? { ...c, ...patch } : c))
    );

  const updateMatch = (localId: string, field: string, value: string) =>
    setCards((prev) =>
      prev.map((c) =>
        c.localId === localId
          ? { ...c, bestMatch: c.bestMatch ? { ...c.bestMatch, [field]: value } : c.bestMatch }
          : c
      )
    );

  const confidenceColor = (conf: number) => {
    if (conf >= 0.85) return '#47682d';
    if (conf >= 0.6) return '#d97706';
    return '#ef4444';
  };

  const confidenceLabel = (conf: number) => {
    if (conf >= 0.85) return 'High';
    if (conf >= 0.6) return 'Medium';
    return 'Low';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Upload images to Supabase storage
      const insertRows = await Promise.all(
        cards.map(async (card) => {
          const filename = `${user!.id}/${Date.now()}-${card.localId}.jpg`;
          const blob = await fetch(card.image.preview).then((r) => r.blob());

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('card-images')
            .upload(filename, blob, { contentType: 'image/jpeg', upsert: true });

          if (uploadErr) throw uploadErr;

          const { data: urlData } = supabase.storage
            .from('card-images')
            .getPublicUrl(uploadData.path);

          return {
            user_id: user!.id,
            image_front: urlData.publicUrl,
            player_name: card.bestMatch?.player ?? card.bestMatch?.name ?? 'Unknown',
            card_year: card.bestMatch?.year ?? null,
            card_set: card.bestMatch?.set_name ?? null,
            card_number: card.bestMatch?.card_number ?? null,
            sport: card.bestMatch?.sport ?? null,
            parallel: card.bestMatch?.parallel ?? null,
            variation: card.bestMatch?.variation ?? null,
            purchase_price: card.purchasePrice ? parseFloat(card.purchasePrice) : null,
            purchase_location: card.purchaseLocation || null,
            ximilar_confidence: card.confidence,
            status: 'identified',
          };
        })
      );

      const { error: insertErr } = await supabase.from('cards').insert(insertRows);
      if (insertErr) throw insertErr;

      setSaved(true);
      setTimeout(onComplete, 1500);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="text-center py-20">
        <CheckCircle className="w-14 h-14 mx-auto mb-4" style={{ color: '#47682d' }} />
        <h3 className="text-xl font-bold mb-2" style={{ color: '#14314F' }}>
          {cards.length} Card{cards.length !== 1 ? 's' : ''} Saved!
        </h3>
        <p className="text-gray-500 text-sm">Redirecting to your portfolio…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg" style={{ color: '#14314F' }}>
            Review Identified Cards
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Edit any fields before saving. Add purchase details per card.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#47682d' }}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : (
            <><Save className="w-4 h-4" /> Save {cards.length} Cards</>
          )}
        </button>
      </div>

      <div className="space-y-4">
        {cards.map((card, index) => (
          <div
            key={card.localId}
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: '#14314F15' }}
          >
            <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"
                 style={{ backgroundColor: '#14314F08', color: '#14314F' }}>
              <span className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px]"
                    style={{ backgroundColor: '#14314F' }}>
                {index + 1}
              </span>
              Card #{index + 1}
              {card.confidence > 0 && (
                <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-bold"
                      style={{ backgroundColor: confidenceColor(card.confidence) }}>
                  {confidenceLabel(card.confidence)} — {Math.round(card.confidence * 100)}%
                </span>
              )}
              {!card.bestMatch && (
                <span className="ml-auto flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="w-3 h-3" /> Not identified — fill in manually
                </span>
              )}
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-[80px_1fr_1fr] gap-4">
              {/* Thumbnail */}
              <div className="w-20 h-28 rounded-lg overflow-hidden shrink-0 shadow-sm">
                <img
                  src={card.image.preview}
                  alt="Card"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Card details */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { label: 'Player / Name', field: 'player' },
                  { label: 'Year', field: 'year' },
                  { label: 'Set', field: 'set_name' },
                  { label: 'Card #', field: 'card_number' },
                  { label: 'Sport / Category', field: 'sport' },
                  { label: 'Parallel / Variation', field: 'parallel' },
                ].map(({ label, field }) => (
                  <div key={field}>
                    <label className="block text-[10px] font-semibold text-gray-400 mb-0.5 uppercase tracking-wide">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={(card.bestMatch as any)?.[field] ?? ''}
                      onChange={(e) => updateMatch(card.localId, field, e.target.value)}
                      placeholder="—"
                      className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1"
                      style={{ '--tw-ring-color': '#47682d' } as React.CSSProperties}
                    />
                  </div>
                ))}
              </div>

              {/* Purchase details */}
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-0.5 uppercase tracking-wide">
                    Purchase Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={card.purchasePrice}
                    onChange={(e) => update(card.localId, { purchasePrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1"
                    style={{ '--tw-ring-color': '#47682d' } as React.CSSProperties}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-0.5 uppercase tracking-wide">
                    Purchase Location
                  </label>
                  <select
                    value={card.purchaseLocation}
                    onChange={(e) => update(card.localId, { purchaseLocation: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 bg-white"
                    style={{ '--tw-ring-color': '#47682d' } as React.CSSProperties}
                  >
                    <option value="">Select location…</option>
                    <option value="eBay">eBay</option>
                    <option value="PWCC">PWCC</option>
                    <option value="Local Shop">Local Shop</option>
                    <option value="Card Show">Card Show</option>
                    <option value="Private Sale">Private Sale</option>
                    <option value="Pack">Pack / Box Break</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-60 transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#47682d' }}
      >
        {saving ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        ) : (
          <><Save className="w-4 h-4" /> Save All {cards.length} Cards to Portfolio</>
        )}
      </button>
    </div>
  );
}