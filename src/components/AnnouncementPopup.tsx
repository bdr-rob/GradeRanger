import { useState } from 'react';
import { X, Shield, ArrowRight, Mail, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface Props {
  onClose: () => void;
}

export default function AnnouncementPopup({ onClose }: Props) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    const { error: dbError } = await supabase
      .from('newsletter_subscribers')
      .insert({ email: email.trim().toLowerCase() });

    setLoading(false);

    if (dbError && dbError.code !== '23505') {
      // 23505 = duplicate email — treat as success
      setError('Something went wrong. Please try again.');
      return;
    }

    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
         style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
           style={{ backgroundColor: 'white' }}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="px-6 pt-8 pb-6 text-center" style={{ backgroundColor: '#14314F' }}>
          <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
               style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-extrabold text-white mb-1">
            Welcome to Grade Ranger
          </h2>
          <p className="text-sm text-white/70">
            Professional AI card grading for serious collectors
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* CTA Buttons */}
          <div className="space-y-3">
            <Link
              to="/register"
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-white font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#47682d' }}
            >
              Create Free Account <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-semibold border-2 transition-colors hover:bg-gray-50"
              style={{ borderColor: '#14314F', color: '#14314F' }}
            >
              Sign In to Portal
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or stay updated</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Email Capture */}
          {submitted ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
                 style={{ backgroundColor: '#ABD2BE40', color: '#47682d' }}>
              <CheckCircle className="w-5 h-5 shrink-0" />
              You're on the list! We'll keep you posted.
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#47682d' } as React.CSSProperties}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#14314F' }}
                >
                  {loading ? '...' : 'Notify Me'}
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <p className="text-xs text-gray-400 text-center">
                Get early access announcements and product updates. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}