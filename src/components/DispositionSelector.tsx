import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Award, Archive, Tag, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card, CardStatus } from '@/types/cards';

type DispositionPath = 'grading' | 'collection' | 'listing';

const OPTIONS: {
  id: DispositionPath;
  label: string;
  description: string;
  icon: React.ReactNode;
  targetStatus: CardStatus;
  actionLabel: string;
  color: string;
}[] = [
  {
    id: 'grading',
    label: 'Send to grading',
    description: 'Add this card to a grading submission bundle for PSA, BGS, CGC, TAG, or SGC.',
    icon: <Award className="h-6 w-6" />,
    targetStatus: 'grading',
    actionLabel: 'Select grading service',
    color: 'border-[#14314F] bg-[#14314F]/5',
  },
  {
    id: 'collection',
    label: 'Add to collection',
    description: 'Move to your personal collection to hold onto this card.',
    icon: <Archive className="h-6 w-6" />,
    targetStatus: 'collection',
    actionLabel: 'Move to collection',
    color: 'border-[#47682d] bg-[#47682d]/5',
  },
  {
    id: 'listing',
    label: 'List for sale',
    description: 'Push a listing to eBay, Shopify, or CardTrader.',
    icon: <Tag className="h-6 w-6" />,
    targetStatus: 'listed',
    actionLabel: 'Create listing',
    color: 'border-orange-400 bg-orange-50',
  },
];

interface Props {
  card: Card;
  onStatusChange?: (newStatus: CardStatus) => void;
}

export default function DispositionSelector({ card, onStatusChange }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<DispositionPath | null>(null);
  const [saving, setSaving] = useState(false);

  const current = card.status;

  const handleAction = async (path: DispositionPath) => {
    if (path === 'grading') {
      navigate(`/portal/grading?card=${card.id}`);
      return;
    }
    if (path === 'listing') {
      navigate(`/portal/listings/new?card=${card.id}`);
      return;
    }

    // Move to collection
    setSaving(true);
    const { error } = await supabase
      .from('cards')
      .update({ status: 'collection' })
      .eq('id', card.id);

    if (error) {
      toast({ title: 'Error', description: 'Could not update card status.', variant: 'destructive' });
    } else {
      toast({ title: 'Moved to collection' });
      onStatusChange?.('collection');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-[#14314F]">What do you want to do with this card?</h3>
        <p className="text-sm text-gray-500 mt-1">
          Current status: <span className="font-medium capitalize">{current.replace('_', ' ')}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {OPTIONS.map((opt) => {
          const isActive = current === opt.targetStatus;
          return (
            <button
              key={opt.id}
              onClick={() => setSelected(selected === opt.id ? null : opt.id)}
              className={cn(
                'relative text-left rounded-xl border-2 p-4 transition-all',
                isActive ? 'border-[#47682d] bg-[#47682d]/10' : selected === opt.id ? opt.color : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <div className="flex items-start gap-3">
                <span className={isActive || selected === opt.id ? 'text-[#14314F]' : 'text-gray-400'}>
                  {opt.icon}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-800 flex items-center gap-2">
                    {opt.label}
                    {isActive && <CheckCircle2 className="h-4 w-4 text-[#47682d]" />}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
                </div>
              </div>

              {selected === opt.id && !isActive && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    className="bg-[#14314F] hover:bg-[#14314F]/90 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(opt.id);
                    }}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {opt.actionLabel}
                  </Button>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
