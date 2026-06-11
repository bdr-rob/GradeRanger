import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ArrowRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Props {
  onClose: () => void;
}

export default function AnnouncementPopup({ onClose }: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert({ email });

      if (error && error.code !== '23505') throw error; // 23505 = duplicate, ignore
      setSubscribed(true);
    } catch {
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-[#14314F] px-6 py-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <img src="/grade-ranger-logo.png" alt="" className="h-6 w-6 object-contain" />
              <span className="font-bold">Grade Ranger</span>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-[#47682d]/40 text-[#ABD2BE] text-xs px-2 py-0.5 rounded-full mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#47682d] animate-pulse" />
            Now in beta
          </div>
          <h2 className="text-xl font-bold">Welcome to Grade Ranger</h2>
          <p className="text-[#ABD2BE] text-sm mt-1">
            The AI-powered platform for professional card dealers. Scan, identify, grade, and sell at scale.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Login / Signup CTA */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Ready to get started?</p>
            <div className="flex gap-2">
              <Button
                asChild
                className="flex-1 bg-[#47682d] hover:bg-[#47682d]/90 text-white"
                onClick={onClose}
              >
                <Link to="/signup">
                  Create account <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1" onClick={onClose}>
                <Link to="/login">Log in</Link>
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-100" />
            <span className="text-xs text-gray-400">or stay in the loop</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>

          {/* Email capture */}
          {subscribed ? (
            <div className="text-center py-1">
              <p className="text-sm font-medium text-[#47682d]">✓ You're on the list!</p>
              <p className="text-xs text-gray-400 mt-1">We'll keep you updated on new features and announcements.</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Get updates & announcements</p>
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-9 text-sm"
                  required
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-[#14314F] hover:bg-[#14314F]/90 text-white px-3"
                >
                  {submitting
                    ? <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <Mail className="h-3.5 w-3.5" />
                  }
                </Button>
              </form>
              <p className="text-xs text-gray-400 mt-1.5">No spam. Unsubscribe anytime.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}